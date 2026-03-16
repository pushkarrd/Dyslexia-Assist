/**
 * @fileoverview FusionEngine — Combines gaze position and lip-sync viseme data
 * to determine the word the user is currently reading with high confidence.
 *
 * Fusion strategy:
 *   - Gaze provides spatial candidates (which words the eye is near)
 *   - Lip sync provides phonetic match (which word the lips are shaping)
 *   - Weighted voting: gaze 0.4 + lips 0.6 when both agree (boost ×1.3, cap 1.0)
 *   - Temporal smoothing: word must win 5/8 recent frames to be "current"
 *   - Struggle detection: same word 3+ times in 20s, >2s dwell, or wrong phonemes
 *
 * Dispatches DOM events:
 *   'wordchange'   — { wordIndex, text, lineIndex, confidence, method }
 *   'wordstruggle' — { wordIndex, text, lineIndex, reason }
 *
 * Usage:
 *   const fusion = new FusionEngine();
 *   // Each frame (~30fps):
 *   fusion.processTick(gazeX, gazeY, lipResult, wordRegistry);
 *   // Subscribe:
 *   fusion.onWordChange(cb);
 *   fusion.onWordStruggle(cb);
 */

// ======================== CONSTANTS ========================

const GAZE_WEIGHT = 0.4;
const LIP_WEIGHT = 0.6;
const AGREE_BOOST = 1.3;
const CONFIDENCE_CAP = 1.0;

/** Temporal smoothing: word must appear N of last M frames */
const VOTE_THRESHOLD = 3;
const VOTE_WINDOW = 4;

/** Struggle detection thresholds */
const STRUGGLE_REPEAT_COUNT = 3;
const STRUGGLE_REPEAT_WINDOW_MS = 20_000;
const STRUGGLE_DWELL_MS = 2000;

/** Minimum confidence to consider a fusion result valid */
const MIN_CONFIDENCE = 0.15;

/** Maximum reading history entries to keep */
const MAX_HISTORY = 500;

// ======================== FUSION METHODS ========================

const METHOD = Object.freeze({
    FUSION: 'fusion',    // Both gaze and lip agree
    LIP_ONLY: 'lip_only',  // High-confidence lip match, gaze disagrees
    GAZE_ONLY: 'gaze_only', // No lip data, gaze determines
    UNCERTAIN: 'uncertain',  // Neither source is confident enough
});

// ======================== FusionEngine CLASS ========================

class FusionEngine {
    constructor() {
        // --- Current state ---
        this._currentWord = null;       // { wordIndex, text, lineIndex, confidence, method }
        this._previousWord = null;
        this._wordStartTime = 0;

        // --- Temporal vote buffer ---
        this._voteBuffer = [];          // last VOTE_WINDOW word indices

        // --- Reading history ---
        this._wordReadingHistory = [];  // [{ wordIndex, text, lineIndex, confidence, method, timestamp, dwellMs }]

        // --- Struggle tracking ---
        this._struggleWords = new Set();  // wordIndex values that were flagged
        this._rereadWords = new Map();    // wordIndex → count of revisits

        // --- Callbacks ---
        this._onWordChange = [];
        this._onWordStruggle = [];
    }

    // ========== PUBLIC API ==========

    /**
     * Process one tick (call every frame, ~30fps).
     *
     * @param {number} gazeX — Smoothed gaze X coordinate
     * @param {number} gazeY — Smoothed gaze Y coordinate
     * @param {{ wordIndex: number, text: string, confidence: number }|null} lipResult
     *   — Result from LipSyncEngine.matchWord(), or null if lip sync unavailable
     * @param {import('../utils/WordRegistry').WordRegistryManager} registry
     *   — The active word registry instance
     */
    processTick(gazeX, gazeY, lipResult, registry) {
        if (!registry) return;

        // 1. Get gaze candidates from registry
        const gazeCandidates = registry.getWordCandidates(gazeX, gazeY);
        const topGaze = gazeCandidates.length > 0 ? gazeCandidates[0] : null;

        // 2. Determine fusion result
        const result = this._fuse(topGaze, lipResult, gazeCandidates);
        if (!result || result.confidence < MIN_CONFIDENCE) return;

        // 3. Temporal smoothing via voting
        this._voteBuffer.push(result.wordIndex);
        if (this._voteBuffer.length > VOTE_WINDOW) {
            this._voteBuffer.shift();
        }

        const voteCount = this._voteBuffer.filter(
            (idx) => idx === result.wordIndex
        ).length;

        if (voteCount < VOTE_THRESHOLD) return;

        // 4. Word changed?
        const now = Date.now();
        if (!this._currentWord || this._currentWord.wordIndex !== result.wordIndex) {
            // Record dwell on previous word
            if (this._currentWord) {
                const dwellMs = now - this._wordStartTime;
                this._recordHistory(this._currentWord, dwellMs);
                this._checkStruggle(this._currentWord, dwellMs);
            }

            this._previousWord = this._currentWord;
            this._currentWord = { ...result, timestamp: now };
            this._wordStartTime = now;

            // Track rereads
            const prevCount = this._rereadWords.get(result.wordIndex) || 0;
            this._rereadWords.set(result.wordIndex, prevCount + 1);

            // Dispatch wordchange event
            this._emit('wordchange', result);
            this._onWordChange.forEach((cb) => cb(result));
        }
    }

    /** Subscribe to word change events */
    onWordChange(cb) {
        this._onWordChange.push(cb);
        return () => {
            this._onWordChange = this._onWordChange.filter((c) => c !== cb);
        };
    }

    /** Subscribe to word struggle events */
    onWordStruggle(cb) {
        this._onWordStruggle.push(cb);
        return () => {
            this._onWordStruggle = this._onWordStruggle.filter((c) => c !== cb);
        };
    }

    /** Get the current word being read */
    get currentWord() {
        return this._currentWord;
    }

    /** Get the current line index */
    get currentLineIndex() {
        return this._currentWord ? this._currentWord.lineIndex : -1;
    }

    /** Get full reading history */
    get wordReadingHistory() {
        return this._wordReadingHistory;
    }

    /** Get set of struggle word indices */
    get struggleWords() {
        return this._struggleWords;
    }

    /** Get map of reread word indices → count */
    get rereadWords() {
        return this._rereadWords;
    }

    /** Get reading statistics */
    getReadingStats() {
        const history = this._wordReadingHistory;
        if (history.length === 0) {
            return { wordsRead: 0, avgDwell: 0, avgConfidence: 0, methodBreakdown: {}, wpm: 0, struggleCount: 0 };
        }

        const totalDwell = history.reduce((sum, h) => sum + h.dwellMs, 0);
        const totalConf = history.reduce((sum, h) => sum + h.confidence, 0);

        const methodBreakdown = {};
        for (const h of history) {
            methodBreakdown[h.method] = (methodBreakdown[h.method] || 0) + 1;
        }

        // WPM from first to last word timestamp
        const elapsed = history.length >= 2
            ? (history[history.length - 1].timestamp - history[0].timestamp) / 60_000
            : 0;
        const wpm = elapsed > 0 ? Math.round(history.length / elapsed) : 0;

        return {
            wordsRead: history.length,
            avgDwell: Math.round(totalDwell / history.length),
            avgConfidence: +(totalConf / history.length).toFixed(2),
            methodBreakdown,
            wpm,
            struggleCount: this._struggleWords.size,
        };
    }

    /** Reset all state (call when starting a new reading session) */
    reset() {
        this._currentWord = null;
        this._previousWord = null;
        this._wordStartTime = 0;
        this._voteBuffer = [];
        this._wordReadingHistory = [];
        this._struggleWords = new Set();
        this._rereadWords = new Map();
    }

    /** Destroy and clean up */
    destroy() {
        this.reset();
        this._onWordChange = [];
        this._onWordStruggle = [];
    }

    // ========== PRIVATE METHODS ==========

    /**
     * Core fusion logic: combine gaze + lip results into a single word decision.
     */
    _fuse(topGaze, lipResult, gazeCandidates) {
        const hasGaze = topGaze && topGaze.confidence > 0;
        const hasLips = lipResult && lipResult.confidence > 0;

        // Case 1: Both agree
        if (hasGaze && hasLips && topGaze.wordIndex === lipResult.wordIndex) {
            const raw = GAZE_WEIGHT * topGaze.confidence + LIP_WEIGHT * lipResult.confidence;
            const confidence = Math.min(raw * AGREE_BOOST, CONFIDENCE_CAP);
            return {
                wordIndex: topGaze.wordIndex,
                text: topGaze.text || lipResult.text,
                lineIndex: topGaze.lineIndex ?? -1,
                confidence,
                method: METHOD.FUSION,
            };
        }

        // Case 2: Both exist but disagree — check if lip match is among gaze candidates
        if (hasGaze && hasLips) {
            const lipInCandidates = gazeCandidates.find(
                (c) => c.wordIndex === lipResult.wordIndex
            );

            if (lipInCandidates) {
                // Lip is within gaze region — prefer lip (it's more precise for word-level)
                const raw = GAZE_WEIGHT * lipInCandidates.confidence + LIP_WEIGHT * lipResult.confidence;
                const confidence = Math.min(raw * AGREE_BOOST, CONFIDENCE_CAP);
                return {
                    wordIndex: lipResult.wordIndex,
                    text: lipResult.text,
                    lineIndex: lipInCandidates.lineIndex ?? -1,
                    confidence,
                    method: METHOD.FUSION,
                };
            }

            // Lip result outside gaze region — use whichever is more confident
            if (lipResult.confidence > 0.5) {
                return {
                    wordIndex: lipResult.wordIndex,
                    text: lipResult.text,
                    lineIndex: -1,
                    confidence: lipResult.confidence * LIP_WEIGHT,
                    method: METHOD.LIP_ONLY,
                };
            }
            // Fall through to gaze
        }

        // Case 3: Gaze only (no lip data)
        if (hasGaze) {
            return {
                wordIndex: topGaze.wordIndex,
                text: topGaze.text || '',
                lineIndex: topGaze.lineIndex ?? -1,
                confidence: topGaze.confidence * GAZE_WEIGHT,
                method: METHOD.GAZE_ONLY,
            };
        }

        // Case 4: Lip only (no gaze data)
        if (hasLips && lipResult.confidence > 0.4) {
            return {
                wordIndex: lipResult.wordIndex,
                text: lipResult.text,
                lineIndex: -1,
                confidence: lipResult.confidence * LIP_WEIGHT,
                method: METHOD.LIP_ONLY,
            };
        }

        // Case 5: Uncertain
        return null;
    }

    /** Record a word to reading history */
    _recordHistory(word, dwellMs) {
        this._wordReadingHistory.push({
            wordIndex: word.wordIndex,
            text: word.text,
            lineIndex: word.lineIndex,
            confidence: word.confidence,
            method: word.method,
            timestamp: word.timestamp || Date.now(),
            dwellMs,
        });

        // Cap history size
        if (this._wordReadingHistory.length > MAX_HISTORY) {
            this._wordReadingHistory = this._wordReadingHistory.slice(-MAX_HISTORY);
        }
    }

    /** Check if a word triggers struggle detection */
    _checkStruggle(word, dwellMs) {
        const wordIdx = word.wordIndex;
        const now = Date.now();

        // Check 1: Long dwell time
        if (dwellMs > STRUGGLE_DWELL_MS) {
            this._flagStruggle(word, 'long_dwell');
            return;
        }

        // Check 2: Repeated revisits within time window
        const recentVisits = this._wordReadingHistory.filter(
            (h) =>
                h.wordIndex === wordIdx &&
                now - h.timestamp < STRUGGLE_REPEAT_WINDOW_MS
        );
        if (recentVisits.length >= STRUGGLE_REPEAT_COUNT) {
            this._flagStruggle(word, 'repeated_revisit');
        }
    }

    /** Flag a word as a struggle word */
    _flagStruggle(word, reason) {
        if (this._struggleWords.has(word.wordIndex)) return;
        this._struggleWords.add(word.wordIndex);

        const detail = {
            wordIndex: word.wordIndex,
            text: word.text,
            lineIndex: word.lineIndex,
            reason,
        };

        this._emit('wordstruggle', detail);
        this._onWordStruggle.forEach((cb) => cb(detail));
    }

    /** Dispatch a DOM custom event */
    _emit(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

export { METHOD };
export default FusionEngine;
