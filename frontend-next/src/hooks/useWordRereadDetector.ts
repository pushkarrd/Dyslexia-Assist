/**
 * useWordRereadDetector — Detects when the reader revisits the same WORD
 * 3+ times within a sliding time window.
 *
 * Complements the existing line-level useRereadDetector hook.
 * Listens to the 'wordchange' DOM event dispatched by FusionEngine.
 *
 * Returns:
 *   rereadWords — Map<wordIndex, visitCount> for words above threshold
 *   resetWordReread — clears all state
 *
 * Fires a custom DOM event `wordreread` with
 *   detail: { wordIndex, text, count }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Sliding window duration (ms) */
const WINDOW_MS = 30_000;

/** Number of re-visits to flag a word */
const VISIT_THRESHOLD = 3;

/** Cleanup interval (ms) */
const CLEANUP_INTERVAL = 5_000;

interface WordRereadState {
    rereadWords: Map<number, number>;
    resetWordReread: () => void;
}

export default function useWordRereadDetector(enabled: boolean = true): WordRereadState {
    // Map<wordIndex, timestamp[]>
    const visitsRef = useRef<Map<number, number[]>>(new Map());
    const [rereadWords, setRereadWords] = useState<Map<number, number>>(new Map());
    const prevWordRef = useRef<number>(-1);

    // Listen to wordchange events
    useEffect(() => {
        if (!enabled) return;

        const handler = (e: Event) => {
            const { wordIndex } = (e as CustomEvent).detail;
            if (typeof wordIndex !== 'number' || wordIndex < 0) return;

            // Only record when the word actually changes
            if (wordIndex === prevWordRef.current) return;
            prevWordRef.current = wordIndex;

            const now = Date.now();
            const visits = visitsRef.current;

            if (!visits.has(wordIndex)) {
                visits.set(wordIndex, []);
            }
            const ts = visits.get(wordIndex)!;
            ts.push(now);

            // Prune old timestamps
            const cutoff = now - WINDOW_MS;
            while (ts.length > 0 && ts[0] < cutoff) ts.shift();

            if (ts.length >= VISIT_THRESHOLD) {
                setRereadWords((prev) => {
                    const next = new Map(prev);
                    const prevCount = next.get(wordIndex) || 0;
                    if (ts.length > prevCount) {
                        next.set(wordIndex, ts.length);

                        // Dispatch DOM event for other listeners
                        window.dispatchEvent(
                            new CustomEvent('wordreread', {
                                detail: { wordIndex, count: ts.length },
                            }),
                        );
                    }
                    return next;
                });
            }
        };

        window.addEventListener('wordchange', handler);
        return () => window.removeEventListener('wordchange', handler);
    }, [enabled]);

    // Periodic cleanup — drop words that fall below threshold
    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const cutoff = now - WINDOW_MS;
            const visits = visitsRef.current;

            setRereadWords((prev) => {
                const next = new Map(prev);
                let changed = false;

                for (const [wordIndex] of prev) {
                    const ts = visits.get(wordIndex);
                    if (ts) {
                        while (ts.length > 0 && ts[0] < cutoff) ts.shift();
                        if (ts.length < VISIT_THRESHOLD) {
                            next.delete(wordIndex);
                            changed = true;
                        } else {
                            next.set(wordIndex, ts.length);
                        }
                    } else {
                        next.delete(wordIndex);
                        changed = true;
                    }
                }

                return changed ? next : prev;
            });
        }, CLEANUP_INTERVAL);

        return () => clearInterval(interval);
    }, [enabled]);

    const resetWordReread = useCallback(() => {
        visitsRef.current.clear();
        setRereadWords(new Map());
        prevWordRef.current = -1;
    }, []);

    return { rereadWords, resetWordReread };
}
