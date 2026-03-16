/**
 * PhoneticHint — Tooltip-style popup showing the phonetic breakdown of a word.
 * Positioned above the target word using absolute positioning.
 * Auto-dismisses after the specified duration.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PhoneticHintData {
    wordIndex: number;
    text: string;
    phoneticText: string;
    rect: DOMRect | null;
    durationMs: number;
}

interface PhoneticHintProps {
    hint: PhoneticHintData | null;
    onDismiss: () => void;
}

export default function PhoneticHint({ hint, onDismiss }: PhoneticHintProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!hint) {
            setVisible(false);
            return;
        }
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            onDismiss();
        }, hint.durationMs);
        return () => clearTimeout(timer);
    }, [hint, onDismiss]);

    if (!hint || !hint.rect) return null;

    // Position above the word
    const left = hint.rect.left + hint.rect.width / 2;
    const top = hint.rect.top - 8;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'fixed',
                        left: `${left}px`,
                        top: `${top}px`,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 10000,
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        style={{
                            background: 'rgba(30, 41, 59, 0.95)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                            textAlign: 'center',
                            maxWidth: '220px',
                        }}
                    >
                        {/* Original word */}
                        <div style={{
                            fontSize: '13px',
                            color: '#94a3b8',
                            marginBottom: '2px',
                            fontWeight: 500,
                        }}>
                            {hint.text}
                        </div>
                        {/* Phonetic breakdown */}
                        <div style={{
                            fontSize: '16px',
                            color: '#a78bfa',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            letterSpacing: '1px',
                        }}>
                            {hint.phoneticText}
                        </div>
                        {/* Arrow */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-5px',
                            left: '50%',
                            transform: 'translateX(-50%) rotate(45deg)',
                            width: '10px',
                            height: '10px',
                            background: 'rgba(30, 41, 59, 0.95)',
                            borderRight: '1px solid rgba(99, 102, 241, 0.4)',
                            borderBottom: '1px solid rgba(99, 102, 241, 0.4)',
                        }} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * PhoneticHintManager — Manages a queue of phonetic hints, displaying one at a time.
 * Used as a container in the reading page.
 */

interface PhoneticHintManagerProps {
    hints: PhoneticHintData[];
    onHintDismissed: (wordIndex: number) => void;
}

export function PhoneticHintManager({ hints, onHintDismissed }: PhoneticHintManagerProps) {
    // Show only the first hint
    const currentHint = hints.length > 0 ? hints[0] : null;

    return (
        <PhoneticHint
            hint={currentHint}
            onDismiss={() => {
                if (currentHint) onHintDismissed(currentHint.wordIndex);
            }}
        />
    );
}
