/**
 * useAdaptiveTypography — Watches reread events and progressively
 * increases font size, letter-spacing, and line-height on lines the
 * reader is struggling with. Three comfort levels:
 *
 *   Level 0 (default) — base styles
 *   Level 1           — +2px font-size, +0.03em letter-spacing, 1.8 line-height
 *   Level 2           — +4px font-size, +0.06em letter-spacing, 2.0 line-height
 *   Level 3 (max)     — +6px font-size, +0.08em letter-spacing, 2.2 line-height
 *
 * Returns:
 *   adaptedLines — Map<lineIndex, level>
 *   getLineStyle(lineIndex) — CSSProperties for a specific line
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const LEVEL_STYLES = [
    // Level 0 — no changes
    {},
    // Level 1
    {
        fontSize: '+2px',
        letterSpacing: '0.03em',
        lineHeight: '1.8',
    },
    // Level 2
    {
        fontSize: '+4px',
        letterSpacing: '0.06em',
        lineHeight: '2.0',
    },
    // Level 3
    {
        fontSize: '+6px',
        letterSpacing: '0.08em',
        lineHeight: '2.2',
    },
];

/**
 * @param {Set<number>} rereadLines — Set of line indices flagged as struggling
 *                                     (from useRereadDetector)
 * @param {boolean} enabled
 */
export default function useAdaptiveTypography(rereadLines, enabled = true) {
    // Map<lineIndex, level(1-3)>
    const [adaptedLines, setAdaptedLines] = useState(new Map());
    const prevRereadRef = useRef(new Set());

    // When a line enters the reread set, bump its level (up to 3)
    useEffect(() => {
        if (!enabled) return;

        setAdaptedLines((prev) => {
            const next = new Map(prev);
            let changed = false;

            for (const lineIdx of rereadLines) {
                const current = next.get(lineIdx) || 0;
                if (current < 3) {
                    next.set(lineIdx, current + 1);
                    changed = true;
                }
            }

            return changed ? next : prev;
        });

        prevRereadRef.current = new Set(rereadLines);
    }, [rereadLines, enabled]);

    /**
     * Returns a CSSProperties object for the given line.
     * If the line has no adaptations, returns an empty object.
     * The fontSize value is relative — callers should compute the
     * absolute value by adding to their base font size.
     */
    const getLineStyle = useCallback(
        (lineIndex, baseFontSize = 18) => {
            if (!enabled) return {};

            const level = adaptedLines.get(lineIndex) || 0;
            if (level === 0) return {};

            const cfg = LEVEL_STYLES[level];
            const addPx = parseInt(cfg.fontSize, 10) || 0;

            return {
                fontSize: `${baseFontSize + addPx}px`,
                letterSpacing: cfg.letterSpacing,
                lineHeight: cfg.lineHeight,
                transition: 'font-size 0.3s ease, letter-spacing 0.3s ease, line-height 0.3s ease',
            };
        },
        [adaptedLines, enabled]
    );

    /**
     * Get the comfort level for a specific line (0-3).
     */
    const getLineLevel = useCallback(
        (lineIndex) => {
            return adaptedLines.get(lineIndex) || 0;
        },
        [adaptedLines]
    );

    /**
     * Reset all adaptations (e.g. when starting a new reading session).
     */
    const resetTypography = useCallback(() => {
        setAdaptedLines(new Map());
    }, []);

    return { adaptedLines, getLineStyle, getLineLevel, resetTypography };
}
