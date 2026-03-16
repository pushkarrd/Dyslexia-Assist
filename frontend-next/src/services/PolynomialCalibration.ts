/**
 * PolynomialCalibration — Fits a 2nd-degree polynomial mapping from
 * iris feature vectors to screen (x, y) coordinates.
 *
 * Input feature per sample:  [irisX, irisY, irisX², irisY², irisX·irisY, 1]  (6 dims)
 * Output per sample:         [screenX, screenY]
 *
 * Matrix solve uses plain JS Gauss-Jordan elimination (6×6 — fast).
 * Prediction is pure arithmetic with no tensor overhead.
 */

// ──────────── Types ────────────

export interface CalibrationSample {
    irisX: number;   // normalised iris X (0–1)
    irisY: number;   // normalised iris Y (0–1)
    screenX: number; // pixel screen X
    screenY: number; // pixel screen Y
}

export interface PolyCoefficients {
    /** 6 coefficients for X prediction */
    cx: number[];
    /** 6 coefficients for Y prediction */
    cy: number[];
}

// ──────────── Helpers ────────────

/** Gauss-Jordan elimination to invert an n×n matrix. Returns null if singular. */
function invertMatrix(m: number[][]): number[][] | null {
    const n = m.length;
    // Augment with identity
    const aug: number[][] = m.map((row, i) => {
        const id = new Array(n).fill(0);
        id[i] = 1;
        return [...row, ...id];
    });

    for (let col = 0; col < n; col++) {
        // Partial pivoting
        let maxRow = col;
        let maxVal = Math.abs(aug[col][col]);
        for (let row = col + 1; row < n; row++) {
            const v = Math.abs(aug[row][col]);
            if (v > maxVal) { maxVal = v; maxRow = row; }
        }
        if (maxVal < 1e-12) return null; // singular
        if (maxRow !== col) [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

        // Scale pivot row
        const pivot = aug[col][col];
        for (let j = col; j < 2 * n; j++) aug[col][j] /= pivot;

        // Eliminate column
        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = aug[row][col];
            for (let j = col; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
        }
    }

    return aug.map((row) => row.slice(n));
}

// ──────────── Class ────────────

export default class PolynomialCalibration {
    private coefficients: PolyCoefficients | null = null;

    /** Build the feature row: [irisX, irisY, irisX², irisY², irisX·irisY, 1] */
    private static buildFeatureRow(ix: number, iy: number): number[] {
        return [ix, iy, ix * ix, iy * iy, ix * iy, 1];
    }

    /**
     * Compute calibration from collected samples.
     * Needs ≥ 6 samples (the number of polynomial terms).
     * Normal equations: β = (AᵀA + λI)⁻¹ · Aᵀ · Y
     *
     * Returns true if calibration succeeded.
     */
    computeCalibration(samples: CalibrationSample[]): boolean {
        if (samples.length < 6) {
            console.warn('[PolynomialCalibration] Need ≥6 samples, got', samples.length);
            return false;
        }

        const n = samples.length;
        const D = 6; // feature dimensions
        const RIDGE = 1e-6;

        // Build feature matrix A [n × D] and target vectors
        const A: number[][] = [];
        const sx: number[] = [];
        const sy: number[] = [];

        for (const s of samples) {
            A.push(PolynomialCalibration.buildFeatureRow(s.irisX, s.irisY));
            sx.push(s.screenX);
            sy.push(s.screenY);
        }

        // Compute AᵀA [D × D]
        const AtA: number[][] = Array.from({ length: D }, () => new Array(D).fill(0));
        for (let i = 0; i < D; i++) {
            for (let j = i; j < D; j++) {
                let sum = 0;
                for (let k = 0; k < n; k++) sum += A[k][i] * A[k][j];
                AtA[i][j] = sum + (i === j ? RIDGE : 0);
                AtA[j][i] = AtA[i][j]; // symmetric
            }
        }

        // Compute AᵀY [D × 2]
        const AtYx: number[] = new Array(D).fill(0);
        const AtYy: number[] = new Array(D).fill(0);
        for (let i = 0; i < D; i++) {
            for (let k = 0; k < n; k++) {
                AtYx[i] += A[k][i] * sx[k];
                AtYy[i] += A[k][i] * sy[k];
            }
        }

        // Invert AᵀA
        const inv = invertMatrix(AtA);
        if (!inv) {
            console.error('[PolynomialCalibration] Singular matrix — calibration failed');
            return false;
        }

        // β = inv(AᵀA) · AᵀY
        const cx: number[] = new Array(D).fill(0);
        const cy: number[] = new Array(D).fill(0);
        for (let i = 0; i < D; i++) {
            for (let j = 0; j < D; j++) {
                cx[i] += inv[i][j] * AtYx[j];
                cy[i] += inv[i][j] * AtYy[j];
            }
        }

        this.coefficients = { cx, cy };
        return true;
    }

    /**
     * Predict screen coordinates from iris features.
     * Pure arithmetic — no TF.js tensors used.
     */
    predict(irisX: number, irisY: number): { x: number; y: number } | null {
        if (!this.coefficients) return null;

        const f = PolynomialCalibration.buildFeatureRow(irisX, irisY);
        const { cx, cy } = this.coefficients;

        let x = 0;
        let y = 0;
        for (let i = 0; i < 6; i++) {
            x += cx[i] * f[i];
            y += cy[i] * f[i];
        }

        return { x, y };
    }

    /** Whether calibration coefficients have been computed. */
    isCalibrated(): boolean {
        return this.coefficients !== null;
    }

    /** Get the raw coefficients (for persistence). */
    getCoefficients(): PolyCoefficients | null {
        return this.coefficients ? { ...this.coefficients } : null;
    }

    /** Restore coefficients from a previous session. */
    setCoefficients(coeff: PolyCoefficients): void {
        this.coefficients = { ...coeff };
    }

    /** Clear calibration. */
    reset(): void {
        this.coefficients = null;
    }
}
