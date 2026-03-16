/**
 * GazePiP — PiP webcam preview with eye iris markers, lip outline overlay,
 * fusion status, and confidence bar. Now sources video from FaceMeshService
 * and landmarks from faceLandmarksRef (no WebGazer dependency).
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Minimize2 } from 'lucide-react';
import { useGaze } from '../../context/GazeContext';

const PIP_WIDTH = 220;
const PIP_HEIGHT = 165;

interface GazePiPProps {
    enabled?: boolean;
    fusionState?: { confidence: number; method: string; text: string } | null;
    lipSyncActive?: boolean;
}

export default function GazePiP({ enabled = true, fusionState = null, lipSyncActive = false }: GazePiPProps) {
    const { gazeActive, faceMeshService, faceLandmarksRef } = useGaze();
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | null>(null);
    const [minimized, setMinimized] = useState(false);
    const [hasVideo, setHasVideo] = useState(false);

    // Mirror FaceMeshService's video stream into our <video>
    useEffect(() => {
        if (!enabled || !gazeActive) {
            setHasVideo(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 30;

        const tryCapture = () => {
            const srcVideo = faceMeshService.getVideoElement();
            if (srcVideo && srcVideo.srcObject && localVideoRef.current) {
                localVideoRef.current.srcObject = srcVideo.srcObject;
                localVideoRef.current.play().catch(() => { });
                setHasVideo(true);
                return;
            }
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryCapture, 300);
            }
        };

        tryCapture();

        return () => {
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        };
    }, [enabled, gazeActive, faceMeshService]);

    // Draw eye pins + lip outline using landmarks from faceLandmarksRef
    const drawOverlay = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !hasVideo) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = PIP_WIDTH;
        canvas.height = PIP_HEIGHT;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const landmarks = faceLandmarksRef?.current;
        if (!landmarks || landmarks.length < 468) return;

        // Normalised landmarks (0–1) → PiP pixel coords (mirrored)
        const lx = (lm: { x: number }) => PIP_WIDTH - lm.x * PIP_WIDTH;
        const ly = (lm: { y: number }) => lm.y * PIP_HEIGHT;

        // Eye contours
        const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
        const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

        ctx.strokeStyle = 'rgba(99, 255, 132, 0.5)';
        ctx.lineWidth = 1.5;

        for (const indices of [leftEyeIndices, rightEyeIndices]) {
            ctx.beginPath();
            for (let i = 0; i < indices.length; i++) {
                const lm = landmarks[indices[i]];
                if (!lm) continue;
                if (i === 0) ctx.moveTo(lx(lm), ly(lm));
                else ctx.lineTo(lx(lm), ly(lm));
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Iris markers (468-472 left, 473-477 right)
        const irisCenters = [468, 473];
        for (const idx of irisCenters) {
            const lm = landmarks[idx];
            if (!lm) continue;
            const x = lx(lm);
            const y = ly(lm);

            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#22c55e';
            ctx.fill();

            ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
            ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
            ctx.stroke();
        }

        // Lip outline (cyan)
        const outerLipIndices = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];

        ctx.strokeStyle = lipSyncActive ? 'rgba(0, 220, 255, 0.7)' : 'rgba(0, 220, 255, 0.3)';
        ctx.lineWidth = lipSyncActive ? 1.5 : 1;
        ctx.beginPath();
        for (let i = 0; i < outerLipIndices.length; i++) {
            const lm = landmarks[outerLipIndices[i]];
            if (!lm) continue;
            if (i === 0) ctx.moveTo(lx(lm), ly(lm));
            else ctx.lineTo(lx(lm), ly(lm));
        }
        ctx.closePath();
        ctx.stroke();

        if (lipSyncActive) {
            const innerLipIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
            ctx.strokeStyle = 'rgba(0, 220, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < innerLipIndices.length; i++) {
                const lm = landmarks[innerLipIndices[i]];
                if (!lm) continue;
                if (i === 0) ctx.moveTo(lx(lm), ly(lm));
                else ctx.lineTo(lx(lm), ly(lm));
            }
            ctx.closePath();
            ctx.stroke();
        }
    }, [hasVideo, faceLandmarksRef, lipSyncActive]);

    // Animation loop
    useEffect(() => {
        if (!enabled || !gazeActive || !hasVideo) {
            if (animRef.current) cancelAnimationFrame(animRef.current);
            return;
        }

        const tick = () => {
            drawOverlay();
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [enabled, gazeActive, hasVideo, drawOverlay]);

    if (!enabled || !gazeActive) return null;

    const conf = fusionState?.confidence ?? 0;
    const barColor = conf > 0.65 ? '#22c55e' : conf > 0.35 ? '#eab308' : '#ef4444';
    const methodLabel = fusionState?.method?.replace('_', ' ') || 'waiting';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                className="fixed z-[950] shadow-2xl"
                style={{
                    top: 16, right: 16,
                    width: minimized ? 48 : PIP_WIDTH,
                    height: minimized ? 48 : PIP_HEIGHT + 28 + (lipSyncActive ? 20 : 0),
                    borderRadius: minimized ? '50%' : 16,
                    overflow: 'hidden',
                    border: `2px solid ${lipSyncActive ? 'rgba(0, 220, 255, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                    background: 'rgba(0, 0, 0, 0.9)',
                    transition: 'width 0.3s, height 0.3s, border-radius 0.3s',
                }}
            >
                {minimized ? (
                    <button onClick={() => setMinimized(false)} className="w-full h-full flex items-center justify-center" title="Show camera preview">
                        <Video size={20} className={lipSyncActive ? 'text-cyan-400' : 'text-green-400'} />
                    </button>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between px-2 py-1" style={{ background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', height: 28 }}>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${lipSyncActive ? 'bg-cyan-400' : 'bg-green-400'}`} />
                                <span className="text-[10px] text-white/60 font-medium">
                                    {lipSyncActive ? 'Iris + Lip Sync' : 'Iris Tracking'}
                                </span>
                            </div>
                            <button onClick={() => setMinimized(true)} className="text-white/40 hover:text-white transition-colors" title="Minimize">
                                <Minimize2 size={12} />
                            </button>
                        </div>

                        {/* Video + overlay */}
                        <div className="relative" style={{ width: PIP_WIDTH, height: PIP_HEIGHT }}>
                            <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
                            {!hasVideo && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <VideoOff size={24} className="text-white/30" />
                                </div>
                            )}
                        </div>

                        {/* Confidence bar */}
                        {lipSyncActive && (
                            <div className="px-2 flex items-center gap-2" style={{ height: 20, background: 'rgba(0,0,0,0.8)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.1)' }}>
                                    <div style={{ width: `${Math.round(conf * 100)}%`, height: '100%', background: barColor, borderRadius: 9999, transition: 'width 0.2s, background 0.3s' }} />
                                </div>
                                <span className="text-[9px] text-white/40 font-mono whitespace-nowrap">{methodLabel}</span>
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
