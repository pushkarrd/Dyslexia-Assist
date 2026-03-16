/**
 * AdaptiveLineWrapper — Wraps lines of text with adaptive font-size boost
 * based on the AdaptiveResponseEngine's font_boost actions.
 * Each line smoothly transitions its font size when boosted.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface AdaptiveLineWrapperProps {
    lineIndex: number;
    children: React.ReactNode;
    fontBoostPx: number;
    isCurrentLine: boolean;
    isStruggledLine: boolean;
}

export default function AdaptiveLineWrapper({
    lineIndex,
    children,
    fontBoostPx,
    isCurrentLine,
    isStruggledLine,
}: AdaptiveLineWrapperProps) {
    return (
        <motion.div
            data-line-index={lineIndex}
            animate={{
                fontSize: fontBoostPx > 0 ? `calc(var(--a11y-font-size, 18px) + ${fontBoostPx}px)` : undefined,
            }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
                position: 'relative',
                lineHeight: 1.8,
                padding: '2px 0',
                borderRadius: '4px',
                // Subtle highlight for current line
                ...(isCurrentLine && {
                    background: 'rgba(99, 102, 241, 0.06)',
                }),
                // Struggled line gets a soft outline
                ...(isStruggledLine && {
                    boxShadow: 'inset 0 0 0 1px rgba(251, 191, 36, 0.25)',
                    borderRadius: '6px',
                }),
            }}
        >
            {children}
        </motion.div>
    );
}
