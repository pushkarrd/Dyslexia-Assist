/**
 * AdaptiveResponseEngine — Reacts to reading difficulty signals
 * by adjusting TTS speed, font size, and showing phonetic hints.
 *
 * Triggers:
 *   Word Revisit  → TTS at 0.5x + font +2px + phonetic hint for 5s
 *   Line Revisit  → Sentence TTS at 0.5x + font +2px on that line
 *   Pronunciation  → TTS at 0.7x + phonetic hint for 4s
 *
 * Constraints:
 *   Max cumulative font boost: +8px
 *   Cooldowns: 15s per word, 20s per line
 */

import type { RevisitEvent } from './TrimodalFusionEngine';
import type { PronunciationScore } from './PronunciationAnalyser';

// ──────────── Types ────────────

export interface AdaptiveAction {
    type: 'word_tts' | 'sentence_tts' | 'font_boost' | 'phonetic_hint' | 'highlight';
    wordIndex: number;
    lineIndex: number;
    text: string;
    ttsRate?: number;
    fontBoostPx?: number;
    hintText?: string;
    hintDurationMs?: number;
    timestamp: number;
}

export type ActionCallback = (action: AdaptiveAction) => void;

// ──────────── Constants ────────────

const WORD_COOLDOWN_MS = 15_000;
const LINE_COOLDOWN_MS = 20_000;
const MAX_FONT_BOOST_PX = 8;
const BASE_FONT_BOOST_PX = 2;

const TTS_RATE_REVISIT = 0.5;
const TTS_RATE_PRONUNCIATION = 0.7;

const HINT_DURATION_REVISIT_MS = 5_000;
const HINT_DURATION_PRONUNCIATION_MS = 4_000;

// ──────────── Engine ────────────

class AdaptiveResponseEngine {
    private wordCooldowns = new Map<number, number>(); // wordIndex → lastActionTimestamp
    private lineCooldowns = new Map<number, number>(); // lineIndex → lastActionTimestamp
    private currentFontBoost = 0;
    private actionListeners: ActionCallback[] = [];
    private actionHistory: AdaptiveAction[] = [];

    // ========== PUBLIC API ==========

    /**
     * Handle a word or line revisit event from the TrimodalFusionEngine.
     */
    handleRevisit(event: RevisitEvent, sentenceText?: string): void {
        const now = Date.now();

        if (event.isLineRevisit) {
            // Line revisit: sentence TTS + font boost
            if (this.isLineCoolingDown(event.lineIndex, now)) return;
            this.lineCooldowns.set(event.lineIndex, now);

            const textToSpeak = sentenceText || event.text;
            this.emitAction({
                type: 'sentence_tts',
                wordIndex: event.wordIndex,
                lineIndex: event.lineIndex,
                text: textToSpeak,
                ttsRate: TTS_RATE_REVISIT,
                timestamp: now,
            });

            this.applyFontBoost(event.wordIndex, event.lineIndex, now);
        } else {
            // Word revisit: TTS + font boost + phonetic hint
            if (this.isWordCoolingDown(event.wordIndex, now)) return;
            this.wordCooldowns.set(event.wordIndex, now);

            this.emitAction({
                type: 'word_tts',
                wordIndex: event.wordIndex,
                lineIndex: event.lineIndex,
                text: event.text,
                ttsRate: TTS_RATE_REVISIT,
                timestamp: now,
            });

            this.applyFontBoost(event.wordIndex, event.lineIndex, now);

            this.emitAction({
                type: 'phonetic_hint',
                wordIndex: event.wordIndex,
                lineIndex: event.lineIndex,
                text: event.text,
                hintDurationMs: HINT_DURATION_REVISIT_MS,
                timestamp: now,
            });
        }
    }

    /**
     * Handle a pronunciation error from the PronunciationAnalyser.
     */
    handlePronunciationError(
        wordIndex: number,
        lineIndex: number,
        score: PronunciationScore,
    ): void {
        if (score.isCorrect) return;

        const now = Date.now();
        if (this.isWordCoolingDown(wordIndex, now)) return;
        this.wordCooldowns.set(wordIndex, now);

        // TTS the word slowly
        this.emitAction({
            type: 'word_tts',
            wordIndex,
            lineIndex,
            text: score.targetWord,
            ttsRate: TTS_RATE_PRONUNCIATION,
            timestamp: now,
        });

        // Phonetic hint
        this.emitAction({
            type: 'phonetic_hint',
            wordIndex,
            lineIndex,
            text: score.targetWord,
            hintText: score.phoneticTarget,
            hintDurationMs: HINT_DURATION_PRONUNCIATION_MS,
            timestamp: now,
        });
    }

    // ========== SUBSCRIPTIONS ==========

    onAction(cb: ActionCallback): () => void {
        this.actionListeners.push(cb);
        return () => {
            this.actionListeners = this.actionListeners.filter(c => c !== cb);
        };
    }

    // ========== GETTERS ==========

    getCurrentFontBoost(): number {
        return this.currentFontBoost;
    }

    getActionHistory(): AdaptiveAction[] {
        return this.actionHistory;
    }

    // ========== RESET ==========

    reset(): void {
        this.wordCooldowns.clear();
        this.lineCooldowns.clear();
        this.currentFontBoost = 0;
        this.actionHistory = [];
    }

    destroy(): void {
        this.reset();
        this.actionListeners = [];
    }

    // ========== PRIVATE ==========

    private isWordCoolingDown(wordIndex: number, now: number): boolean {
        const last = this.wordCooldowns.get(wordIndex);
        return last !== undefined && now - last < WORD_COOLDOWN_MS;
    }

    private isLineCoolingDown(lineIndex: number, now: number): boolean {
        const last = this.lineCooldowns.get(lineIndex);
        return last !== undefined && now - last < LINE_COOLDOWN_MS;
    }

    private applyFontBoost(wordIndex: number, lineIndex: number, now: number): void {
        if (this.currentFontBoost >= MAX_FONT_BOOST_PX) return;
        this.currentFontBoost = Math.min(this.currentFontBoost + BASE_FONT_BOOST_PX, MAX_FONT_BOOST_PX);

        this.emitAction({
            type: 'font_boost',
            wordIndex,
            lineIndex,
            text: '',
            fontBoostPx: this.currentFontBoost,
            timestamp: now,
        });
    }

    private emitAction(action: AdaptiveAction): void {
        this.actionHistory.push(action);
        this.actionListeners.forEach(cb => cb(action));
    }
}

export const adaptiveResponseEngine = new AdaptiveResponseEngine();
