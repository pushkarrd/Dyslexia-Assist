/**
 * CalibrationService — Manages the calibration data-collection process.
 * Collects (irisFeature → screenTarget) pairs from CalibrationWizard clicks,
 * then feeds them to PolynomialCalibration to compute the mapping.
 *
 * Also provides validation logic: after calibration, test a set of points
 * and report mean pixel error.
 */

import type IrisGazeEngine from './IrisGazeEngine';
import type { GazePoint } from './IrisGazeEngine';
import type { CalibrationSample } from './PolynomialCalibration';

// ──────────── Types ────────────

export interface CalibrationPoint {
    x: number; // percentage 0–100 of viewport width
    y: number; // percentage 0–100 of viewport height
}

export interface ValidationResult {
    meanError: number;    // avg pixel distance
    maxError: number;
    errors: number[];     // per-point errors
    passed: boolean;
}

// ──────────── Constants ────────────

/** 20-point calibration grid (% of viewport) — 4×5 arrangement */
export const CALIBRATION_POINTS: CalibrationPoint[] = [
    // Row 1
    { x: 10, y: 10 }, { x: 30, y: 10 }, { x: 50, y: 10 }, { x: 70, y: 10 }, { x: 90, y: 10 },
    // Row 2
    { x: 10, y: 30 }, { x: 30, y: 30 }, { x: 50, y: 30 }, { x: 70, y: 30 }, { x: 90, y: 30 },
    // Row 3
    { x: 10, y: 55 }, { x: 30, y: 55 }, { x: 50, y: 55 }, { x: 70, y: 55 }, { x: 90, y: 55 },
    // Row 4
    { x: 10, y: 80 }, { x: 30, y: 80 }, { x: 50, y: 80 }, { x: 70, y: 80 }, { x: 90, y: 80 },
];

/** Quick calibration — 9-point grid */
export const QUICK_CALIBRATION_POINTS: CalibrationPoint[] = [
    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
    { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
    { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
];

/** Validation points (independent from calibration grid) */
export const VALIDATION_POINTS: CalibrationPoint[] = [
    { x: 20, y: 25 },
    { x: 60, y: 20 },
    { x: 80, y: 50 },
    { x: 40, y: 75 },
    { x: 70, y: 85 },
];

/** Mean pixel error threshold for passing validation */
export const ACCURACY_THRESHOLD = 100; // px

/** Number of iris samples to collect per calibration point */
export const SAMPLES_PER_POINT = 5;

/** Dwell calibration: how long the user stares at a dot (ms) */
export const DWELL_DURATION_MS = 2000;

/** Dwell calibration: total samples to collect during the dwell (at ~30fps) */
export const DWELL_SAMPLE_COUNT = 60;

// ──────────── Class ────────────

export default class CalibrationService {
    private irisEngine: IrisGazeEngine;
    private samples: CalibrationSample[] = [];

    /** Buffer to collect multiple iris readings per dot click */
    private currentPointSamples: { irisX: number; irisY: number }[] = [];

    constructor(irisEngine: IrisGazeEngine) {
        this.irisEngine = irisEngine;
    }

    // ──────────── Data Collection ────────────

    /**
     * Record a single iris reading for the current dot.
     * The CalibrationWizard calls this on each click — collect SAMPLES_PER_POINT
     * readings then average them for one robust calibration sample.
     *
     * @param screenX — target screen X in pixels
     * @param screenY — target screen Y in pixels
     * @returns number of clicks recorded for current point so far
     */
    recordClick(screenX: number, screenY: number): number {
        const gaze = this.irisEngine.getLastGaze();
        if (!gaze) return this.currentPointSamples.length;

        this.currentPointSamples.push({
            irisX: gaze.rawIrisX,
            irisY: gaze.rawIrisY,
        });

        return this.currentPointSamples.length;
    }

    /**
     * Finalise the current calibration point.
     * Averages the collected iris readings and adds to the sample set.
     * Call after SAMPLES_PER_POINT clicks on one dot.
     */
    finalisePoint(screenX: number, screenY: number): void {
        if (this.currentPointSamples.length === 0) return;

        const avg = this.currentPointSamples.reduce(
            (acc, s) => ({ irisX: acc.irisX + s.irisX, irisY: acc.irisY + s.irisY }),
            { irisX: 0, irisY: 0 },
        );
        const n = this.currentPointSamples.length;

        this.samples.push({
            irisX: avg.irisX / n,
            irisY: avg.irisY / n,
            screenX,
            screenY,
        });

        this.currentPointSamples = [];
    }

    // ──────────── Dwell-based Data Collection ────────────

    /**
     * Record a single dwell sample. Called at ~30fps while the user
     * stares at a calibration dot.
     */
    recordDwellSample(screenX: number, screenY: number): number {
        const gaze = this.irisEngine.getLastGaze();
        if (!gaze) return this.currentPointSamples.length;

        this.currentPointSamples.push({
            irisX: gaze.rawIrisX,
            irisY: gaze.rawIrisY,
        });

        return this.currentPointSamples.length;
    }

    /**
     * Finalise a dwell-based calibration point using MEDIAN
     * instead of mean — more robust against outliers from blinks.
     */
    finalisePointMedian(screenX: number, screenY: number): void {
        if (this.currentPointSamples.length === 0) return;

        const xs = this.currentPointSamples.map(s => s.irisX).sort((a, b) => a - b);
        const ys = this.currentPointSamples.map(s => s.irisY).sort((a, b) => a - b);

        const mid = Math.floor(xs.length / 2);
        const medianX = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
        const medianY = ys.length % 2 === 0 ? (ys[mid - 1] + ys[mid]) / 2 : ys[mid];

        this.samples.push({
            irisX: medianX,
            irisY: medianY,
            screenX,
            screenY,
        });

        this.currentPointSamples = [];
    }

    /** Number of dwell samples collected so far for current point */
    getCurrentDwellCount(): number {
        return this.currentPointSamples.length;
    }

    // ──────────── Calibration ────────────

    /**
     * Run the polynomial least-squares fit on all collected samples.
     * Returns true if calibration succeeded.
     */
    computeCalibration(): boolean {
        const calibration = this.irisEngine.getCalibration();
        return calibration.computeCalibration(this.samples);
    }

    // ──────────── Validation ────────────

    /**
     * Validate calibration accuracy by comparing predicted gaze
     * to known screen targets.
     *
     * @param validationGazes — array of {predicted, actual} pairs
     */
    validate(
        validationGazes: { predicted: GazePoint | null; actualX: number; actualY: number }[],
    ): ValidationResult {
        const errors: number[] = [];

        for (const { predicted, actualX, actualY } of validationGazes) {
            if (!predicted) {
                errors.push(300); // penalty for missing prediction
                continue;
            }
            const dx = predicted.x - actualX;
            const dy = predicted.y - actualY;
            errors.push(Math.sqrt(dx * dx + dy * dy));
        }

        const meanError = errors.length > 0
            ? errors.reduce((a, b) => a + b, 0) / errors.length
            : 999;

        const maxError = errors.length > 0 ? Math.max(...errors) : 999;

        return {
            meanError: Math.round(meanError),
            maxError: Math.round(maxError),
            errors,
            passed: meanError < ACCURACY_THRESHOLD,
        };
    }

    // ──────────── Utilities ────────────

    /** Get number of calibration samples collected so far. */
    getSampleCount(): number {
        return this.samples.length;
    }

    /** Clear all samples and reset for a fresh calibration. */
    reset(): void {
        this.samples = [];
        this.currentPointSamples = [];
    }
}
