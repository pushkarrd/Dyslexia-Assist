/**
 * GazeHighlighter — Renders a translucent band across the line the user is
 * currently gazing at. Sits absolutely-positioned inside the same parent as
 * the reading container.
 *
 * Props:
 *   containerRef  — ref to the reading container (same one passed to useLineMapper)
 *   currentLine   — 0-based line index from useLineMapper (-1 hides highlight)
 *   color         — highlight colour (default: 'rgba(99,102,241,0.18)')
 *   paddingY      — extra vertical padding around the line in px (default: 4)
 *   enabled       — toggle visibility (default: true)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GazeHighlighter({
    containerRef,
    currentLine,
    color = 'rgba(99,102,241,0.18)',
    paddingY = 4,
    enabled = true,
}) {
    const [rect, setRect] = useState(null); // { top, height } relative to container

    useEffect(() => {
        if (!enabled || currentLine < 0) {
            setRect(null);
            return;
        }

        const el = containerRef?.current;
        if (!el) return;

        const lineEl = el.querySelector(`[data-line-index="${currentLine}"]`);
        if (!lineEl) {
            setRect(null);
            return;
        }

        const containerRect = el.getBoundingClientRect();
        const lineRect = lineEl.getBoundingClientRect();

        setRect({
            top: lineRect.top - containerRect.top + el.scrollTop - paddingY,
            height: lineRect.height + paddingY * 2,
        });
    }, [containerRef, currentLine, paddingY, enabled]);

    if (!enabled || !rect) return null;

    return (
        <AnimatePresence>
            <motion.div
                key={currentLine}
                initial={{ opacity: 0, scaleY: 0.5 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: rect.top,
                    height: rect.height,
                    background: color,
                    borderRadius: 6,
                    pointerEvents: 'none',
                    zIndex: 5,
                    transformOrigin: 'center',
                }}
            />
        </AnimatePresence>
    );
}
