/**
 * useRereadDetector — Detects when the reader revisits the same line
 * 3 or more times within a 30-second sliding window.
 *
 * Returns:
 *   rereadLines — Set of line indices currently flagged as "struggling"
 *   rereadLog   — Full array of { lineIndex, count, firstSeen, lastSeen }
 *
 * Fires a custom DOM event `reread` with detail: { lineIndex, count }
 * that other components (GazeTTS, GazeAnalytics) can listen to.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WINDOW_MS = 30_000; // 30-second sliding window
const VISIT_THRESHOLD = 3; // 3 revisits to flag

export default function useRereadDetector(currentLine, enabled = true) {
    // Map<lineIndex, timestamp[]> — sliding window of visit timestamps
    const visitsRef = useRef(new Map());
    const [rereadLines, setRereadLines] = useState(new Set());
    const [rereadLog, setRereadLog] = useState([]); // cumulative log

    const prevLineRef = useRef(-1);

    useEffect(() => {
        if (!enabled || currentLine < 0) return;

        // Only record a visit when the user *arrives* at a new line
        if (currentLine === prevLineRef.current) return;
        prevLineRef.current = currentLine;

        const now = Date.now();
        const visits = visitsRef.current;

        // Add timestamp for this line
        if (!visits.has(currentLine)) {
            visits.set(currentLine, []);
        }
        const ts = visits.get(currentLine);
        ts.push(now);

        // Prune timestamps outside the sliding window
        const cutoff = now - WINDOW_MS;
        while (ts.length > 0 && ts[0] < cutoff) {
            ts.shift();
        }

        // Check threshold
        if (ts.length >= VISIT_THRESHOLD) {
            setRereadLines((prev) => {
                const next = new Set(prev);
                if (!next.has(currentLine)) {
                    next.add(currentLine);

                    // Dispatch DOM event
                    window.dispatchEvent(
                        new CustomEvent('reread', {
                            detail: { lineIndex: currentLine, count: ts.length },
                        })
                    );
                }
                return next;
            });

            // Append to cumulative log
            setRereadLog((prev) => {
                const existing = prev.find((e) => e.lineIndex === currentLine);
                if (existing) {
                    return prev.map((e) =>
                        e.lineIndex === currentLine
                            ? { ...e, count: ts.length, lastSeen: now }
                            : e
                    );
                }
                return [
                    ...prev,
                    {
                        lineIndex: currentLine,
                        count: ts.length,
                        firstSeen: ts[0],
                        lastSeen: now,
                    },
                ];
            });
        }
    }, [currentLine, enabled]);

    // Periodic cleanup — remove lines from the "struggling" set
    // when their visits drop back below threshold
    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const cutoff = now - WINDOW_MS;
            const visits = visitsRef.current;

            setRereadLines((prev) => {
                const next = new Set(prev);
                for (const line of prev) {
                    const ts = visits.get(line);
                    if (ts) {
                        // Prune old timestamps
                        while (ts.length > 0 && ts[0] < cutoff) ts.shift();
                        if (ts.length < VISIT_THRESHOLD) {
                            next.delete(line);
                        }
                    } else {
                        next.delete(line);
                    }
                }
                return next;
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [enabled]);

    // Reset function for when reading session ends
    const resetReread = useCallback(() => {
        visitsRef.current.clear();
        setRereadLines(new Set());
        setRereadLog([]);
        prevLineRef.current = -1;
    }, []);

    return { rereadLines, rereadLog, resetReread };
}
