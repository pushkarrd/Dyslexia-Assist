/**
 * TrimodalOrchestrator — Single entry-point that coordinates all trimodal
 * reading intelligence services: gaze, lip-sync, voice, pronunciation,
 * fusion, and adaptive responses.
 *
 * Usage:
 *   trimodalOrchestrator.start(passageWords, container, faceLandmarksRef)
 *   trimodalOrchestrator.stop()
 */

import { WordRegistryManager } from '../utils/WordRegistry';
import { TrimodalFusionEngine, trimodalFusionEngine } from './TrimodalFusionEngine';
import type { RevisitEvent, FusionResult } from './TrimodalFusionEngine';
import { adaptiveResponseEngine } from './AdaptiveResponseEngine';
import type { AdaptiveAction } from './AdaptiveResponseEngine';
import { webSpeechTTSService } from './WebSpeechTTSService';
import { microphoneService } from './MicrophoneService';
import { speechRecognitionService } from './SpeechRecognitionService';
import { pronunciationAnalyser } from './PronunciationAnalyser';
import type { PronunciationScore } from './PronunciationAnalyser';
import LipSyncEngine from './LipSyncEngine';

// ──────────── Types ────────────

export interface TrimodalStatus {
    gazeActive: boolean;
    lipSyncActive: boolean;
    voiceActive: boolean;
    micActive: boolean;
    isRunning: boolean;
}

type StatusCallback = (status: TrimodalStatus) => void;
type ActionCallback = (action: AdaptiveAction) => void;
type PronunciationCallback = (wordIndex: number, score: PronunciationScore) => void;

// ──────────── Orchestrator ────────────

class TrimodalOrchestrator {
    private running = false;
    private registry: WordRegistryManager | null = null;
    private lipEngine: LipSyncEngine | null = null;
    private fusionEngine: TrimodalFusionEngine;
    private fusionLoopId: number | null = null;
    private lipPollId: number | null = null;

    // Gaze position (updated via event)
    private gazeX = 0;
    private gazeY = 0;

    // Lip sync cache
    private cachedLipResult: { wordIndex: number; text: string; confidence: number } | null = null;
    private lipMatchPending = false;

    // Voice state
    private lastVoiceWordIndex: number | null = null;
    private voiceConfidence = 0;

    // Face landmarks ref (set by caller, typically from FaceMeshService)
    private faceLandmarksRef: { current: any } | null = null;
    private lastLipLandmarks: any = null;

    // Passage words for speech recognition
    private passageWords: string[] = [];

    // Listeners
    private statusListeners: StatusCallback[] = [];
    private actionListeners: ActionCallback[] = [];
    private pronunciationListeners: PronunciationCallback[] = [];

    // Cleanup functions
    private cleanups: (() => void)[] = [];

    // Status
    private status: TrimodalStatus = {
        gazeActive: false,
        lipSyncActive: false,
        voiceActive: false,
        micActive: false,
        isRunning: false,
    };

    constructor() {
        this.fusionEngine = trimodalFusionEngine;
    }

    // ========== PUBLIC API ==========

    /**
     * Start the full trimodal pipeline.
     *
     * @param passageText - The full passage text (used for speech recognition matching)
     * @param container - The DOM container with rendered word spans
     * @param faceLandmarksRef - React ref holding latest face landmarks from FaceMeshService
     */
    async start(
        passageText: string,
        container: HTMLElement,
        faceLandmarksRef: { current: any },
    ): Promise<void> {
        if (this.running) this.stop();

        this.running = true;
        this.faceLandmarksRef = faceLandmarksRef;
        this.passageWords = passageText
            .split(/\s+/)
            .map(w => w.replace(/[^\w'-]/g, '').toLowerCase())
            .filter(Boolean);

        // 1. Word registry
        this.registry = new WordRegistryManager();
        this.registry.attach(container);

        // 2. Lip sync engine
        const cores = navigator.hardwareConcurrency || 2;
        if (cores >= 4) {
            this.lipEngine = new LipSyncEngine();
            this.status.lipSyncActive = true;
        }

        // 3. Fusion engine reset
        this.fusionEngine.reset();

        // 4. Load pronunciation dictionary
        pronunciationAnalyser.loadPhonemes();

        // 5. Configure gaze listener
        const gazeHandler = (e: CustomEvent) => {
            this.gazeX = e.detail.x;
            this.gazeY = e.detail.y;
            this.status.gazeActive = true;
        };
        window.addEventListener('gazeupdate', gazeHandler as EventListener);
        this.cleanups.push(() => window.removeEventListener('gazeupdate', gazeHandler as EventListener));

        // 6. Microphone input
        try {
            await microphoneService.start();
            this.status.micActive = true;
        } catch {
            console.warn('[TrimodalOrchestrator] Microphone unavailable');
        }

        // 7. Speech recognition
        speechRecognitionService.setPassageWords(this.passageWords);
        const unsubVoiceWord = speechRecognitionService.onWord((recognized) => {
            if (recognized.matchedIndex !== null && recognized.matchedIndex >= 0 && this.registry) {
                this.lastVoiceWordIndex = recognized.matchedIndex;
                this.voiceConfidence = recognized.confidence;

                // Pronunciation analysis
                const targetEntry = this.registry.getWordByIndex(recognized.matchedIndex);
                if (targetEntry) {
                    const score = pronunciationAnalyser.analyseWord(
                        targetEntry.text,
                        recognized.word,
                    );
                    this.fusionEngine.recordPronunciationScore(recognized.matchedIndex, score);

                    if (!score.isCorrect) {
                        adaptiveResponseEngine.handlePronunciationError(
                            recognized.matchedIndex,
                            targetEntry.lineIndex,
                            score,
                        );
                    }

                    this.pronunciationListeners.forEach(cb => cb(recognized.matchedIndex!, score));
                }
            }
        });
        this.cleanups.push(unsubVoiceWord);

        speechRecognitionService.start();
        this.status.voiceActive = speechRecognitionService.getIsActive();

        // 8. Adaptive response actions — forward to listeners only (no auto-TTS;
        //    VoiceReadingEngine handles TTS based on the 3 trigger rules)
        const unsubAction = adaptiveResponseEngine.onAction((action) => {
            this.actionListeners.forEach(cb => cb(action));
        });
        this.cleanups.push(unsubAction);

        // 9. Fusion revisit events → adaptive engine
        const unsubRevisit = this.fusionEngine.onRevisit((event: RevisitEvent) => {
            // Build sentence text from the line if it's a line revisit
            let sentenceText: string | undefined;
            if (event.isLineRevisit && this.registry) {
                sentenceText = this.buildLineText(event.lineIndex);
            }
            adaptiveResponseEngine.handleRevisit(event, sentenceText);
        });
        this.cleanups.push(unsubRevisit);

        // 10. Lip sync polling loop
        if (this.lipEngine) {
            let lipRunning = true;
            const lipPoll = () => {
                if (!lipRunning) return;
                const lm = this.faceLandmarksRef?.current;
                if (lm && lm !== this.lastLipLandmarks && this.lipEngine) {
                    this.lastLipLandmarks = lm;
                    this.lipEngine.processFrame(lm);
                }
                this.lipPollId = requestAnimationFrame(lipPoll);
            };
            this.lipPollId = requestAnimationFrame(lipPoll);
            this.cleanups.push(() => {
                lipRunning = false;
                if (this.lipPollId) cancelAnimationFrame(this.lipPollId);
            });
        }

        // 11. Main fusion tick (~30fps)
        let running = true;
        const fusionTick = () => {
            if (!running) return;

            if (this.registry) {
                // Get lip result
                let lipResult = this.cachedLipResult;
                if (this.lipEngine && this.registry && !this.lipMatchPending) {
                    const candidates = this.registry.getWordCandidates(this.gazeX, this.gazeY);
                    if (candidates.length > 0) {
                        this.lipMatchPending = true;
                        const matchPromise = this.lipEngine.matchWord(candidates.map(c => c.text));
                        if (matchPromise && typeof matchPromise.then === 'function') {
                            matchPromise.then((match: any) => {
                                this.lipMatchPending = false;
                                if (match && match.word) {
                                    const matched = candidates.find(c => c.text === match.word);
                                    if (matched) {
                                        this.cachedLipResult = {
                                            wordIndex: matched.wordIndex,
                                            text: matched.text,
                                            confidence: match.confidence || 0.5,
                                        };
                                    }
                                } else {
                                    this.cachedLipResult = null;
                                }
                            }).catch(() => { this.lipMatchPending = false; });
                        } else {
                            this.lipMatchPending = false;
                        }
                    }
                }

                this.fusionEngine.processTick(
                    this.gazeX,
                    this.gazeY,
                    lipResult,
                    this.lastVoiceWordIndex,
                    this.voiceConfidence,
                    this.registry,
                );

                // Decay voice confidence quickly so stale data doesn't linger
                if (this.voiceConfidence > 0) {
                    this.voiceConfidence *= 0.80;
                    if (this.voiceConfidence < 0.05) {
                        this.voiceConfidence = 0;
                        this.lastVoiceWordIndex = null;
                    }
                }
            }

            this.fusionLoopId = requestAnimationFrame(fusionTick);
        };
        this.fusionLoopId = requestAnimationFrame(fusionTick);
        this.cleanups.push(() => {
            running = false;
            if (this.fusionLoopId) cancelAnimationFrame(this.fusionLoopId);
        });

        // Update status
        this.status.isRunning = true;
        this.emitStatus();
    }

    /**
     * Stop all services and clean up.
     */
    stop(): void {
        this.running = false;

        // Run all cleanup functions
        this.cleanups.forEach(fn => fn());
        this.cleanups = [];

        // Stop services
        speechRecognitionService.stop();
        microphoneService.stop();
        webSpeechTTSService.stop();

        // Destroy engines
        if (this.lipEngine) {
            this.lipEngine.destroy();
            this.lipEngine = null;
        }

        if (this.registry) {
            this.registry.detach();
            this.registry = null;
        }

        // Reset engines (don't destroy fusion — might want stats)
        adaptiveResponseEngine.reset();

        // Reset local state
        this.cachedLipResult = null;
        this.lipMatchPending = false;
        this.lastVoiceWordIndex = null;
        this.voiceConfidence = 0;
        this.lastLipLandmarks = null;

        this.status = {
            gazeActive: false,
            lipSyncActive: false,
            voiceActive: false,
            micActive: false,
            isRunning: false,
        };
        this.emitStatus();
    }

    // ========== SUBSCRIPTIONS ==========

    onStatusChange(cb: StatusCallback): () => void {
        this.statusListeners.push(cb);
        return () => { this.statusListeners = this.statusListeners.filter(c => c !== cb); };
    }

    onAction(cb: ActionCallback): () => void {
        this.actionListeners.push(cb);
        return () => { this.actionListeners = this.actionListeners.filter(c => c !== cb); };
    }

    onPronunciation(cb: PronunciationCallback): () => void {
        this.pronunciationListeners.push(cb);
        return () => { this.pronunciationListeners = this.pronunciationListeners.filter(c => c !== cb); };
    }

    /** Proxy to fusion engine word change events */
    onWordChange(cb: (result: FusionResult) => void): () => void {
        return this.fusionEngine.onWordChange(cb);
    }

    /** Proxy to fusion engine struggle events */
    onWordStruggle(cb: (detail: { wordIndex: number; text: string; lineIndex: number; reason: string }) => void): () => void {
        return this.fusionEngine.onWordStruggle(cb);
    }

    /** Proxy to fusion engine revisit events */
    onRevisit(cb: (event: RevisitEvent) => void): () => void {
        return this.fusionEngine.onRevisit(cb);
    }

    // ========== GETTERS ==========

    getStatus(): TrimodalStatus { return { ...this.status }; }
    getFusionEngine(): TrimodalFusionEngine { return this.fusionEngine; }
    getRegistry(): WordRegistryManager | null { return this.registry; }
    isRunning(): boolean { return this.running; }

    getReadingStats() {
        return this.fusionEngine.getReadingStats();
    }

    getPronunciationStats() {
        return pronunciationAnalyser.getSessionStats();
    }

    // ========== PRIVATE ==========

    private buildLineText(lineIndex: number): string {
        if (!this.registry) return '';
        // Gather all words on the target line
        const words: string[] = [];
        for (let i = 0; i < this.passageWords.length; i++) {
            const entry = this.registry.getWordByIndex(i);
            if (entry && entry.lineIndex === lineIndex) {
                words.push(entry.text);
            }
        }
        return words.join(' ');
    }

    private emitStatus(): void {
        const snapshot = { ...this.status };
        this.statusListeners.forEach(cb => cb(snapshot));
    }
}

export const trimodalOrchestrator = new TrimodalOrchestrator();
