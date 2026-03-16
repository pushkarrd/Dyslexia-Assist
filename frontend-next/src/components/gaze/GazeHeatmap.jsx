/**
 * GazeHeatmap — Horizontal bar chart showing per-line dwell time.
 * Uses react-chartjs-2 (already installed) to visualise where the reader
 * spent the most time — longer bars = more dwell.
 *
 * Props:
 *   heatmapData   — array of { lineIndex, dwellMs } from gazeAnalytics
 *   rereadLines   — Set<number> of flagged lines (highlighted in red/amber)
 *   totalLines    — total line count for context
 *   maxHeight     — CSS max-height (default '300px')
 */

import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function GazeHeatmap({
    heatmapData = [],
    rereadLines = new Set(),
    totalLines = 0,
    maxHeight = '300px',
}) {
    const chartData = useMemo(() => {
        if (heatmapData.length === 0) return null;

        // Sort by line index
        const sorted = [...heatmapData].sort((a, b) => a.lineIndex - b.lineIndex);

        const labels = sorted.map((h) => `Line ${h.lineIndex + 1}`);
        const values = sorted.map((h) => +(h.dwellMs / 1000).toFixed(1)); // seconds

        // Color coding: red for reread, indigo for normal
        const bgColors = sorted.map((h) =>
            rereadLines.has(h.lineIndex)
                ? 'rgba(239, 68, 68, 0.7)' // red-500
                : 'rgba(99, 102, 241, 0.6)' // indigo-500
        );
        const borderColors = sorted.map((h) =>
            rereadLines.has(h.lineIndex)
                ? 'rgba(239, 68, 68, 1)'
                : 'rgba(99, 102, 241, 1)'
        );

        return {
            labels,
            datasets: [
                {
                    label: 'Dwell time (s)',
                    data: values,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };
    }, [heatmapData, rereadLines]);

    const options = useMemo(
        () => ({
            indexAxis: 'y', // horizontal bars
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw}s`,
                        afterLabel: (ctx) => {
                            const idx = heatmapData[ctx.dataIndex]?.lineIndex;
                            return rereadLines.has(idx) ? '⚠ Struggled on this line' : '';
                        },
                    },
                    titleColor: '#e2e8f0',
                    bodyColor: '#e2e8f0',
                    backgroundColor: 'rgba(15,15,46,0.95)',
                    borderColor: 'rgba(99,102,241,0.3)',
                    borderWidth: 1,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)',
                        color: 'rgba(255,255,255,0.4)',
                    },
                    ticks: { color: 'rgba(255,255,255,0.4)' },
                    grid: { color: 'rgba(255,255,255,0.06)' },
                },
                y: {
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
                    grid: { display: false },
                },
            },
        }),
        [heatmapData, rereadLines]
    );

    if (!chartData || heatmapData.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-white/30 text-sm">
                No gaze data yet — start reading to see your heatmap.
            </div>
        );
    }

    // Summary stats
    const totalDwell = heatmapData.reduce((s, h) => s + h.dwellMs, 0);
    const linesRead = heatmapData.length;
    const struggled = [...rereadLines].length;

    return (
        <div className="space-y-3">
            {/* Stats row */}
            <div className="flex flex-wrap gap-4 text-sm">
                <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-white/50">Lines read:</span>{' '}
                    <span className="text-white font-medium">{linesRead}</span>
                    {totalLines > 0 && (
                        <span className="text-white/30"> / {totalLines}</span>
                    )}
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-white/50">Total time:</span>{' '}
                    <span className="text-white font-medium">
                        {(totalDwell / 1000).toFixed(1)}s
                    </span>
                </div>
                {struggled > 0 && (
                    <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <span className="text-red-300/70">Struggled lines:</span>{' '}
                        <span className="text-red-300 font-medium">{struggled}</span>
                    </div>
                )}
            </div>

            {/* Chart */}
            <div style={{ maxHeight, position: 'relative' }}>
                <Bar data={chartData} options={options} />
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs text-white/40">
                <span className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ background: 'rgba(99,102,241,0.6)' }}
                    />
                    Normal
                </span>
                <span className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ background: 'rgba(239,68,68,0.7)' }}
                    />
                    Re-read (struggled)
                </span>
            </div>
        </div>
    );
}
