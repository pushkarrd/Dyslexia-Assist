/**
 * TrimodalFusionEngine — Fuses gaze, lip-sync, and voice signals
 * into word-level reading position with revisit/pronunciation tracking.
 *
 * Signals:
 *   Gaze  (0.30) — IrisGazeEngine → WordRegistry → top candidate
 *   Lip   (0.30) — LipSyncEngine.matchWord() cached result
 *   Voice (0.40) — SpeechRecognitionService matched word index
 *
 * Temporal smoothing: 8-frame ring buffer, 5-frame commit threshold.
 * Emits: 'wordchange', 'wordstruggle', 'revisit', 'pronunciationResult'
 */

import type { WordRegistryManager, WordCandidate } from '../utils/WordRegistry';
import type { PronunciationScore } from './PronunciationAnalyser';

// ──────────── Types ────────────

export interface FusionResult {
    wordIndex: number;
    text: string;
    lineIndex: number;
    confidence: number;
    method: 'trimodal' | 'gaze+lip' | 'gaze+voice' | 'lip+voice' | 'gaze_only' | 'voice_only' | 'lip_only';
}

export interface WordVisitRecord {
    wordIndex: number;
    text: string;
    lineIndex: number;
    enterTime: number;
    exitTime: number;
    dwellMs: number;
    visitCount: number;
    pronunciationScore: PronunciationScore | null;
}

export interface RevisitEvent {
    wordIndex: number;
    text: string;
    lineIndex: number;
    visitCount: number;
    isLineRevisit: boolean;
}

type EventCallback<T> = (data: T) => void;

// ──────────── Constants ────────────

const W_GAZE = 0.45;
const W_LIP = 0.20;
const W_VOICE = 0.35;

/** Reduced from 8/5 to 4/3 for snappier response (~100ms at 30fps) */
const VOTE_WINDOW = 4;
const COMMIT_THRESHOLD = 3;
const MIN_CONFIDENCE = 0.12;
const AGREE_BOOST = 1.3;
const CONFIDENCE_CAP = 0.98;

/** When voice+gaze agree, skip the vote buffer entirely */
const FAST_TRACK_CONFIDENCE = 0.55;

/** If user re-visits after reading >= 3 words ahead, it's a revisit */
const REVISIT_GAP = 3;

// ──────────── Engine ────────────

export class TrimodalFusionEngine {
    // Current state
    private currentWord: FusionResult | null = null;
    private previousWord: FusionResult | null = null;
    private wordStartTime = 0;
    private highWaterMark = -1; // furthest wordIndex reached in forward reading

    // Temporal smoothing
    private voteBuffer: number[] = [];

    // Visit tracking
    private visitCounts = new Map<number, number>(); // wordIndex → total visits
    private visitHistory: WordVisitRecord[] = [];
    private lineVisitCounts = new Map<number, number>(); // lineIndex → visit count

    // Pronunciation integration
    private pendingPronunciationScores = new Map<number, PronunciationScore>();

    // Struggle tracking
    private struggleWords = new Set<number>();
    private rereadWords = new Map<number, number>();

    // Event listeners
    private wordChangeListeners: EventCallback<FusionResult>[] = [];
    private wordStruggleListeners: EventCallback<{ wordIndex: number; text: string; lineIndex: number; reason: string }>[] = [];
    private revisitListeners: EventCallback<RevisitEvent>[] = [];
    private pronunciationListeners: EventCallback<{ wordIndex: number; score: PronunciationScore }>[] = [];

    // ========== PUBLIC API ==========

    /**
     * Call every frame (~30fps / 10Hz).
     */
    processTick(
        gazeX: number,
        gazeY: number,
        lipResult: { wordIndex: number; text: string; confidence: number } | null,
        voiceWordIndex: number | null,
        voiceConfidence: number,
        registry: WordRegistryManager,
    ): void {
        if (!registry) return;

        // 1. Gaze candidates
        const gazeCandidates = registry.getWordCandidates(gazeX, gazeY);
        const topGaze = gazeCandidates.length > 0 ? gazeCandidates[0] : null;

        // 2. Voice lookup
        let voiceEntry: WordCandidate | null = null;
        if (voiceWordIndex !== null && voiceWordIndex >= 0) {
            const raw = registry.getWordByIndex(voiceWordIndex);
            if (raw) {
                voiceEntry = { ...raw, distance: 0, weight: voiceConfidence };
            }
        }

        // 3. Fuse
        const result = this.fuse(topGaze, lipResult, voiceEntry, voiceConfidence, gazeCandidates);
        if (!result || result.confidence < MIN_CONFIDENCE) return;

        // 4. Temporal vote — with fast-track for high-confidence multi-signal agreement
        this.voteBuffer.push(result.wordIndex);
        if (this.voteBuffer.length > VOTE_WINDOW) this.voteBuffer.shift();

        const fastTrack = result.confidence >= FAST_TRACK_CONFIDENCE &&
            (result.method === 'trimodal' || result.method === 'gaze+voice' || result.method === 'gaze+lip');

        if (!fastTrack) {
            const votes = this.voteBuffer.filter(i => i === result.wordIndex).length;
            if (votes < COMMIT_THRESHOLD) return;
        }

        // 5. Word transition
        const now = Date.now();
        if (!this.currentWord || this.currentWord.wordIndex !== result.wordIndex) {
            // Finalise previous word
            if (this.currentWord) {
                const dwellMs = now - this.wordStartTime;
                this.recordVisit(this.currentWord, dwellMs, now);
                this.checkStruggle(this.currentWord, dwellMs);
            }

            this.previousWord = this.currentWord;
            this.currentWord = result;
            this.wordStartTime = now;

            // Track visits
            const prevCount = this.visitCounts.get(result.wordIndex) || 0;
            const newCount = prevCount + 1;
            this.visitCounts.set(result.wordIndex, newCount);
            this.rereadWords.set(result.wordIndex, newCount);

            // Track line visits
            const lineCount = (this.lineVisitCounts.get(result.lineIndex) || 0) + 1;
            this.lineVisitCounts.set(result.lineIndex, lineCount);

            // Check for revisit
            const isRevisit = result.wordIndex < this.highWaterMark - REVISIT_GAP && newCount > 1;
            const isLineRevisit = lineCount > 1 && result.lineIndex < (this.previousWord?.lineIndex ?? result.lineIndex);

            if (isRevisit || isLineRevisit) {
                const revisitEvent: RevisitEvent = {
                    wordIndex: result.wordIndex,
                    text: result.text,
                    lineIndex: result.lineIndex,
                    visitCount: newCount,
                    isLineRevisit,
                };
                this.revisitListeners.forEach(cb => cb(revisitEvent));
            }

            // Update high water mark
            if (result.wordIndex > this.highWaterMark) {
                this.highWaterMark = result.wordIndex;
            }

            // Attach pending pronunciation score
            const pendingScore = this.pendingPronunciationScores.get(result.wordIndex);
            if (pendingScore) {
                this.pronunciationListeners.forEach(cb => cb({ wordIndex: result.wordIndex, score: pendingScore }));
                this.pendingPronunciationScores.delete(result.wordIndex);
            }

            // Emit word change
            this.wordChangeListeners.forEach(cb => cb(result));

            // Also dispatch DOM event for existing hooks (useWordRereadDetector)
            window.dispatchEvent(new CustomEvent('wordchange', { detail: result }));
        }
    }

    /** Store a pronunciation score for a word index */
    recordPronunciationScore(wordIndex: number, score: PronunciationScore): void {
        this.pendingPronunciationScores.set(wordIndex, score);
        this.pronunciationListeners.forEach(cb => cb({ wordIndex, score }));
    }

    // ========== SUBSCRIPTIONS ==========

    onWordChange(cb: EventCallback<FusionResult>): () => void {
        this.wordChangeListeners.push(cb);
        return () => { this.wordChangeListeners = this.wordChangeListeners.filter(c => c !== cb); };
    }

    onWordStruggle(cb: EventCallback<{ wordIndex: number; text: string; lineIndex: number; reason: string }>): () => void {
        this.wordStruggleListeners.push(cb);
        return () => { this.wordStruggleListeners = this.wordStruggleListeners.filter(c => c !== cb); };
    }

    onRevisit(cb: EventCallback<RevisitEvent>): () => void {
        this.revisitListeners.push(cb);
        return () => { this.revisitListeners = this.revisitListeners.filter(c => c !== cb); };
    }

    onPronunciationResult(cb: EventCallback<{ wordIndex: number; score: PronunciationScore }>): () => void {
        this.pronunciationListeners.push(cb);
        return () => { this.pronunciationListeners = this.pronunciationListeners.filter(c => c !== cb); };
    }

    // ========== GETTERS ==========

    getCurrentWord(): FusionResult | null { return this.currentWord; }
    getVisitHistory(): WordVisitRecord[] { return this.visitHistory; }
    getStruggleWords(): Set<number> { return this.struggleWords; }
    getRereadWords(): Map<number, number> { return this.rereadWords; }
    getHighWaterMark(): number { return this.highWaterMark; }

    getReadingStats() {
        const history = this.visitHistory;
        if (history.length === 0) {
            return { wordsRead: 0, avgDwell: 0, wpm: 0, struggleCount: 0, revisitCount: 0 };
        }

        const totalDwell = history.reduce((s, h) => s + h.dwellMs, 0);
        const elapsed = history.length >= 2
            ? (history[history.length - 1].exitTime - history[0].enterTime) / 60_000
            : 0;
        const wpm = elapsed > 0 ? Math.round(history.length / elapsed) : 0;
        const revisitCount = history.filter(h => h.visitCount > 1).length;

        return {
            wordsRead: history.length,
            avgDwell: Math.round(totalDwell / history.length),
            wpm,
            struggleCount: this.struggleWords.size,
            revisitCount,
        };
    }

    reset(): void {
        this.currentWord = null;
        this.previousWord = null;
        this.wordStartTime = 0;
        this.highWaterMark = -1;
        this.voteBuffer = [];
        this.visitCounts.clear();
        this.visitHistory = [];
        this.lineVisitCounts.clear();
        this.pendingPronunciationScores.clear();
        this.struggleWords.clear();
        this.rereadWords.clear();
    }

    destroy(): void {
        this.reset();
        this.wordChangeListeners = [];
        this.wordStruggleListeners = [];
        this.revisitListeners = [];
        this.pronunciationListeners = [];
    }

    // ========== PRIVATE ==========

    private fuse(
        topGaze: WordCandidate | null,
        lipResult: { wordIndex: number; text: string; confidence: number } | null,
        voiceEntry: WordCandidate | null,
        voiceConfidence: number,
        gazeCandidates: WordCandidate[],
    ): FusionResult | null {
        const hasGaze = topGaze && topGaze.weight > 0;
        const hasLip = lipResult && lipResult.confidence > 0;
        const hasVoice = voiceEntry && voiceConfidence > 0.2;

        // Case 1: All three agree on the same word
        if (hasGaze && hasLip && hasVoice) {
            if (topGaze!.wordIndex === lipResult!.wordIndex && topGaze!.wordIndex === voiceEntry!.wordIndex) {
                const raw = W_GAZE * topGaze!.weight + W_LIP * lipResult!.confidence + W_VOICE * voiceConfidence;
                return {
                    wordIndex: topGaze!.wordIndex,
                    text: topGaze!.text,
                    lineIndex: topGaze!.lineIndex,
                    confidence: Math.min(raw * AGREE_BOOST, CONFIDENCE_CAP),
                    method: 'trimodal',
                };
            }
            // Majority vote
            return this.majorityVote(topGaze!, lipResult!, voiceEntry!, voiceConfidence, gazeCandidates);
        }

        // Case 2: Gaze + Lip
        if (hasGaze && hasLip) {
            if (topGaze!.wordIndex === lipResult!.wordIndex) {
                const raw = W_GAZE * topGaze!.weight + W_LIP * lipResult!.confidence;
                return {
                    wordIndex: topGaze!.wordIndex,
                    text: topGaze!.text,
                    lineIndex: topGaze!.lineIndex,
                    confidence: Math.min(raw * AGREE_BOOST / (W_GAZE + W_LIP), CONFIDENCE_CAP),
                    method: 'gaze+lip',
                };
            }
            // Lip in gaze candidates? Prefer lip
            const lipCandidate = gazeCandidates.find(c => c.wordIndex === lipResult!.wordIndex);
            if (lipCandidate) {
                return {
                    wordIndex: lipResult!.wordIndex,
                    text: lipResult!.text || lipCandidate.text,
                    lineIndex: lipCandidate.lineIndex,
                    confidence: Math.min((W_GAZE * lipCandidate.weight + W_LIP * lipResult!.confidence) * AGREE_BOOST / (W_GAZE + W_LIP), CONFIDENCE_CAP),
                    method: 'gaze+lip',
                };
            }
            // Fall to gaze
        }

        // Case 3: Gaze + Voice
        if (hasGaze && hasVoice) {
            if (topGaze!.wordIndex === voiceEntry!.wordIndex) {
                const raw = W_GAZE * topGaze!.weight + W_VOICE * voiceConfidence;
                return {
                    wordIndex: topGaze!.wordIndex,
                    text: topGaze!.text,
                    lineIndex: topGaze!.lineIndex,
                    confidence: Math.min(raw * AGREE_BOOST / (W_GAZE + W_VOICE), CONFIDENCE_CAP),
                    method: 'gaze+voice',
                };
            }
        }

        // Case 4: Lip + Voice
        if (hasLip && hasVoice) {
            if (lipResult!.wordIndex === voiceEntry!.wordIndex) {
                const raw = W_LIP * lipResult!.confidence + W_VOICE * voiceConfidence;
                return {
                    wordIndex: voiceEntry!.wordIndex,
                    text: voiceEntry!.text,
                    lineIndex: voiceEntry!.lineIndex,
                    confidence: Math.min(raw * AGREE_BOOST / (W_LIP + W_VOICE), CONFIDENCE_CAP),
                    method: 'lip+voice',
                };
            }
        }

        // Case 5: Voice only (highest weight)
        if (hasVoice && voiceConfidence > 0.4) {
            return {
                wordIndex: voiceEntry!.wordIndex,
                text: voiceEntry!.text,
                lineIndex: voiceEntry!.lineIndex,
                confidence: voiceConfidence * W_VOICE,
                method: 'voice_only',
            };
        }

        // Case 6: Gaze only
        if (hasGaze) {
            return {
                wordIndex: topGaze!.wordIndex,
                text: topGaze!.text,
                lineIndex: topGaze!.lineIndex,
                confidence: topGaze!.weight * W_GAZE,
                method: 'gaze_only',
            };
        }

        // Case 7: Lip only
        if (hasLip && lipResult!.confidence > 0.4) {
            return {
                wordIndex: lipResult!.wordIndex,
                text: lipResult!.text || '',
                lineIndex: -1,
                confidence: lipResult!.confidence * W_LIP,
                method: 'lip_only',
            };
        }

        return null;
    }

    private majorityVote(
        gaze: WordCandidate,
        lip: { wordIndex: number; text: string; confidence: number },
        voice: WordCandidate,
        voiceConf: number,
        gazeCandidates: WordCandidate[],
    ): FusionResult {
        // Count agreements
        const votes = new Map<number, { count: number; totalConf: number; text: string; lineIndex: number }>();

        const addVote = (idx: number, conf: number, text: string, line: number) => {
            const v = votes.get(idx) || { count: 0, totalConf: 0, text, lineIndex: line };
            v.count++;
            v.totalConf += conf;
            votes.set(idx, v);
        };

        addVote(gaze.wordIndex, gaze.weight * W_GAZE, gaze.text, gaze.lineIndex);
        addVote(lip.wordIndex, lip.confidence * W_LIP, lip.text || '', gazeCandidates.find(c => c.wordIndex === lip.wordIndex)?.lineIndex ?? -1);
        addVote(voice.wordIndex, voiceConf * W_VOICE, voice.text, voice.lineIndex);

        // Pick the one with most votes, tie-break by confidence
        let best = { idx: gaze.wordIndex, count: 0, conf: 0, text: '', line: -1 };
        for (const [idx, v] of votes) {
            if (v.count > best.count || (v.count === best.count && v.totalConf > best.conf)) {
                best = { idx, count: v.count, conf: v.totalConf, text: v.text, line: v.lineIndex };
            }
        }

        return {
            wordIndex: best.idx,
            text: best.text,
            lineIndex: best.line,
            confidence: Math.min(best.conf * (best.count >= 2 ? AGREE_BOOST : 1), CONFIDENCE_CAP),
            method: best.count >= 2 ? 'trimodal' : 'gaze_only',
        };
    }

    private recordVisit(word: FusionResult, dwellMs: number, exitTime: number): void {
        const visitCount = this.visitCounts.get(word.wordIndex) || 1;
        this.visitHistory.push({
            wordIndex: word.wordIndex,
            text: word.text,
            lineIndex: word.lineIndex,
            enterTime: this.wordStartTime,
            exitTime,
            dwellMs,
            visitCount,
            pronunciationScore: this.pendingPronunciationScores.get(word.wordIndex) || null,
        });
    }

    private checkStruggle(word: FusionResult, dwellMs: number): void {
        const STRUGGLE_DWELL_MS = 3000;
        const STRUGGLE_VISIT_THRESHOLD = 3;

        const visitCount = this.visitCounts.get(word.wordIndex) || 0;
        const isStruggle = dwellMs > STRUGGLE_DWELL_MS || visitCount >= STRUGGLE_VISIT_THRESHOLD;

        if (isStruggle && !this.struggleWords.has(word.wordIndex)) {
            this.struggleWords.add(word.wordIndex);
            const detail = {
                wordIndex: word.wordIndex,
                text: word.text,
                lineIndex: word.lineIndex,
                reason: dwellMs > STRUGGLE_DWELL_MS ? 'long_dwell' : 'many_revisits',
            };
            this.wordStruggleListeners.forEach(cb => cb(detail));
            window.dispatchEvent(new CustomEvent('wordstruggle', { detail }));
        }
    }
}

export const trimodalFusionEngine = new TrimodalFusionEngine();
