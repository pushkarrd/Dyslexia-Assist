/**
 * WordHighlighter — Word-level reading highlight driven by FusionEngine events.
 *
 * Features:
 *   - Active word highlight (amber #FDE68A, confidence-scaled opacity)
 *   - Current-line context bar (faint indigo band behind the line)
 *   - Struggle underline (dashed red) for words flagged by FusionEngine
 *   - Reread underline (solid orange) for words revisited 3+ times
 *
 * Subscribes to DOM custom events:
 *   'wordchange'   — update highlight position
 *   'wordstruggle' — add struggle decoration
 *
 * Uses refs + direct DOM manipulation for zero-overhead highlighting at 30+fps.
 */

import React, { useRef, useEffect } from 'react';

interface WordHighlighterProps {
    containerRef: React.RefObject<HTMLElement | null>;
    enabled?: boolean;
    struggleWords?: Set<number>;
    rereadWords?: Map<number, number>;
}

export default function WordHighlighter({
    containerRef,
    enabled = false,
    struggleWords = new Set<number>(),
    rereadWords = new Map<number, number>(),
}: WordHighlighterProps) {
    const highlightRef = useRef<HTMLDivElement>(null);
    const lineBarRef = useRef<HTMLDivElement>(null);
    const lastWordIndexRef = useRef(-1);
    const lastLineIndexRef = useRef(-1);

    // Apply struggle/reread decorations to word spans
    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const container = containerRef.current;
        const spans = container.querySelectorAll('span[data-word-index]');

        spans.forEach((s) => {
            const span = s as HTMLElement;
            const idx = parseInt(span.getAttribute('data-word-index')!, 10);
            span.style.textDecorationLine = '';
            span.style.textDecorationStyle = '';
            span.style.textDecorationColor = '';
            span.style.textUnderlineOffset = '';

            if (struggleWords.has(idx)) {
                span.style.textDecorationLine = 'underline';
                span.style.textDecorationStyle = 'dashed';
                span.style.textDecorationColor = '#ef4444';
                span.style.textUnderlineOffset = '3px';
            } else if ((rereadWords.get(idx) || 0) >= 3) {
                span.style.textDecorationLine = 'underline';
                span.style.textDecorationStyle = 'solid';
                span.style.textDecorationColor = '#f97316';
                span.style.textUnderlineOffset = '3px';
            }
        });
    }, [enabled, struggleWords, rereadWords, containerRef]);

    // Listen for wordchange events and update highlight position
    useEffect(() => {
        if (!enabled) return;

        const handleWordChange = (e: Event) => {
            const { wordIndex, lineIndex, confidence } = (e as CustomEvent).detail;
            if (!containerRef.current) return;

            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();

            // --- Word highlight ---
            const wordSpan = container.querySelector(
                `span[data-word-index="${wordIndex}"]`,
            ) as HTMLElement | null;

            if (wordSpan && highlightRef.current) {
                const wordRect = wordSpan.getBoundingClientRect();
                const hl = highlightRef.current;
                const opacity = Math.max(0.2, Math.min(0.7, confidence));

                hl.style.left = `${wordRect.left - containerRect.left - 2}px`;
                hl.style.top = `${wordRect.top - containerRect.top - 1}px`;
                hl.style.width = `${wordRect.width + 4}px`;
                hl.style.height = `${wordRect.height + 2}px`;
                hl.style.opacity = String(opacity);
                hl.style.display = 'block';
            }

            lastWordIndexRef.current = wordIndex;

            // --- Line context bar ---
            if (lineIndex !== lastLineIndexRef.current && lineBarRef.current) {
                lastLineIndexRef.current = lineIndex;
                const lineEl = container.querySelector(
                    `[data-line-index="${lineIndex}"]`,
                ) as HTMLElement | null;

                if (lineEl) {
                    const lineRect = lineEl.getBoundingClientRect();
                    const bar = lineBarRef.current;
                    bar.style.left = '0';
                    bar.style.top = `${lineRect.top - containerRect.top}px`;
                    bar.style.width = '100%';
                    bar.style.height = `${lineRect.height}px`;
                    bar.style.display = 'block';
                } else if (wordSpan) {
                    const wordRect = wordSpan.getBoundingClientRect();
                    const bar = lineBarRef.current;
                    bar.style.left = '0';
                    bar.style.top = `${wordRect.top - containerRect.top - 2}px`;
                    bar.style.width = '100%';
                    bar.style.height = `${wordRect.height + 4}px`;
                    bar.style.display = 'block';
                }
            }
        };

        window.addEventListener('wordchange', handleWordChange);
        return () => window.removeEventListener('wordchange', handleWordChange);
    }, [enabled, containerRef]);

    // Hide highlights when disabled
    useEffect(() => {
        if (!enabled) {
            if (highlightRef.current) highlightRef.current.style.display = 'none';
            if (lineBarRef.current) lineBarRef.current.style.display = 'none';
            lastWordIndexRef.current = -1;
            lastLineIndexRef.current = -1;
        }
    }, [enabled]);

    if (!enabled) return null;

    return (
        <>
            {/* Line context bar (behind text) */}
            <div
                ref={lineBarRef}
                style={{
                    position: 'absolute',
                    display: 'none',
                    background: 'rgba(99, 102, 241, 0.06)',
                    borderLeft: '3px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    zIndex: 0,
                    transition: 'top 0.15s ease-out, height 0.15s ease-out',
                }}
            />

            {/* Active word highlight (above line bar, below text) */}
            <div
                ref={highlightRef}
                style={{
                    position: 'absolute',
                    display: 'none',
                    background: '#FDE68A',
                    borderRadius: 3,
                    pointerEvents: 'none',
                    zIndex: 1,
                    transition:
                        'left 0.1s ease-out, top 0.1s ease-out, width 0.1s ease-out, opacity 0.15s',
                    mixBlendMode: 'multiply',
                }}
            />
        </>
    );
}
