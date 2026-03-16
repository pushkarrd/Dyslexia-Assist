/**
 * gazeAnalytics.js — Logs gaze-tracking session data to Firestore.
 *
 * Schema (Firestore path: users/{uid}/gazeSessions/{autoId}):
 *   startedAt         — Timestamp
 *   endedAt           — Timestamp | null
 *   durationMs        — number
 *   totalLines        — number (total lines in the text)
 *   linesRead         — number (unique lines gazed at)
 *   rereadEvents      — array of { lineIndex, count, firstSeen, lastSeen }
 *   avgComfortLevel   — number (mean adaptive-typography level across lines)
 *   heatmap           — array of { lineIndex, dwellMs } — aggregated per line
 *   pageSource        — 'reading' | 'generator'
 */

import { db, auth } from './firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';

// ---- In-memory session accumulator ----
let _session = null;

/**
 * Start a new gaze analytics session.
 * Call this when the user begins a reading session with gaze enabled.
 */
export function startGazeSession(pageSource = 'reading', totalLines = 0) {
    _session = {
        startedAt: Date.now(),
        pageSource,
        totalLines,
        linesVisited: new Set(),
        lineDwell: new Map(), // Map<lineIndex, totalMs>
        lastLine: -1,
        lastLineTs: null,
        rereadEvents: [],
        adaptedLevels: new Map(), // Map<lineIndex, maxLevel>
        docId: null,
    };

    return _session;
}

/**
 * Record a gaze line change.  Call on every `currentLine` update.
 */
export function recordLineGaze(lineIndex) {
    if (!_session || lineIndex < 0) return;

    const now = Date.now();

    // Accumulate dwell time on the previous line
    if (_session.lastLine >= 0 && _session.lastLineTs) {
        const elapsed = now - _session.lastLineTs;
        const prev = _session.lineDwell.get(_session.lastLine) || 0;
        _session.lineDwell.set(_session.lastLine, prev + elapsed);
    }

    _session.linesVisited.add(lineIndex);
    _session.lastLine = lineIndex;
    _session.lastLineTs = now;
}

/**
 * Record a reread event (from useRereadDetector's rereadLog).
 */
export function recordRereadEvent(lineIndex, count) {
    if (!_session) return;

    const existing = _session.rereadEvents.find(
        (e) => e.lineIndex === lineIndex
    );
    if (existing) {
        existing.count = count;
        existing.lastSeen = Date.now();
    } else {
        _session.rereadEvents.push({
            lineIndex,
            count,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
        });
    }
}

/**
 * Record the adaptive typography level for a line.
 */
export function recordAdaptiveLevel(lineIndex, level) {
    if (!_session) return;
    const current = _session.adaptedLevels.get(lineIndex) || 0;
    if (level > current) {
        _session.adaptedLevels.set(lineIndex, level);
    }
}

/**
 * End the session and persist to Firestore.
 * Returns the document reference on success, null otherwise.
 */
export async function endGazeSession() {
    if (!_session) return null;

    const now = Date.now();

    // Flush last line dwell
    if (_session.lastLine >= 0 && _session.lastLineTs) {
        const elapsed = now - _session.lastLineTs;
        const prev = _session.lineDwell.get(_session.lastLine) || 0;
        _session.lineDwell.set(_session.lastLine, prev + elapsed);
    }

    // Build heatmap array
    const heatmap = [];
    for (const [lineIndex, dwellMs] of _session.lineDwell.entries()) {
        heatmap.push({ lineIndex, dwellMs: Math.round(dwellMs) });
    }
    heatmap.sort((a, b) => a.lineIndex - b.lineIndex);

    // Compute avg comfort level
    let levelSum = 0;
    let levelCount = 0;
    for (const lvl of _session.adaptedLevels.values()) {
        levelSum += lvl;
        levelCount++;
    }

    const sessionData = {
        startedAt: Timestamp.fromMillis(_session.startedAt),
        endedAt: serverTimestamp(),
        durationMs: now - _session.startedAt,
        totalLines: _session.totalLines,
        linesRead: _session.linesVisited.size,
        rereadEvents: _session.rereadEvents,
        avgComfortLevel: levelCount > 0 ? +(levelSum / levelCount).toFixed(2) : 0,
        heatmap,
        pageSource: _session.pageSource,
        // Word-level data (if available)
        ...((_session.wordHistory && _session.wordHistory.length > 0) && {
            wordHistory: _session.wordHistory.slice(-200), // Cap for Firestore doc size
        }),
        ...((_session.wordStruggleEvents && _session.wordStruggleEvents.length > 0) && {
            wordStruggleEvents: _session.wordStruggleEvents,
        }),
        ...(_session.fusionStats && {
            fusionStats: _session.fusionStats,
        }),
    };

    // Persist to Firestore
    const user = auth.currentUser;
    if (!user) {
        console.warn('[GazeAnalytics] No authenticated user — skipping persist.');
        _session = null;
        return null;
    }

    try {
        const colRef = collection(db, 'users', user.uid, 'gazeSessions');
        const docRef = await addDoc(colRef, sessionData);
        _session.docId = docRef.id;
        const result = { ...sessionData, id: docRef.id };
        _session = null;
        return result;
    } catch (err) {
        console.error('[GazeAnalytics] Failed to save session:', err);
        _session = null;
        return null;
    }
}

/**
 * Get the current in-memory session snapshot (for the heatmap UI).
 * Does NOT write to Firestore.
 */
export function getCurrentSessionSnapshot() {
    if (!_session) return null;

    const now = Date.now();
    const heatmap = [];
    for (const [lineIndex, dwellMs] of _session.lineDwell.entries()) {
        heatmap.push({ lineIndex, dwellMs: Math.round(dwellMs) });
    }

    // Add in-progress dwell for current line
    if (_session.lastLine >= 0 && _session.lastLineTs) {
        const extra = now - _session.lastLineTs;
        const existing = heatmap.find((h) => h.lineIndex === _session.lastLine);
        if (existing) {
            existing.dwellMs += Math.round(extra);
        } else {
            heatmap.push({
                lineIndex: _session.lastLine,
                dwellMs: Math.round(extra),
            });
        }
    }

    heatmap.sort((a, b) => a.lineIndex - b.lineIndex);

    return {
        durationMs: now - _session.startedAt,
        linesRead: _session.linesVisited.size,
        totalLines: _session.totalLines,
        rereadEvents: [..._session.rereadEvents],
        heatmap,
        pageSource: _session.pageSource,
        // Word-level data
        wordHistory: _session.wordHistory ? [..._session.wordHistory] : [],
        wordStruggleEvents: _session.wordStruggleEvents ? [..._session.wordStruggleEvents] : [],
        fusionStats: _session.fusionStats ? { ..._session.fusionStats } : null,
    };
}

// ==================== WORD-LEVEL TRACKING ====================

/**
 * Record a word-level reading event (from FusionEngine's wordchange).
 * @param {{ wordIndex: number, text: string, lineIndex: number, confidence: number, method: string }} detail
 */
export function recordWordRead(detail) {
    if (!_session) return;
    if (!_session.wordHistory) _session.wordHistory = [];
    _session.wordHistory.push({
        ...detail,
        timestamp: Date.now(),
    });
    // Cap at 1000 entries
    if (_session.wordHistory.length > 1000) {
        _session.wordHistory = _session.wordHistory.slice(-1000);
    }
}

/**
 * Record a word struggle event (from FusionEngine's wordstruggle).
 * @param {{ wordIndex: number, text: string, lineIndex: number, reason: string }} detail
 */
export function recordWordStruggle(detail) {
    if (!_session) return;
    if (!_session.wordStruggleEvents) _session.wordStruggleEvents = [];
    _session.wordStruggleEvents.push({
        ...detail,
        timestamp: Date.now(),
    });
}

/**
 * Record fusion stats snapshot at session end.
 * @param {{ wordsRead: number, avgDwell: number, avgConfidence: number, methodBreakdown: Object, wpm: number, struggleCount: number }} stats
 */
export function recordFusionStats(stats) {
    if (!_session) return;
    _session.fusionStats = stats;
}
