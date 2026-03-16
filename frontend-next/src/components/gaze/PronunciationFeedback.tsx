/**
 * PronunciationFeedback — Shows real-time pronunciation feedback overlay.
 * Displays a toast-like notification when pronunciation errors are detected,
 * showing the error type and phonetic correction.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';
import type { PronunciationScore } from '../../services/PronunciationAnalyser';
import { PronunciationErrorType } from '../../services/PronunciationAnalyser';

interface FeedbackEntry {
    id: number;
    score: PronunciationScore;
    timestamp: number;
}

interface PronunciationFeedbackProps {
    visible?: boolean;
}

const ERROR_LABELS: Record<PronunciationErrorType, string> = {
    [PronunciationErrorType.LETTER_REVERSAL]: 'Letter Reversal',
    [PronunciationErrorType.PHONEME_SUBSTITUTION]: 'Sound Substitution',
    [PronunciationErrorType.OMISSION]: 'Sound Omission',
    [PronunciationErrorType.ADDITION]: 'Extra Sound',
    [PronunciationErrorType.WHOLE_WORD_ERROR]: 'Different Word',
    [PronunciationErrorType.CORRECT]: 'Correct',
};

const ERROR_ICONS: Record<PronunciationErrorType, typeof CheckCircle> = {
    [PronunciationErrorType.CORRECT]: CheckCircle,
    [PronunciationErrorType.LETTER_REVERSAL]: RotateCcw,
    [PronunciationErrorType.PHONEME_SUBSTITUTION]: AlertTriangle,
    [PronunciationErrorType.OMISSION]: XCircle,
    [PronunciationErrorType.ADDITION]: AlertTriangle,
    [PronunciationErrorType.WHOLE_WORD_ERROR]: XCircle,
};

const ERROR_COLORS: Record<PronunciationErrorType, string> = {
    [PronunciationErrorType.CORRECT]: '#34d399',
    [PronunciationErrorType.LETTER_REVERSAL]: '#f472b6',
    [PronunciationErrorType.PHONEME_SUBSTITUTION]: '#fbbf24',
    [PronunciationErrorType.OMISSION]: '#fb923c',
    [PronunciationErrorType.ADDITION]: '#fbbf24',
    [PronunciationErrorType.WHOLE_WORD_ERROR]: '#f87171',
};

let feedbackIdCounter = 0;

export default function PronunciationFeedback({ visible = true }: PronunciationFeedbackProps) {
    const [entries, setEntries] = useState<FeedbackEntry[]>([]);

    const addFeedback = useCallback((score: PronunciationScore) => {
        if (score.isCorrect) return; // Only show errors
        const entry: FeedbackEntry = {
            id: ++feedbackIdCounter,
            score,
            timestamp: Date.now(),
        };
        setEntries(prev => [...prev.slice(-4), entry]); // Keep last 5
    }, []);

    // Listen to trimodal orchestrator pronunciation events
    useEffect(() => {
        // Import dynamically to avoid circular deps
        let unsub: (() => void) | null = null;
        import('../../services/TrimodalOrchestrator').then(({ trimodalOrchestrator }) => {
            unsub = trimodalOrchestrator.onPronunciation((_wordIndex, score) => {
                addFeedback(score);
            });
        });
        return () => { if (unsub) unsub(); };
    }, [addFeedback]);

    // Auto-dismiss entries after 5s
    useEffect(() => {
        if (entries.length === 0) return;
        const timer = setTimeout(() => {
            setEntries(prev => prev.slice(1));
        }, 5000);
        return () => clearTimeout(timer);
    }, [entries]);

    if (!visible || entries.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxWidth: '320px',
            }}
        >
            <AnimatePresence mode="popLayout">
                {entries.map(({ id, score }) => {
                    const errorType = score.errorType || PronunciationErrorType.WHOLE_WORD_ERROR;
                    const Icon = ERROR_ICONS[errorType];
                    const color = ERROR_COLORS[errorType];
                    const label = ERROR_LABELS[errorType];

                    return (
                        <motion.div
                            key={id}
                            layout
                            initial={{ opacity: 0, x: 30, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 30, scale: 0.9 }}
                            transition={{ duration: 0.25 }}
                            style={{
                                background: 'rgba(15, 23, 42, 0.9)',
                                backdropFilter: 'blur(8px)',
                                border: `1px solid ${color}33`,
                                borderRadius: '10px',
                                padding: '10px 14px',
                                boxShadow: `0 4px 20px ${color}15`,
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '4px',
                            }}>
                                <Icon size={14} color={color} />
                                <span style={{ fontSize: '11px', color, fontWeight: 600, textTransform: 'uppercase' }}>
                                    {label}
                                </span>
                            </div>

                            {/* Word comparison */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>
                                    {score.spokenWord}
                                </span>
                                <span style={{ color: '#475569' }}>→</span>
                                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                                    {score.targetWord}
                                </span>
                            </div>

                            {/* Phonetic hint */}
                            {score.phoneticTarget && (
                                <div style={{
                                    fontSize: '12px',
                                    color: '#a78bfa',
                                    fontFamily: 'monospace',
                                    marginTop: '3px',
                                }}>
                                    /{score.phoneticTarget}/
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
