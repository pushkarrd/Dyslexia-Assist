/**
 * KalmanFilter2D — A lightweight 2-state Kalman filter for smoothing
 * 2D gaze coordinates (x, y). Uses plain JS arrays, NOT TensorFlow tensors.
 *
 * State: [x, y]  (position only — velocity omitted for simplicity)
 * Measurement: [observedX, observedY]
 *
 * Tuning:
 *   processNoise (Q) — higher → trusts measurements more (responsive)
 *   measurementNoise (R) — higher → trusts predictions more (smoother)
 */

export interface KalmanState {
    x: number;
    y: number;
}

export default class KalmanFilter2D {
    // State estimate
    private x: number;
    private y: number;

    // Error covariance (2×2 diagonal — NeuroLex)
    private px: number;
    private py: number;

    // Noise parameters
    private readonly qx: number; // process noise X
    private readonly qy: number; // process noise Y
    private readonly rx: number; // measurement noise X
    private readonly ry: number; // measurement noise Y

    private initialised = false;

    constructor(
        processNoise = 0.8,
        measurementNoise = 2.5,
    ) {
        this.x = 0;
        this.y = 0;
        this.px = 1;
        this.py = 1;
        this.qx = processNoise;
        this.qy = processNoise;
        this.rx = measurementNoise;
        this.ry = measurementNoise;
    }

    /** Feed a raw measurement and return the smoothed estimate. */
    update(measX: number, measY: number): KalmanState {
        if (!this.initialised) {
            // First observation — initialise state directly
            this.x = measX;
            this.y = measY;
            this.px = 1;
            this.py = 1;
            this.initialised = true;
            return { x: this.x, y: this.y };
        }

        // ── Predict ──
        // (constant-position model: predicted state = current state)
        const predX = this.x;
        const predY = this.y;
        const predPx = this.px + this.qx;
        const predPy = this.py + this.qy;

        // ── Update ──
        const kx = predPx / (predPx + this.rx); // Kalman gain X
        const ky = predPy / (predPy + this.ry); // Kalman gain Y

        this.x = predX + kx * (measX - predX);
        this.y = predY + ky * (measY - predY);

        this.px = (1 - kx) * predPx;
        this.py = (1 - ky) * predPy;

        return { x: this.x, y: this.y };
    }

    /** Get the current state without feeding a new observation. */
    getState(): KalmanState {
        return { x: this.x, y: this.y };
    }

    /** Reset filter state. */
    reset(): void {
        this.x = 0;
        this.y = 0;
        this.px = 1;
        this.py = 1;
        this.initialised = false;
    }
}
