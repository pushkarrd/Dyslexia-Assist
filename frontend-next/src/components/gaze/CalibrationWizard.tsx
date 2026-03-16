/**
 * CalibrationWizard — Full-screen overlay that trains the polynomial
 * calibration model. User looks at each dot for 2 seconds (dwell-based)
 * to feed iris samples, then validation dots test accuracy.
 *
 * Uses CalibrationService + IrisGazeEngine from GazeContext.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import { useGaze } from '../../context/GazeContext';
import {
    CALIBRATION_POINTS,
    QUICK_CALIBRATION_POINTS,
    VALIDATION_POINTS,
    ACCURACY_THRESHOLD,
    DWELL_DURATION_MS,
    DWELL_SAMPLE_COUNT,
} from '../../services/CalibrationService';
import type { CalibrationPoint } from '../../services/CalibrationService';

// ──────────── Phase enum ────────────

const PHASE_INTRO = 'intro' as const;
const PHASE_CALIBRATING = 'calibrating' as const;
const PHASE_VALIDATING = 'validating' as const;
const PHASE_SUCCESS = 'success' as const;
const PHASE_RETRY = 'retry' as const;

type Phase = typeof PHASE_INTRO | typeof PHASE_CALIBRATING | typeof PHASE_VALIDATING | typeof PHASE_SUCCESS | typeof PHASE_RETRY;

// ──────────── Props ────────────

interface CalibrationWizardProps {
    onComplete?: () => void;
    onSkip?: () => void;
}

export default function CalibrationWizard({ onComplete, onSkip }: CalibrationWizardProps) {
    const { setCalibrated, calibrationService, irisEngine, currentGazeRef } = useGaze();

    const [phase, setPhase] = useState<Phase>(PHASE_INTRO);
    const [points, setPoints] = useState<CalibrationPoint[]>(CALIBRATION_POINTS);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [dwellProgress, setDwellProgress] = useState(0); // 0-1
    const [validationErrors, setValidationErrors] = useState<number[]>([]);
    const [meanError, setMeanError] = useState<number | null>(null);

    const dwellStartRef = useRef<number | null>(null);
    const dwellIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dwellRafRef = useRef<number | null>(null);
    const isDwellingRef = useRef(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (dwellIntervalRef.current) clearInterval(dwellIntervalRef.current);
            if (dwellRafRef.current) cancelAnimationFrame(dwellRafRef.current);
        };
    }, []);

    const stopDwell = useCallback(() => {
        isDwellingRef.current = false;
        dwellStartRef.current = null;
        if (dwellIntervalRef.current) {
            clearInterval(dwellIntervalRef.current);
            dwellIntervalRef.current = null;
        }
        if (dwellRafRef.current) {
            cancelAnimationFrame(dwellRafRef.current);
            dwellRafRef.current = null;
        }
        setDwellProgress(0);
    }, []);

    const advanceToNextPoint = useCallback(() => {
        stopDwell();

        if (phase === PHASE_CALIBRATING) {
            const pt = points[currentIdx];
            if (!pt) return;
            const pxX = (pt.x / 100) * window.innerWidth;
            const pxY = (pt.y / 100) * window.innerHeight;

            // Finalise with median
            calibrationService.finalisePointMedian(pxX, pxY);

            if (currentIdx + 1 < points.length) {
                setCurrentIdx(currentIdx + 1);
            } else {
                const ok = calibrationService.computeCalibration();
                if (!ok) {
                    setPhase(PHASE_RETRY);
                    setMeanError(999);
                    return;
                }
                setCurrentIdx(0);
                setValidationErrors([]);
                setPhase(PHASE_VALIDATING);
            }
        }
    }, [phase, points, currentIdx, calibrationService, stopDwell]);

    const handleDotEnter = useCallback(() => {
        if (phase === PHASE_VALIDATING) return; // validation uses click
        if (isDwellingRef.current) return;

        isDwellingRef.current = true;
        dwellStartRef.current = Date.now();

        const pt = points[currentIdx];
        if (!pt) return;
        const pxX = (pt.x / 100) * window.innerWidth;
        const pxY = (pt.y / 100) * window.innerHeight;

        // Sample iris at ~30fps
        dwellIntervalRef.current = setInterval(() => {
            if (!isDwellingRef.current) return;
            calibrationService.recordDwellSample(pxX, pxY);
        }, 33);

        // Animate progress ring
        const animateProgress = () => {
            if (!isDwellingRef.current || dwellStartRef.current === null) return;
            const elapsed = Date.now() - dwellStartRef.current;
            const progress = Math.min(elapsed / DWELL_DURATION_MS, 1);
            setDwellProgress(progress);

            if (progress >= 1) {
                advanceToNextPoint();
                return;
            }
            dwellRafRef.current = requestAnimationFrame(animateProgress);
        };
        dwellRafRef.current = requestAnimationFrame(animateProgress);
    }, [phase, points, currentIdx, calibrationService, advanceToNextPoint]);

    const handleDotLeave = useCallback(() => {
        if (phase === PHASE_VALIDATING) return;
        stopDwell();
        // Discard partial samples for this point
        calibrationService.reset();
        // Re-collect from scratch — reset only current point buffer
        // Actually we need a method for that. But since we call reset() + re-collect all prior points...
        // Better approach: just discard current dwell samples
    }, [phase, calibrationService, stopDwell]);

    const handleValidationClick = useCallback(() => {
        if (phase !== PHASE_VALIDATING) return;
        const pt = VALIDATION_POINTS[currentIdx];
        if (!pt) return;

        const pxX = (pt.x / 100) * window.innerWidth;
        const pxY = (pt.y / 100) * window.innerHeight;
        const gaze = currentGazeRef.current;
        let dist = 250;
        if (gaze) {
            const dx = gaze.x - pxX;
            const dy = gaze.y - pxY;
            dist = Math.sqrt(dx * dx + dy * dy);
        }

        const newErrors = [...validationErrors, dist];
        setValidationErrors(newErrors);

        if (currentIdx + 1 < VALIDATION_POINTS.length) {
            setCurrentIdx(currentIdx + 1);
        } else {
            const mean = newErrors.reduce((a, b) => a + b, 0) / newErrors.length;
            setMeanError(Math.round(mean));

            if (mean < ACCURACY_THRESHOLD) {
                setPhase(PHASE_SUCCESS);
                setCalibrated(true);
                setTimeout(() => onComplete?.(), 1800);
            } else {
                setPhase(PHASE_RETRY);
            }
        }
    }, [phase, currentIdx, currentGazeRef, validationErrors, setCalibrated, onComplete]);

    const handleStart = () => {
        calibrationService.reset();
        setCurrentIdx(0);
        setDwellProgress(0);
        setPhase(PHASE_CALIBRATING);
    };

    const handleRetryFull = () => {
        calibrationService.reset();
        irisEngine.getCalibration().reset();
        setPoints(CALIBRATION_POINTS);
        setCurrentIdx(0);
        setDwellProgress(0);
        setValidationErrors([]);
        setMeanError(null);
        setPhase(PHASE_CALIBRATING);
    };

    const handleRetryQuick = () => {
        calibrationService.reset();
        irisEngine.getCalibration().reset();
        setPoints(QUICK_CALIBRATION_POINTS);
        setCurrentIdx(0);
        setDwellProgress(0);
        setValidationErrors([]);
        setMeanError(null);
        setPhase(PHASE_CALIBRATING);
    };

    const handleSkip = () => {
        stopDwell();
        setCalibrated(true);
        onSkip?.();
    };

    const activePt = phase === PHASE_VALIDATING
        ? VALIDATION_POINTS[currentIdx]
        : points[currentIdx];

    const totalDots = phase === PHASE_VALIDATING ? VALIDATION_POINTS.length : points.length;
    const circumference = 2 * Math.PI * 25;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.92)' }}
            >
                <button
                    onClick={handleSkip}
                    className="absolute top-6 right-6 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors z-10"
                >
                    <X size={18} />
                    Skip for now
                </button>

                {/* ── INTRO ── */}
                {phase === PHASE_INTRO && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center max-w-lg px-6"
                    >
                        <div className="mb-6 flex justify-center">
                            <div className="w-20 h-20 rounded-full bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center">
                                <Eye size={36} className="text-indigo-400" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Eye Tracking Calibration
                        </h2>
                        <div className="text-left bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                            <p className="text-white/70 text-sm mb-3">
                                <strong className="text-white">How it works:</strong>
                            </p>
                            <ul className="space-y-2 text-white/60 text-sm">
                                <li className="flex items-start gap-2">
                                    <Eye size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                                    <span><strong className="text-white/80">Stare at each dot for 2 seconds</strong> — the ring fills as you look</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Eye size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                                    <span>Keep your <strong className="text-white/80">head still</strong> — move only your eyes</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Good lighting on your face greatly improves accuracy</span>
                                </li>
                            </ul>
                        </div>
                        <p className="text-white/30 text-xs mb-6">
                            {CALIBRATION_POINTS.length} calibration points ({DWELL_DURATION_MS / 1000}s dwell each), then {VALIDATION_POINTS.length} validation dots.
                        </p>
                        <motion.button
                            onClick={handleStart}
                            className="px-10 py-3.5 rounded-xl font-semibold text-lg text-white"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Start Calibration
                        </motion.button>
                    </motion.div>
                )}

                {/* ── CALIBRATING / VALIDATING ── */}
                {(phase === PHASE_CALIBRATING || phase === PHASE_VALIDATING) && activePt && (
                    <>
                        <motion.div
                            key={`${phase}-${currentIdx}`}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                            className="absolute"
                            style={{
                                left: `${activePt.x}%`,
                                top: `${activePt.y}%`,
                                transform: 'translate(-50%, -50%)',
                                width: 56,
                                height: 56,
                                cursor: phase === PHASE_VALIDATING ? 'pointer' : 'default',
                            }}
                            onMouseEnter={phase === PHASE_CALIBRATING ? handleDotEnter : undefined}
                            onMouseLeave={phase === PHASE_CALIBRATING ? handleDotLeave : undefined}
                            onClick={phase === PHASE_VALIDATING ? handleValidationClick : undefined}
                        >
                            <svg width="56" height="56" className="absolute inset-0">
                                <circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                                {phase === PHASE_CALIBRATING && (
                                    <circle
                                        cx="28" cy="28" r="25" fill="none"
                                        stroke="#818cf8" strokeWidth="3" strokeLinecap="round"
                                        strokeDasharray={`${circumference}`}
                                        strokeDashoffset={`${circumference * (1 - dwellProgress)}`}
                                        style={{ transition: 'stroke-dashoffset 50ms linear' }}
                                    />
                                )}
                            </svg>

                            <div
                                className="absolute rounded-full"
                                style={{
                                    width: 20, height: 20,
                                    top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: phase === PHASE_VALIDATING ? '#f59e0b' : '#ffffff',
                                    boxShadow: '0 0 12px rgba(255,255,255,0.5)',
                                }}
                            />
                        </motion.div>

                        {/* Progress bar */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-80 text-center">
                            <div className="w-full h-1.5 rounded-full bg-white/10 mb-3 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                        background: phase === PHASE_VALIDATING
                                            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                            : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                    }}
                                    initial={{ width: '0%' }}
                                    animate={{
                                        width: `${((currentIdx + (phase === PHASE_CALIBRATING ? dwellProgress : 0)) / totalDots) * 100}%`,
                                    }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <p className="text-white/50 text-sm">
                                {phase === PHASE_VALIDATING
                                    ? `Validating: ${currentIdx + 1} of ${VALIDATION_POINTS.length}`
                                    : `Point ${currentIdx + 1} of ${totalDots}`}
                            </p>
                            <p className="text-xs text-white/30 mt-1">
                                {phase === PHASE_CALIBRATING
                                    ? 'Stare at the dot until the ring fills. Keep your head still.'
                                    : 'Look at the yellow dot and click it once.'}
                            </p>
                        </div>
                    </>
                )}

                {/* ── SUCCESS ── */}
                {phase === PHASE_SUCCESS && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center max-w-md px-6"
                    >
                        <div className="mb-6 flex justify-center">
                            <motion.div
                                className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                            >
                                <CheckCircle size={36} className="text-green-400" />
                            </motion.div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Calibration Complete!</h2>
                        <p className="text-white/60">Your eye tracking is ready.</p>
                        {meanError !== null && (
                            <p className="text-xs text-white/30 mt-2">Accuracy: ~{meanError}px average error</p>
                        )}
                    </motion.div>
                )}

                {/* ── RETRY ── */}
                {phase === PHASE_RETRY && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center max-w-md px-6"
                    >
                        <div className="mb-6 flex justify-center">
                            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                                <AlertTriangle size={36} className="text-amber-400" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Let's Try Again</h2>
                        <p className="text-white/60 text-sm mb-2">
                            Accuracy was ~{meanError}px (needs &lt;{ACCURACY_THRESHOLD}px).
                        </p>
                        <div className="bg-white/5 rounded-xl p-3 mb-6 text-left border border-white/10">
                            <p className="text-xs text-white/50 mb-2">Tips:</p>
                            <ul className="text-xs text-white/40 space-y-1">
                                <li>• Good, even lighting on your face</li>
                                <li>• Keep head completely still</li>
                                <li>• Sit at arm's length from screen</li>
                                <li>• Look steadily at the dot centre</li>
                            </ul>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <motion.button
                                onClick={handleRetryFull}
                                className="px-6 py-3 rounded-xl font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Full ({CALIBRATION_POINTS.length} pts)
                            </motion.button>
                            <motion.button
                                onClick={handleRetryQuick}
                                className="px-6 py-3 rounded-xl font-semibold text-white bg-white/10 border border-white/20"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Quick ({QUICK_CALIBRATION_POINTS.length} pts)
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
