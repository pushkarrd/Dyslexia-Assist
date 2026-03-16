/**
 * TrimodalStatusBar — Shows active input channels and reading accuracy.
 * Sits at the top of the reading area.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Mic, Volume2, Activity } from 'lucide-react';
import { trimodalOrchestrator } from '../../services/TrimodalOrchestrator';
import type { TrimodalStatus } from '../../services/TrimodalOrchestrator';

interface TrimodalStatusBarProps {
    visible?: boolean;
}

export default function TrimodalStatusBar({ visible = true }: TrimodalStatusBarProps) {
    const [status, setStatus] = useState<TrimodalStatus>({
        gazeActive: false,
        lipSyncActive: false,
        voiceActive: false,
        micActive: false,
        isRunning: false,
    });
    const [wpm, setWpm] = useState(0);
    const [accuracy, setAccuracy] = useState(1);

    useEffect(() => {
        const unsub = trimodalOrchestrator.onStatusChange(setStatus);

        // Poll reading stats every 2 seconds
        const interval = setInterval(() => {
            if (trimodalOrchestrator.isRunning()) {
                const stats = trimodalOrchestrator.getReadingStats();
                setWpm(stats.wpm);
                const pStats = trimodalOrchestrator.getPronunciationStats();
                setAccuracy(pStats.accuracy);
            }
        }, 2000);

        return () => {
            unsub();
            clearInterval(interval);
        };
    }, []);

    if (!visible || !status.isRunning) return null;

    const channels = [
        { key: 'gaze', active: status.gazeActive, icon: Eye, label: 'Gaze', color: '#60a5fa' },
        { key: 'lip', active: status.lipSyncActive, icon: Activity, label: 'Lip Sync', color: '#f472b6' },
        { key: 'voice', active: status.voiceActive, icon: Mic, label: 'Voice', color: '#34d399' },
        { key: 'tts', active: true, icon: Volume2, label: 'TTS', color: '#fbbf24' },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    fontSize: '12px',
                    color: '#cbd5e1',
                    userSelect: 'none',
                    marginBottom: '8px',
                }}
            >
                {/* Channel indicators */}
                {channels.map(({ key, active, icon: Icon, label, color }) => (
                    <div
                        key={key}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: active ? 1 : 0.35,
                            transition: 'opacity 0.3s',
                        }}
                        title={`${label}: ${active ? 'Active' : 'Inactive'}`}
                    >
                        <Icon size={14} color={active ? color : '#64748b'} />
                        <span style={{ color: active ? color : '#64748b' }}>{label}</span>
                    </div>
                ))}

                {/* Divider */}
                <div style={{ width: '1px', height: '16px', background: 'rgba(148, 163, 184, 0.2)' }} />

                {/* WPM */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#94a3b8' }}>WPM:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{wpm}</span>
                </div>

                {/* Accuracy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#94a3b8' }}>Accuracy:</span>
                    <span style={{
                        color: accuracy >= 0.8 ? '#34d399' : accuracy >= 0.5 ? '#fbbf24' : '#f87171',
                        fontWeight: 600,
                    }}>
                        {Math.round(accuracy * 100)}%
                    </span>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
