"use client";

/**
 * GazeContext — React context replacing WebGazer with
 * FaceMeshService + IrisGazeEngine + CalibrationService.
 *
 * Provides the same public API surface as the old GazeContext so that
 * downstream components (GazeDot, useLineMapper, etc.) continue working.
 *
 * Gaze coordinates dispatched as DOM CustomEvent 'gazeupdate' { x, y }
 * — the single event bus for the entire gaze system.
 */

import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useCallback,
    useEffect,
} from 'react';

import FaceMeshService from '@/services/FaceMeshService';
import type { FaceMeshLandmark } from '@/services/FaceMeshService';
import IrisGazeEngine from '@/services/IrisGazeEngine';
import CalibrationService from '@/services/CalibrationService';

// ──────────── Types ────────────

interface GazeContextValue {
    /** True if webcam permission granted and FaceMesh loaded */
    gazeAvailable: boolean;
    /** True if the gaze pipeline is actively running */
    gazeActive: boolean;
    /** Ref with latest {x,y} (avoids re-renders) */
    currentGazeRef: React.MutableRefObject<{ x: number; y: number } | null>;
    /** Whether calibration has been completed this session */
    isCalibrated: boolean;
    /** Request webcam + initialise FaceMesh pipeline */
    startGaze: () => Promise<boolean>;
    /** Tear down gaze pipeline */
    stopGaze: () => void;
    /** Mark calibration state */
    setCalibrated: (value: boolean) => void;
    /** IrisGazeEngine instance (for CalibrationWizard / pages) */
    irisEngine: IrisGazeEngine;
    /** CalibrationService instance (for CalibrationWizard) */
    calibrationService: CalibrationService;
    /** FaceMeshService singleton (for GazePiP's video element) */
    faceMeshService: FaceMeshService;
    /** Latest landmarks ref (for GazePiP overlays & LipSync) */
    faceLandmarksRef: React.MutableRefObject<FaceMeshLandmark[] | null>;
}

// ──────────── Context ────────────

const GazeContext = createContext<GazeContextValue | null>(null);

// ──────────── Singletons (survive remounts) ────────────

const faceMeshService = FaceMeshService.getInstance();
const irisEngine = new IrisGazeEngine();
const calibrationService = new CalibrationService(irisEngine);

// ──────────── Provider ────────────

export function GazeProvider({ children }: { children: React.ReactNode }) {
    const [gazeAvailable, setGazeAvailable] = useState(true);
    const [gazeActive, setGazeActive] = useState(false);
    const [isCalibrated, setIsCalibrated] = useState(() => {
        try {
            return sessionStorage.getItem('gazeCalibrated') === 'true';
        } catch {
            return false;
        }
    });

    const currentGazeRef = useRef<{ x: number; y: number } | null>(null);
    const faceLandmarksRef = useRef<FaceMeshLandmark[] | null>(null);
    const activeRef = useRef(false);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        activeRef.current = gazeActive;
    }, [gazeActive]);

    const handleSetCalibrated = useCallback((value: boolean) => {
        setIsCalibrated(value);
        try {
            sessionStorage.setItem('gazeCalibrated', String(value));
        } catch { /* noop */ }
    }, []);

    // ── Landmark handler: runs for every frame from FaceMeshService ──
    const handleLandmarks = useCallback((landmarks: FaceMeshLandmark[]) => {
        if (!activeRef.current) return;

        // Store raw landmarks (for GazePiP overlays & LipSync)
        faceLandmarksRef.current = landmarks;

        // Feed into IrisGazeEngine → get smoothed screen gaze
        const gaze = irisEngine.processLandmarks(landmarks);
        if (!gaze) return;

        currentGazeRef.current = { x: gaze.x, y: gaze.y };

        // Dispatch the same DOM event the old system used
        window.dispatchEvent(
            new CustomEvent('gazeupdate', { detail: { x: gaze.x, y: gaze.y } }),
        );
    }, []);

    // ── startGaze ──
    const startGaze = useCallback(async (): Promise<boolean> => {
        if (activeRef.current) return true;

        try {
            const ok = await faceMeshService.start();
            if (!ok) {
                setGazeAvailable(false);
                return false;
            }

            // Subscribe to landmark frames
            unsubRef.current = faceMeshService.onResults(handleLandmarks);

            setGazeAvailable(true);
            setGazeActive(true);
            return true;
        } catch (err) {
            console.error('[GazeContext] Failed to start:', err);
            setGazeAvailable(false);
            return false;
        }
    }, [handleLandmarks]);

    // ── stopGaze ──
    const stopGaze = useCallback(() => {
        if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
        }

        faceMeshService.stop();
        currentGazeRef.current = null;
        faceLandmarksRef.current = null;
        setGazeActive(false);
    }, []);

    // ── Cleanup on unmount ──
    useEffect(() => {
        return () => {
            if (unsubRef.current) {
                unsubRef.current();
                unsubRef.current = null;
            }
            faceMeshService.stop();
        };
    }, []);

    const value: GazeContextValue = {
        gazeAvailable,
        gazeActive,
        currentGazeRef,
        isCalibrated,
        startGaze,
        stopGaze,
        setCalibrated: handleSetCalibrated,
        irisEngine,
        calibrationService,
        faceMeshService,
        faceLandmarksRef,
    };

    return <GazeContext.Provider value={value}>{children}</GazeContext.Provider>;
}

// ──────────── Hook ────────────

export function useGaze(): GazeContextValue {
    const ctx = useContext(GazeContext);
    if (!ctx) {
        throw new Error('useGaze must be used within a <GazeProvider>');
    }
    return ctx;
}

export default GazeContext;
