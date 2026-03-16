/**
 * @fileoverview LipSyncEngine — Reads lip landmark data from MediaPipe FaceMesh
 * and classifies lip shapes into visemes (visual phoneme representations) in
 * real time for word-level reading tracking.
 *
 * Parts:
 *   A — Landmark extraction and measurement computation
 *   B — Viseme classification (15 classes, rule-based)
 *   C — Sequence buffer and debouncing (60-frame ring buffer)
 *   D — Sub-vocalization detection
 *   E — Reading speed measurement
 *   F — Word matching from viseme sequence
 *
 * Usage:
 *   const engine = new LipSyncEngine();
 *   // In your FaceMesh callback:
 *   engine.processFrame(landmarks);
 *   // To match a word from gaze candidates:
 *   const match = await engine.matchWord(["fox", "brown", "jumps"]);
 */

// ======================== VISEME CLASSES ========================

export const VISEME = Object.freeze({
    CLOSED: 'CLOSED',
    BILABIAL: 'BILABIAL',
    LABIODENTAL: 'LABIODENTAL',
    DENTAL: 'DENTAL',
    ALVEOLAR: 'ALVEOLAR',
    WIDE_OPEN: 'WIDE_OPEN',
    OPEN_ROUND: 'OPEN_ROUND',
    NARROW_WIDE: 'NARROW_WIDE',
    ROUNDED_CLOSE: 'ROUNDED_CLOSE',
    RETROFLEX: 'RETROFLEX',
    NASAL: 'NASAL',
    AFFRICATE: 'AFFRICATE',
    FRICATIVE: 'FRICATIVE',
    SCHWA: 'SCHWA',
    LATERAL: 'LATERAL',
});

// ======================== LANDMARK INDICES ========================

/** MediaPipe FaceMesh landmark indices relevant to lip tracking */
const LIP = {
    UPPER_OUTER: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    LOWER_OUTER: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
    UPPER_INNER: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
    LOWER_INNER: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
    LEFT_CORNER: 61,
    RIGHT_CORNER: 291,
    INNER_TOP: 13,
    INNER_BOTTOM: 14,
    FACE_LEFT: 234,
    FACE_RIGHT: 454,
    FOREHEAD: 10,
    CHIN: 152,
};

/** Ordered inner-mouth polygon for Shoelace area calculation */
const INNER_MOUTH_LOOP = [
    // Upper inner lip: left corner → right corner
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
    // Lower inner lip: right corner → left corner (reversed)
    324, 318, 402, 317, 14, 87, 178, 88, 95,
];

// ======================== ARPABET → VISEME MAP ========================

const ARPABET_TO_VISEME = {
    // Stops / nasals
    P: 'BILABIAL', B: 'BILABIAL', M: 'BILABIAL',
    T: 'ALVEOLAR', D: 'ALVEOLAR', N: 'ALVEOLAR',
    K: 'ALVEOLAR', G: 'ALVEOLAR',
    NG: 'NASAL',
    // Fricatives
    F: 'LABIODENTAL', V: 'LABIODENTAL',
    TH: 'DENTAL', DH: 'DENTAL',
    S: 'ALVEOLAR', Z: 'ALVEOLAR',
    SH: 'FRICATIVE', ZH: 'FRICATIVE', HH: 'FRICATIVE',
    // Affricates
    CH: 'AFFRICATE', JH: 'AFFRICATE',
    // Approximants
    L: 'LATERAL',
    R: 'RETROFLEX',
    W: 'ROUNDED_CLOSE',
    Y: 'NARROW_WIDE',
    // Vowels
    AA: 'WIDE_OPEN',
    AE: 'WIDE_OPEN',
    AH: 'WIDE_OPEN',     // AH with stress 0 is overridden to SCHWA below
    AO: 'OPEN_ROUND',
    AW: 'WIDE_OPEN',     // diphthong — starts open
    AY: 'WIDE_OPEN',     // diphthong — starts open
    EH: 'NARROW_WIDE',
    ER: 'RETROFLEX',
    EY: 'NARROW_WIDE',   // diphthong — starts narrow
    IH: 'NARROW_WIDE',
    IY: 'NARROW_WIDE',
    OW: 'OPEN_ROUND',    // diphthong — starts round
    OY: 'OPEN_ROUND',    // diphthong — starts round
    UH: 'ROUNDED_CLOSE',
    UW: 'ROUNDED_CLOSE',
};

// ======================== TIMING CONSTANTS ========================

/** Ring buffer size — 60 frames ≈ 2 seconds at 30 fps */
const BUFFER_SIZE = 60;

/** A viseme must persist this long before it registers (ms) */
const DEBOUNCE_MS = 80;

/** CLOSED shorter than this is a brief pause within a word (ms) */
const CLOSED_PAUSE_MAX_MS = 150;

/** CLOSED longer than this is a word boundary (ms) */
const CLOSED_BOUNDARY_MS = 400;

/** Number of past MAR values kept for affricate detection */
const MAR_HISTORY_LEN = 3;

/** MAR delta threshold (within MAR_HISTORY_LEN frames) for AFFRICATE */
const AFFRICATE_MAR_DELTA = 0.15;

// ======================== MATH HELPERS ========================

/** Euclidean 2-D distance between two {x, y} landmark objects */
function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/** Average Y coordinate of a subset of landmarks */
function avgY(landmarks, indices) {
    let sum = 0;
    for (let k = 0; k < indices.length; k++) sum += landmarks[indices[k]].y;
    return sum / indices.length;
}

/** Polygon area via Shoelace formula given an ordered array of {x, y} points */
function shoelaceArea(pts) {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) * 0.5;
}

/** Levenshtein edit distance between two string arrays */
function editDistance(a, b) {
    const m = a.length;
    const n = b.length;
    // Use two-row optimisation for memory efficiency
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,         // deletion
                curr[j - 1] + 1,     // insertion
                prev[j - 1] + cost,  // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

/**
 * Map a single ARPAbet phoneme string (e.g. "AH0", "TH") to a viseme class.
 * Unstressed AH (AH0) is treated as SCHWA.
 */
function arpabetToViseme(phoneme) {
    if (phoneme === 'AH0') return VISEME.SCHWA;
    const bare = phoneme.replace(/[012]$/, '');
    return ARPABET_TO_VISEME[bare] || VISEME.SCHWA;
}

// ======================== LIP SYNC ENGINE ========================

class LipSyncEngine {
    constructor() {
        // ---------- Public readable state ----------
        /** Current stable viseme after debouncing */
        this.currentViseme = VISEME.CLOSED;
        /** Last ~2 seconds of viseme labels */
        this.visemeHistory = [];
        /** Whether the user appears to be silently mouthing words */
        this.isSubvocalizing = false;
        /** Rolling average words-per-minute from lip boundaries */
        this.readingSpeedWPM = 0;

        // ---------- Ring buffer ----------
        this._buf = new Array(BUFFER_SIZE);
        for (let i = 0; i < BUFFER_SIZE; i++) this._buf[i] = { viseme: VISEME.CLOSED, ts: 0 };
        this._bIdx = 0;

        // ---------- Debouncing ----------
        this._stableViseme = VISEME.CLOSED;
        this._pendingViseme = null;
        this._pendingTs = 0;

        // ---------- CLOSED-state duration tracking ----------
        this._closedStart = 0;
        this._inClosed = false;

        // ---------- MAR history (for AFFRICATE detection) ----------
        this._marHist = [];

        // ---------- Word boundary / reading speed ----------
        this._wordBoundaryTs = [];
        this._wordCount = 0;
        this._rollingWPMs = [];

        // ---------- Phoneme dictionary (lazy) ----------
        this._dict = null;
        this._g2p = null;
        this._dictPromise = null;

        // ---------- Callbacks ----------
        this._cbViseme = [];
        this._cbWordBoundary = [];
    }

    // ============================================================
    //  PART A — LANDMARK EXTRACTION
    // ============================================================

    /**
     * Compute 5 normalised lip measurements from a FaceMesh landmark array.
     * @param {Array<{x:number,y:number,z:number}>} lm — 468+ landmarks
     * @returns {object|null} measurements, or null if face too small
     */
    _measure(lm) {
        const faceW = dist(lm[LIP.FACE_LEFT], lm[LIP.FACE_RIGHT]);
        const faceH = dist(lm[LIP.FOREHEAD], lm[LIP.CHIN]);
        if (faceW < 0.001 || faceH < 0.001) return null;

        // 1. MAR — Mouth Aspect Ratio
        const mouthH = dist(lm[LIP.INNER_TOP], lm[LIP.INNER_BOTTOM]);
        const mouthW = dist(lm[LIP.LEFT_CORNER], lm[LIP.RIGHT_CORNER]);
        const mar = mouthW > 0.001 ? mouthH / mouthW : 0;

        // 2. LipCornerDist — mouth width relative to face width
        const lipCornerDist = mouthW / faceW;

        // 3. UpperLipCurl — inner top lip vs average upper outer lip Y
        const upperOuterAvgY = avgY(lm, LIP.UPPER_OUTER);
        const upperLipCurl = (lm[LIP.INNER_TOP].y - upperOuterAvgY) / faceH;

        // 4. LowerLipDrop — average lower outer lip Y vs inner bottom lip
        const lowerOuterAvgY = avgY(lm, LIP.LOWER_OUTER);
        const lowerLipDrop = (lowerOuterAvgY - lm[LIP.INNER_BOTTOM].y) / faceH;

        // 5. MouthArea — Shoelace area of inner mouth polygon, normalised
        const innerPts = INNER_MOUTH_LOOP.map((idx) => lm[idx]);
        const mouthArea = shoelaceArea(innerPts) / (faceW * faceW);

        // Auxiliary: lip asymmetry (for LATERAL)
        const lipAsymmetry =
            Math.abs(lm[LIP.LEFT_CORNER].y - lm[LIP.RIGHT_CORNER].y) / faceH;

        return { mar, lipCornerDist, upperLipCurl, lowerLipDrop, mouthArea, lipAsymmetry };
    }

    // ============================================================
    //  PART B — VISEME CLASSIFICATION
    // ============================================================

    /**
     * Classify a set of measurements into one of 15 viseme classes.
     * Uses ordered threshold rules — no ML model.
     * @param {object|null} m — measurements from _measure()
     * @returns {string} viseme label
     */
    _classify(m) {
        if (!m) return VISEME.CLOSED;

        const { mar, lipCornerDist, upperLipCurl, lowerLipDrop, mouthArea, lipAsymmetry } = m;

        // --- AFFRICATE: rapid MAR change within recent frames ---
        this._marHist.push(mar);
        if (this._marHist.length > MAR_HISTORY_LEN) this._marHist.shift();
        if (this._marHist.length >= MAR_HISTORY_LEN) {
            const delta = Math.abs(this._marHist[this._marHist.length - 1] - this._marHist[0]);
            if (delta > AFFRICATE_MAR_DELTA) return VISEME.AFFRICATE;
        }

        // --- LATERAL: one lip corner significantly higher than the other ---
        if (lipAsymmetry > 0.05 && mar > 0.03) return VISEME.LATERAL;

        // --- CLOSED ---
        if (mar < 0.02) return VISEME.CLOSED;

        // --- NASAL (very slight opening, lips almost closed) ---
        if (mar < 0.03) return VISEME.NASAL;

        // --- BILABIAL (lips pressed together or barely apart, narrow) ---
        if (mar < 0.05 && lipCornerDist < 0.32) return VISEME.BILABIAL;

        // --- WIDE_OPEN ---
        if (mar > 0.35) return VISEME.WIDE_OPEN;

        // --- OPEN_ROUND (moderate opening, rounded shape) ---
        if (mar >= 0.20 && mar <= 0.35 && lipCornerDist < 0.36) return VISEME.OPEN_ROUND;

        // --- ROUNDED_CLOSE (pursed / protruding lips, moderate opening) ---
        if (lipCornerDist < 0.28 && mar >= 0.08 && mar <= 0.18) return VISEME.ROUNDED_CLOSE;

        // --- LABIODENTAL (upper lip curled, slight opening) ---
        if (upperLipCurl > 0.35 && mar < 0.12) return VISEME.LABIODENTAL;

        // --- RETROFLEX (tongue-back indicator, upper lip pulled back) ---
        if (upperLipCurl < -0.1 && mar >= 0.05 && mar <= 0.2) return VISEME.RETROFLEX;

        // --- DENTAL (wide-stretched, very small opening) ---
        if (mar < 0.08 && lipCornerDist > 0.38) return VISEME.DENTAL;

        // --- FRICATIVE (tiny opening, teeth partially visible) ---
        if (mar >= 0.02 && mar <= 0.07 && lipCornerDist > 0.34) return VISEME.FRICATIVE;

        // --- NARROW_WIDE (stretched wide, small-to-moderate opening) ---
        if (mar >= 0.05 && mar <= 0.15 && lipCornerDist > 0.42) return VISEME.NARROW_WIDE;

        // --- ALVEOLAR (small opening, moderately wide) ---
        if (mar >= 0.03 && mar <= 0.10 && lipCornerDist > 0.35) return VISEME.ALVEOLAR;

        // --- SCHWA (neutral / default) ---
        return VISEME.SCHWA;
    }

    // ============================================================
    //  PART C — SEQUENCE BUFFER & DEBOUNCING
    // ============================================================

    /**
     * Write viseme to ring buffer and apply debouncing logic.
     * Emits visemeChange callbacks and detects word boundaries.
     * @param {string} raw — raw (pre-debounce) viseme from _classify()
     * @param {number} ts  — performance.now() timestamp
     */
    _buffer(raw, ts) {
        // Write into ring buffer
        this._buf[this._bIdx] = { viseme: raw, ts };
        this._bIdx = (this._bIdx + 1) % BUFFER_SIZE;

        // Rebuild visemeHistory (entries within last 2 s)
        const cutoff = ts - 2000;
        this.visemeHistory = [];
        for (let i = 0; i < BUFFER_SIZE; i++) {
            const entry = this._buf[i];
            if (entry.ts > cutoff) this.visemeHistory.push(entry.viseme);
        }

        // ----- Debouncing -----
        if (raw !== this._pendingViseme) {
            this._pendingViseme = raw;
            this._pendingTs = ts;
            return;
        }

        // Pending viseme held long enough?
        if (this._pendingViseme === this._stableViseme) return;
        if (ts - this._pendingTs < DEBOUNCE_MS) return;

        // Transition accepted
        const prev = this._stableViseme;
        this._stableViseme = this._pendingViseme;
        this.currentViseme = this._stableViseme;

        // Track CLOSED duration for word-boundary detection
        if (this._stableViseme === VISEME.CLOSED) {
            if (!this._inClosed) {
                this._closedStart = ts;
                this._inClosed = true;
            }
        } else if (this._inClosed) {
            const dur = ts - this._closedStart;
            this._inClosed = false;
            if (dur >= CLOSED_BOUNDARY_MS) {
                this._emitWordBoundary(ts);
            }
            // dur < CLOSED_PAUSE_MAX_MS → intra-word pause, ignored
        }

        // Notify listeners
        for (const cb of this._cbViseme) {
            try { cb(this._stableViseme, prev, ts); } catch (_) { /* ignore */ }
        }
    }

    /** Record a word boundary and update speed metrics */
    _emitWordBoundary(ts) {
        this._wordBoundaryTs.push(ts);
        this._wordCount++;
        for (const cb of this._cbWordBoundary) {
            try { cb(ts, this._wordCount); } catch (_) { /* ignore */ }
        }
    }

    // ============================================================
    //  PART D — SUB-VOCALIZATION DETECTION
    // ============================================================

    /**
     * Determine whether the user is silently mouthing words.
     * @param {object|null} m — measurements
     */
    _detectSubvocal(m) {
        if (!m) { this.isSubvocalizing = false; return; }
        const lipsMoving = m.mar >= 0.02 && m.mar <= 0.08;
        const changing = this.visemeHistory.length > 0 &&
            this.visemeHistory.some((v) => v !== VISEME.CLOSED);
        this.isSubvocalizing = lipsMoving && changing;
    }

    // ============================================================
    //  PART E — READING SPEED MEASUREMENT
    // ============================================================

    /** Recompute rolling WPM from recent word-boundary timestamps. */
    _updateSpeed(ts) {
        // Prune timestamps older than 30 s
        const cutoff = ts - 30000;
        this._wordBoundaryTs = this._wordBoundaryTs.filter((t) => t > cutoff);

        if (this._wordBoundaryTs.length < 2) return;

        const span =
            (this._wordBoundaryTs[this._wordBoundaryTs.length - 1] -
                this._wordBoundaryTs[0]) / 1000;
        if (span <= 0) return;

        const wpm = ((this._wordBoundaryTs.length - 1) / span) * 60;
        this._rollingWPMs.push(wpm);
        if (this._rollingWPMs.length > 6) this._rollingWPMs.shift();

        this.readingSpeedWPM = Math.round(
            this._rollingWPMs.reduce((a, b) => a + b, 0) / this._rollingWPMs.length,
        );
    }

    // ============================================================
    //  PART F — WORD MATCHING FROM VISEME SEQUENCE
    // ============================================================

    /** Lazy-load the CMU phoneme dictionary + G2P fallback. */
    async _ensureDict() {
        if (this._dict) return;
        if (this._dictPromise) { await this._dictPromise; return; }

        this._dictPromise = import('../data/cmuPhonemes.js')
            .then((mod) => {
                this._dict = mod.default || {};
                this._g2p = mod.approximatePhonemes || (() => []);
            })
            .catch((err) => {
                console.error('[LipSyncEngine] phoneme dict load failed:', err);
                this._dict = {};
                this._g2p = () => [];
            });
        await this._dictPromise;
    }

    /** Look up or approximate a word's ARPAbet phoneme array. */
    _phonemesFor(word) {
        const key = word.toLowerCase().replace(/[^a-z]/g, '');
        if (this._dict && this._dict[key]) return this._dict[key];
        if (this._g2p) return this._g2p(key);
        return [];
    }

    /** Convert a word to its expected viseme sequence via phoneme lookup. */
    _wordToVisemes(word) {
        return this._phonemesFor(word).map(arpabetToViseme);
    }

    /** Extract recent non-CLOSED visemes as the "observed" sequence. */
    _observedVisemes() {
        return this.visemeHistory.filter((v) => v !== VISEME.CLOSED);
    }

    /**
     * Match the current lip-reading viseme sequence against candidate words.
     *
     * @param {string[]} candidates — array of candidate word strings
     * @returns {Promise<{word: string|null, confidence: number, phonemeAlignment: string[]}>}
     */
    async matchWord(candidates) {
        await this._ensureDict();

        const observed = this._observedVisemes();
        if (observed.length === 0) {
            return { word: null, confidence: 0, phonemeAlignment: [] };
        }

        let bestWord = null;
        let bestScore = -1;
        let bestAlign = [];

        for (const cand of candidates) {
            const expected = this._wordToVisemes(cand);
            if (expected.length === 0) continue;

            const ed = editDistance(observed, expected);
            const maxLen = Math.max(observed.length, expected.length);
            const score = maxLen > 0 ? 1 - ed / maxLen : 0;

            if (score > bestScore) {
                bestScore = score;
                bestWord = cand;
                bestAlign = expected;
            }
        }

        if (bestScore < 0.35) {
            return { word: null, confidence: 0, phonemeAlignment: [] };
        }

        return { word: bestWord, confidence: bestScore, phonemeAlignment: bestAlign };
    }

    // ============================================================
    //  PUBLIC API
    // ============================================================

    /**
     * Process a single FaceMesh frame.
     * Call this once per frame from your MediaPipe onResults callback.
     *
     * @param {Array<{x:number,y:number,z:number}>} landmarks — FaceMesh landmarks (468+)
     */
    processFrame(landmarks) {
        if (!landmarks || landmarks.length < 468) return;
        const ts = performance.now();
        const m = this._measure(landmarks);
        const raw = this._classify(m);
        this._buffer(raw, ts);
        this._detectSubvocal(m);
        this._updateSpeed(ts);
    }

    /**
     * Subscribe to stable viseme changes.
     * @param {function} cb — (newViseme, prevViseme, timestamp) => void
     * @returns {function} unsubscribe
     */
    onVisemeChange(cb) {
        this._cbViseme.push(cb);
        return () => {
            const i = this._cbViseme.indexOf(cb);
            if (i >= 0) this._cbViseme.splice(i, 1);
        };
    }

    /**
     * Subscribe to word-boundary events (CLOSED > 400 ms).
     * @param {function} cb — (timestamp, cumulativeWordCount) => void
     * @returns {function} unsubscribe
     */
    onWordBoundary(cb) {
        this._cbWordBoundary.push(cb);
        return () => {
            const i = this._cbWordBoundary.indexOf(cb);
            if (i >= 0) this._cbWordBoundary.splice(i, 1);
        };
    }

    /** Reset all state (call when starting a new reading session). */
    reset() {
        this.currentViseme = VISEME.CLOSED;
        this.visemeHistory = [];
        this.isSubvocalizing = false;
        this.readingSpeedWPM = 0;

        for (let i = 0; i < BUFFER_SIZE; i++) this._buf[i] = { viseme: VISEME.CLOSED, ts: 0 };
        this._bIdx = 0;

        this._stableViseme = VISEME.CLOSED;
        this._pendingViseme = null;
        this._pendingTs = 0;
        this._closedStart = 0;
        this._inClosed = false;
        this._marHist = [];
        this._wordBoundaryTs = [];
        this._wordCount = 0;
        this._rollingWPMs = [];
    }

    /** Tear down — release callbacks and dictionary references. */
    destroy() {
        this.reset();
        this._cbViseme = [];
        this._cbWordBoundary = [];
        this._dict = null;
        this._g2p = null;
        this._dictPromise = null;
    }
}

export default LipSyncEngine;
