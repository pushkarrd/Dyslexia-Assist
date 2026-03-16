/**
 * ReadingAnalytics — Inline session analytics panel displayed below the reading area.
 *
 * Shows:
 *   - Session-at-a-glance: WPM, words read, avg confidence, duration
 *   - Struggle words list with word text + reason
 *   - Fusion method breakdown (pie-style bars)
 *   - Confidence timeline (simple bar chart)
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, AlertTriangle, Clock, Eye, Zap } from 'lucide-react';

/**
 * @param {Object} props
 * @param {boolean} props.visible — Whether to show the panel
 * @param {{ wordHistory: Array, wordStruggleEvents: Array, fusionStats: Object|null, durationMs: number }} props.snapshot
 */
export default function ReadingAnalytics({ visible = false, snapshot = null }) {
    if (!visible || !snapshot) return null;

    const { wordHistory = [], wordStruggleEvents = [], fusionStats = null, durationMs = 0 } = snapshot;

    const stats = fusionStats || {
        wordsRead: wordHistory.length,
        avgDwell: 0,
        avgConfidence: 0,
        methodBreakdown: {},
        wpm: 0,
        struggleCount: wordStruggleEvents.length,
    };

    // Method breakdown for bars
    const methodColors = {
        fusion: '#22c55e',
        lip_only: '#06b6d4',
        gaze_only: '#8b5cf6',
        uncertain: '#6b7280',
    };

    const totalMethodCount = Object.values(stats.methodBreakdown).reduce((a, b) => a + b, 0) || 1;

    // Confidence timeline: bucket wordHistory into ~20 bins
    const confidenceTimeline = useMemo(() => {
        if (wordHistory.length === 0) return [];
        const binCount = Math.min(20, wordHistory.length);
        const binSize = Math.ceil(wordHistory.length / binCount);
        const bins = [];
        for (let i = 0; i < wordHistory.length; i += binSize) {
            const slice = wordHistory.slice(i, i + binSize);
            const avg = slice.reduce((s, w) => s + (w.confidence || 0), 0) / slice.length;
            bins.push(avg);
        }
        return bins;
    }, [wordHistory]);

    const durationSec = Math.round(durationMs / 1000);
    const durationMin = Math.floor(durationSec / 60);
    const durationRemSec = durationSec % 60;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl p-6 bg-white/5 border border-white/10 space-y-5"
        >
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-400" />
                Reading Analytics
            </h3>

            {/* === Session at-a-glance === */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                    icon={<Zap size={14} className="text-amber-400" />}
                    label="WPM"
                    value={stats.wpm}
                />
                <StatCard
                    icon={<Eye size={14} className="text-indigo-400" />}
                    label="Words Read"
                    value={stats.wordsRead}
                />
                <StatCard
                    icon={<BarChart3 size={14} className="text-cyan-400" />}
                    label="Avg Confidence"
                    value={`${Math.round(stats.avgConfidence * 100)}%`}
                />
                <StatCard
                    icon={<Clock size={14} className="text-purple-400" />}
                    label="Duration"
                    value={`${durationMin}:${String(durationRemSec).padStart(2, '0')}`}
                />
            </div>

            {/* === Method breakdown === */}
            <div>
                <h4 className="text-xs text-white/50 mb-2">Fusion Method Breakdown</h4>
                <div className="space-y-1.5">
                    {Object.entries(stats.methodBreakdown).map(([method, count]) => {
                        const pct = (count / totalMethodCount) * 100;
                        return (
                            <div key={method} className="flex items-center gap-2">
                                <span className="text-[10px] text-white/40 w-16 text-right font-mono">
                                    {method.replace('_', ' ')}
                                </span>
                                <div className="flex-1 h-3 rounded-full overflow-hidden bg-white/5">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${pct}%`,
                                            background: methodColors[method] || '#6b7280',
                                        }}
                                    />
                                </div>
                                <span className="text-[10px] text-white/40 w-8 font-mono">
                                    {Math.round(pct)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* === Confidence Timeline === */}
            {confidenceTimeline.length > 0 && (
                <div>
                    <h4 className="text-xs text-white/50 mb-2">Confidence Over Time</h4>
                    <div className="flex items-end gap-[2px] h-12">
                        {confidenceTimeline.map((val, i) => {
                            const hPct = Math.max(10, val * 100);
                            const color = val > 0.65 ? '#22c55e' : val > 0.35 ? '#eab308' : '#ef4444';
                            return (
                                <div
                                    key={i}
                                    className="flex-1 rounded-t-sm transition-all"
                                    style={{
                                        height: `${hPct}%`,
                                        background: color,
                                        opacity: 0.7,
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* === Struggle Words === */}
            {wordStruggleEvents.length > 0 && (
                <div>
                    <h4 className="text-xs text-white/50 mb-2 flex items-center gap-1">
                        <AlertTriangle size={12} className="text-red-400" />
                        Struggle Words ({wordStruggleEvents.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {wordStruggleEvents.map((ev, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-300"
                                title={ev.reason?.replace('_', ' ')}
                            >
                                {ev.text}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function StatCard({ icon, label, value }) {
    return (
        <div className="rounded-xl p-3 bg-white/5 border border-white/5">
            <div className="flex items-center gap-1 mb-1">
                {icon}
                <span className="text-[10px] text-white/40">{label}</span>
            </div>
            <div className="text-lg font-semibold text-white/90">{value}</div>
        </div>
    );
}
