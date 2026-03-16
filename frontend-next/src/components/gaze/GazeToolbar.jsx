/**
 * GazeToolbar — Slide-out side panel for gaze-tracking controls.
 * Provides a unified UI to toggle gaze, recalibrate, view session stats,
 * and access the heatmap — regardless of which page the user is on.
 *
 * Props:
 *   gazeEnabled       — boolean
 *   onToggleGaze      — () => void
 *   onRecalibrate     — () => void
 *   isCalibrated      — boolean
 *   currentLine       — number
 *   rereadLines       — Set<number>
 *   heatmapSnapshot   — object | null (from getCurrentSessionSnapshot)
 *   onShowHeatmap     — () => void
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, ChevronLeft, ChevronRight, RefreshCw, Eye, BarChart3 } from 'lucide-react';

export default function GazeToolbar({
    gazeEnabled,
    onToggleGaze,
    onRecalibrate,
    isCalibrated,
    currentLine = -1,
    rereadLines = new Set(),
    heatmapSnapshot = null,
    onShowHeatmap,
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Toggle tab */}
            <motion.button
                onClick={() => setOpen(!open)}
                className="fixed left-0 top-1/2 -translate-y-1/2 z-900 flex items-center gap-1 px-2 py-3 rounded-r-xl transition-colors"
                style={{
                    background: gazeEnabled
                        ? 'rgba(34, 197, 94, 0.2)'
                        : 'rgba(99, 102, 241, 0.15)',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
                whileHover={{ x: 4 }}
            >
                <Eye size={16} className={gazeEnabled ? 'text-green-400' : 'text-indigo-400'} />
                {open ? <ChevronLeft size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
            </motion.button>

            {/* Slide-out panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed left-0 top-0 bottom-0 z-899 w-65 backdrop-blur-xl border-r border-white/10 flex flex-col"
                        style={{ background: 'rgba(10, 10, 30, 0.95)' }}
                    >
                        {/* Header */}
                        <div className="px-4 py-5 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Crosshair size={18} className="text-indigo-400" />
                                <h3 className="font-semibold text-white text-sm">Gaze Tracking</h3>
                            </div>
                            <p className="text-xs text-white/40 mt-1">Eye-tracking reading assistant</p>
                        </div>

                        {/* Controls */}
                        <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
                            {/* Toggle */}
                            <button
                                onClick={onToggleGaze}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm"
                                style={{
                                    background: gazeEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${gazeEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                }}
                            >
                                <span className={gazeEnabled ? 'text-green-300' : 'text-white/60'}>
                                    {gazeEnabled ? 'Eye Tracking ON' : 'Eye Tracking OFF'}
                                </span>
                                <div
                                    className="w-10 h-5 rounded-full relative transition-colors"
                                    style={{ background: gazeEnabled ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.15)' }}
                                >
                                    <div
                                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                                        style={{ left: gazeEnabled ? '22px' : '2px' }}
                                    />
                                </div>
                            </button>

                            {/* Recalibrate */}
                            {gazeEnabled && (
                                <button
                                    onClick={onRecalibrate}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition-colors"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <RefreshCw size={14} />
                                    Recalibrate
                                    {!isCalibrated && (
                                        <span className="ml-auto text-xs text-amber-400">Needed</span>
                                    )}
                                </button>
                            )}

                            {/* Live stats */}
                            {gazeEnabled && (
                                <div className="space-y-2 pt-2">
                                    <div className="text-xs text-white/40 uppercase tracking-wider">Live Stats</div>

                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                        <span className="text-xs text-white/50">Current line</span>
                                        <span className="text-xs text-white font-mono">
                                            {currentLine >= 0 ? currentLine + 1 : '—'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                        <span className="text-xs text-white/50">Struggle areas</span>
                                        <span className="text-xs font-mono" style={{ color: rereadLines.size > 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)' }}>
                                            {rereadLines.size}
                                        </span>
                                    </div>

                                    {heatmapSnapshot && (
                                        <>
                                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                                <span className="text-xs text-white/50">Lines read</span>
                                                <span className="text-xs text-white font-mono">
                                                    {heatmapSnapshot.linesRead || 0}
                                                    {heatmapSnapshot.totalLines > 0 && (
                                                        <span className="text-white/30">/{heatmapSnapshot.totalLines}</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                                <span className="text-xs text-white/50">Session time</span>
                                                <span className="text-xs text-white font-mono">
                                                    {Math.round((heatmapSnapshot.durationMs || 0) / 1000)}s
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Heatmap button */}
                            {gazeEnabled && onShowHeatmap && (
                                <button
                                    onClick={onShowHeatmap}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-indigo-300 hover:text-white transition-colors"
                                    style={{
                                        background: 'rgba(99,102,241,0.1)',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                    }}
                                >
                                    <BarChart3 size={14} />
                                    View Reading Heatmap
                                </button>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-white/10 text-xs text-white/30 text-center">
                            Powered by WebGazer.js
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
