/**
 * IrisGazeEngine — Extracts iris centre from FaceMesh landmarks (468-477),
 * computes a normalised iris vector, maps it through PolynomialCalibration
 * to screen coordinates, then smooths via KalmanFilter2D.
 *
 * Provides:
 *   - Raw iris position (normalised 0–1)
 *   - Calibrated screen gaze point (px)
 *   - Confidence score (0–1) based on face visibility & iris consistency
 *   - Drift correction using periodic calibration anchors
 */

import type { FaceMeshLandmark } from './FaceMeshService';
import KalmanFilter2D from './KalmanFilter';
import PolynomialCalibration from './PolynomialCalibration';
import type { CalibrationSample } from './PolynomialCalibration';

// ──────────── Types ────────────

export interface GazePoint {
    x: number;        // screen X in pixels
    y: number;        // screen Y in pixels
    confidence: number; // 0–1
    rawIrisX: number;  // normalised iris X (for calibration sampling)
    rawIrisY: number;  // normalised iris Y
    timestamp: number;
}

// ──────────── Constants ────────────

/** MediaPipe iris landmark indices (refineLandmarks=true) */
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;

/** Eye corner indices for computing relative iris position */
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;

/** Kalman tuning */
const KALMAN_PROCESS_NOISE = 0.6;
const KALMAN_MEASUREMENT_NOISE = 2.0;

/** Maximum allowed jump in single frame (px) — saccade upper bound */
const MAX_JUMP_PX = 400;

/** Confidence decay when no landmarks arrive */
const CONFIDENCE_DECAY = 0.85;

/** Minimum landmarks required for iris tracking */
const MIN_LANDMARKS = 478;

// ──────────── Class ────────────

export default class IrisGazeEngine {
    private kalman: KalmanFilter2D;
    private calibration: PolynomialCalibration;
    private lastGaze: GazePoint | null = null;
    private confidence = 0;

    // Drift correction
    private driftOffsetX = 0;
    private driftOffsetY = 0;
    private driftSamples: { predX: number; predY: number; actualX: number; actualY: number }[] = [];
    private readonly DRIFT_WINDOW = 10;

    constructor() {
        this.kalman = new KalmanFilter2D(KALMAN_PROCESS_NOISE, KALMAN_MEASUREMENT_NOISE);
        this.calibration = new PolynomialCalibration();
    }

    // ──────────── Public API ────────────

    /** Get the PolynomialCalibration instance (for CalibrationService to use). */
    getCalibration(): PolynomialCalibration {
        return this.calibration;
    }

    /** Feed a frame of landmarks. Returns smoothed gaze point or null. */
    processLandmarks(landmarks: FaceMeshLandmark[]): GazePoint | null {
        if (!landmarks || landmarks.length < MIN_LANDMARKS) {
            this.confidence *= CONFIDENCE_DECAY;
            return this.lastGaze;
        }

        // 1. Extract iris centres
        const leftIris = landmarks[LEFT_IRIS_CENTER];
        const rightIris = landmarks[RIGHT_IRIS_CENTER];
        if (!leftIris || !rightIris) {
            this.confidence *= CONFIDENCE_DECAY;
            return this.lastGaze;
        }

        // 2. Compute relative iris position within eye boxes (normalised)
        const irisFeature = this.computeIrisFeature(landmarks);
        if (!irisFeature) {
            this.confidence *= CONFIDENCE_DECAY;
            return this.lastGaze;
        }

        const { irisX, irisY } = irisFeature;

        // 3. Map through polynomial calibration (if calibrated)
        if (!this.calibration.isCalibrated()) {
            // Before calibration: return raw iris coords scaled to screen
            this.confidence = 0.3; // low confidence without calibration
            const rawGaze: GazePoint = {
                x: irisX * window.innerWidth,
                y: irisY * window.innerHeight,
                confidence: this.confidence,
                rawIrisX: irisX,
                rawIrisY: irisY,
                timestamp: performance.now(),
            };
            this.lastGaze = rawGaze;
            return rawGaze;
        }

        const predicted = this.calibration.predict(irisX, irisY);
        if (!predicted) {
            this.confidence *= CONFIDENCE_DECAY;
            return this.lastGaze;
        }

        // 4. Apply drift correction
        let screenX = predicted.x + this.driftOffsetX;
        let screenY = predicted.y + this.driftOffsetY;

        // 5. Jump clamp — prevent wild saccade jumps
        if (this.lastGaze) {
            const dx = screenX - this.lastGaze.x;
            const dy = screenY - this.lastGaze.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > MAX_JUMP_PX) {
                const scale = MAX_JUMP_PX / dist;
                screenX = this.lastGaze.x + dx * scale;
                screenY = this.lastGaze.y + dy * scale;
            }
        }

        // 6. Kalman smoothing
        const smoothed = this.kalman.update(screenX, screenY);

        // 7. Compute confidence based on face quality
        this.confidence = this.computeConfidence(landmarks, irisFeature);

        const gaze: GazePoint = {
            x: Math.round(smoothed.x),
            y: Math.round(smoothed.y),
            confidence: this.confidence,
            rawIrisX: irisX,
            rawIrisY: irisY,
            timestamp: performance.now(),
        };

        this.lastGaze = gaze;
        return gaze;
    }

    /** Record a drift correction sample (user looked at known screen point). */
    addDriftAnchor(actualScreenX: number, actualScreenY: number): void {
        if (!this.lastGaze) return;

        this.driftSamples.push({
            predX: this.lastGaze.x - this.driftOffsetX,
            predY: this.lastGaze.y - this.driftOffsetY,
            actualX: actualScreenX,
            actualY: actualScreenY,
        });

        // Keep a sliding window
        if (this.driftSamples.length > this.DRIFT_WINDOW) {
            this.driftSamples.shift();
        }

        // Recompute average drift offset
        let sumDx = 0, sumDy = 0;
        for (const s of this.driftSamples) {
            sumDx += s.actualX - s.predX;
            sumDy += s.actualY - s.predY;
        }
        this.driftOffsetX = sumDx / this.driftSamples.length;
        this.driftOffsetY = sumDy / this.driftSamples.length;
    }

    /** Get the last computed gaze point. */
    getLastGaze(): GazePoint | null {
        return this.lastGaze;
    }

    /** Get current confidence (0–1). */
    getConfidence(): number {
        return this.confidence;
    }

    /** Reset all state. */
    reset(): void {
        this.kalman.reset();
        this.calibration.reset();
        this.lastGaze = null;
        this.confidence = 0;
        this.driftOffsetX = 0;
        this.driftOffsetY = 0;
        this.driftSamples = [];
    }

    // ──────────── Internals ────────────

    /**
     * Compute normalised iris feature: the iris position relative to the eye box.
     * Returns (0,0) = top-left of eye box, (1,1) = bottom-right.
     */
    private computeIrisFeature(landmarks: FaceMeshLandmark[]): { irisX: number; irisY: number } | null {
        const li = landmarks[LEFT_IRIS_CENTER];
        const ri = landmarks[RIGHT_IRIS_CENTER];
        const lInner = landmarks[LEFT_EYE_INNER];
        const lOuter = landmarks[LEFT_EYE_OUTER];
        const rInner = landmarks[RIGHT_EYE_INNER];
        const rOuter = landmarks[RIGHT_EYE_OUTER];

        if (!li || !ri || !lInner || !lOuter || !rInner || !rOuter) return null;

        // Average iris centre
        const irisCx = (li.x + ri.x) / 2;
        const irisCy = (li.y + ri.y) / 2;

        // Eye box bounds (from outer/inner corners of both eyes)
        const eyeLeft = Math.min(lOuter.x, rOuter.x);
        const eyeRight = Math.max(lInner.x, rInner.x);
        const eyeTop = Math.min(lOuter.y, lInner.y, rOuter.y, rInner.y);
        const eyeBottom = Math.max(lOuter.y, lInner.y, rOuter.y, rInner.y);

        const eyeW = eyeRight - eyeLeft;
        const eyeH = eyeBottom - eyeTop;

        if (eyeW < 0.01 || eyeH < 0.001) return null; // eye too small / closed

        // Normalise iris position within eye box
        const irisX = (irisCx - eyeLeft) / eyeW;
        const irisY = (irisCy - eyeTop) / eyeH;

        return { irisX: Math.max(0, Math.min(1, irisX)), irisY: Math.max(0, Math.min(1, irisY)) };
    }

    /** Compute confidence from face geometry quality. */
    private computeConfidence(
        landmarks: FaceMeshLandmark[],
        irisFeature: { irisX: number; irisY: number },
    ): number {
        let conf = 0.9; // start high

        // Penalise if iris is at extreme edges (likely tracking error)
        const { irisX, irisY } = irisFeature;
        if (irisX < 0.1 || irisX > 0.9) conf -= 0.2;
        if (irisY < 0.1 || irisY > 0.9) conf -= 0.15;

        // Penalise if face is turned (nose tip vs face centre)
        const nose = landmarks[1];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        if (nose && leftCheek && rightCheek) {
            const faceCx = (leftCheek.x + rightCheek.x) / 2;
            const headTurn = Math.abs(nose.x - faceCx);
            if (headTurn > 0.05) conf -= headTurn * 2;
        }

        return Math.max(0, Math.min(1, conf));
    }
}
