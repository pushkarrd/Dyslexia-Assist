/**
 * useLineMapper — Maps the current gaze Y-coordinate to the nearest visible
 * text line inside a container ref. Lines must be marked with
 * `data-line-index="n"` attributes.
 *
 * Returns:
 *   currentLine  — 0-based index of the line the user is looking at (-1 if none)
 *   lineRects    — array of { top, bottom, index } for every tracked line
 *
 * Also exposes a helper `wrapTextInLines(text)` that takes a string and returns
 * an array of <div data-line-index=n> elements ready to render inside a container.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const LINE_DEBOUNCE_MS = 80;

/**
 * @param {React.RefObject<HTMLElement>} containerRef — ref to the scrollable
 *   reading container that holds `[data-line-index]` children
 */
export default function useLineMapper(containerRef) {
    const [currentLine, setCurrentLine] = useState(-1);
    const [lineRects, setLineRects] = useState([]); // { top, bottom, index }[]
    const lastLineRef = useRef(-1);
    const debounceTimerRef = useRef(null);

    // ---- Rebuild the line rect cache whenever the container changes size ----
    const rebuildRects = useCallback(() => {
        const el = containerRef?.current;
        if (!el) return;

        const lines = el.querySelectorAll('[data-line-index]');
        const rects = [];

        lines.forEach((node) => {
            const rect = node.getBoundingClientRect();
            rects.push({
                index: parseInt(node.getAttribute('data-line-index'), 10),
                top: rect.top,
                bottom: rect.bottom,
            });
        });

        // Sort by top position just in case DOM order is odd
        rects.sort((a, b) => a.top - b.top);
        setLineRects(rects);
    }, [containerRef]);

    // ---- Observe container resize to rebuild rects ----
    useEffect(() => {
        const el = containerRef?.current;
        if (!el) return;

        rebuildRects();

        const observer = new ResizeObserver(() => rebuildRects());
        observer.observe(el);

        // Also rebuild on scroll (since getBoundingClientRect is viewport-relative)
        const scrollEl = el;
        const handleScroll = () => rebuildRects();
        scrollEl.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            observer.disconnect();
            scrollEl.removeEventListener('scroll', handleScroll);
        };
    }, [containerRef, rebuildRects]);

    // ---- Listen for gazeupdate events and map Y to nearest line ----
    useEffect(() => {
        const handler = (e) => {
            const { y } = e.detail;
            if (y == null || lineRects.length === 0) return;

            // Find the line whose vertical range contains the gaze Y, or nearest
            let bestIdx = -1;
            let bestDist = Infinity;

            for (const lr of lineRects) {
                if (y >= lr.top && y <= lr.bottom) {
                    bestIdx = lr.index;
                    bestDist = 0;
                    break;
                }
                const mid = (lr.top + lr.bottom) / 2;
                const dist = Math.abs(y - mid);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = lr.index;
                }
            }

            // Only accept if gaze is within 60px of the nearest line center
            if (bestDist > 60) bestIdx = -1;

            if (bestIdx !== lastLineRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = setTimeout(() => {
                    lastLineRef.current = bestIdx;
                    setCurrentLine(bestIdx);
                }, LINE_DEBOUNCE_MS);
            }
        };

        window.addEventListener('gazeupdate', handler);
        return () => {
            window.removeEventListener('gazeupdate', handler);
            clearTimeout(debounceTimerRef.current);
        };
    }, [lineRects]);

    return { currentLine, lineRects, rebuildRects };
}

// ---- Utility: split plain text into an array of line-wrapped div props ----

/**
 * Splits a plain-text string by newline boundaries and returns an array of
 * objects that can be spread onto <div> elements:
 *   [{ key, 'data-line-index': 0, children: "line text" }, ...]
 *
 * Usage in JSX:
 *   {wrapTextInLines(text).map(props => <div {...props} />)}
 */
export function wrapTextInLines(text) {
    if (!text) return [];

    const lines = text.split(/\n/);
    return lines.map((line, i) => ({
        key: `line-${i}`,
        'data-line-index': i,
        children: line || '\u00A0', // non-breaking space for blank lines
    }));
}

/**
 * Higher-level wrapper: splits rich HTML content into paragraphs/sentences
 * and assigns data-line-index attributes. Works with plain text; for HTML
 * content rendered via dangerouslySetInnerHTML, use the CSS-based approach
 * or the GazeHighlighter overlay instead.
 */
export function splitIntoReadingLines(text, wordsPerLine = 12) {
    if (!text) return [];

    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let lineIdx = 0;

    for (let i = 0; i < words.length; i += wordsPerLine) {
        const chunk = words.slice(i, i + wordsPerLine).join(' ');
        lines.push({
            key: `rline-${lineIdx}`,
            'data-line-index': lineIdx,
            children: chunk,
        });
        lineIdx++;
    }

    return lines;
}
