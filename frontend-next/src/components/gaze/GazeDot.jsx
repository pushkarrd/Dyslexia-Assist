/**
 * GazeDot — Smooth, translucent dot that follows the user's gaze on screen.
 * Uses CSS transitions for silky movement. Listens to 'gazeupdate' DOM events
 * dispatched by GazeContext — zero React re-renders.
 *
 * Props:
 *   enabled   — show/hide the dot
 *   size      — dot diameter in px (default: 28)
 *   color     — CSS color (default: indigo)
 *   showTrail — show a fading trail (default: false)
 */

import React, { useRef, useEffect } from 'react';

export default function GazeDot({
    enabled = true,
    size = 28,
    color = 'rgba(99, 102, 241, 0.5)',
    showTrail = false,
}) {
    const dotRef = useRef(null);
    const trailRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        const handleGaze = (e) => {
            const { x, y } = e.detail;
            if (dotRef.current) {
                dotRef.current.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
                dotRef.current.style.opacity = '1';
            }
            if (showTrail && trailRef.current) {
                trailRef.current.style.transform = `translate(${x - size * 0.75}px, ${y - size * 0.75}px)`;
                trailRef.current.style.opacity = '0.3';
            }
        };

        window.addEventListener('gazeupdate', handleGaze);
        return () => window.removeEventListener('gazeupdate', handleGaze);
    }, [enabled, size, showTrail]);

    if (!enabled) return null;

    return (
        <>
            {/* Trail (larger, slower, more transparent) */}
            {showTrail && (
                <div
                    ref={trailRef}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: size * 1.5,
                        height: size * 1.5,
                        borderRadius: '50%',
                        background: color,
                        opacity: 0,
                        pointerEvents: 'none',
                        zIndex: 9990,
                        transition: 'transform 250ms ease-out, opacity 300ms ease-out',
                        filter: 'blur(8px)',
                    }}
                />
            )}

            {/* Main gaze dot */}
            <div
                ref={dotRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    border: '2px solid rgba(99, 102, 241, 0.7)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    boxShadow: '0 0 12px rgba(99, 102, 241, 0.3), inset 0 0 6px rgba(99, 102, 241, 0.2)',
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: 9991,
                    transition: 'transform 120ms ease-out, opacity 200ms ease-out',
                }}
            >
                {/* Center pip */}
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.8)',
                    }}
                />
            </div>
        </>
    );
}
