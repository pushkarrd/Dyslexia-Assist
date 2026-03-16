/**
 * FaceMeshService — Singleton that owns the MediaPipe FaceMesh detector,
 * camera stream and the frame loop. All consumers subscribe via onResults().
 *
 * Only ONE FaceMesh instance exists app-wide to avoid GPU contention.
 */

// Dynamic imports to avoid Turbopack ESM resolution errors with @mediapipe/face_mesh
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _faceLandmarksDetection: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tf: any = null;

async function loadDeps() {
    if (!_tf) {
        _tf = await import(/* webpackIgnore: true */ '@tensorflow/tfjs-core');
        await import(/* webpackIgnore: true */ '@tensorflow/tfjs-backend-webgl');
    }
    if (!_faceLandmarksDetection) {
        _faceLandmarksDetection = await import(/* webpackIgnore: true */ '@tensorflow-models/face-landmarks-detection');
    }
    return { tf: _tf, faceLandmarksDetection: _faceLandmarksDetection };
}

// ──────────── Types ────────────

export interface FaceMeshLandmark {
    x: number; // 0–1 normalised
    y: number;
    z: number;
}

export type FaceMeshResults = FaceMeshLandmark[] | null;

export type FaceMeshSubscriber = (landmarks: FaceMeshLandmark[]) => void;

// ──────────── Singleton ────────────

let _instance: FaceMeshService | null = null;

export default class FaceMeshService {
    private detector: any = null;
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private subscribers: Set<FaceMeshSubscriber> = new Set();
    private running = false;
    private rafId: number | null = null;
    private lastSendTs = 0;
    private readonly TARGET_FPS = 30;
    private readonly FRAME_INTERVAL = 1000 / 30; // ~33 ms

    /** Singleton accessor */
    static getInstance(): FaceMeshService {
        if (!_instance) _instance = new FaceMeshService();
        return _instance;
    }

    private constructor() { }

    // ──────────── Public API ────────────

    /** Subscribe to receive landmark arrays. Returns unsubscribe fn. */
    onResults(cb: FaceMeshSubscriber): () => void {
        this.subscribers.add(cb);
        return () => { this.subscribers.delete(cb); };
    }

    /** Returns the internal <video> element (for PiP mirroring). */
    getVideoElement(): HTMLVideoElement | null {
        return this.video;
    }

    /** True once the detector is ready AND the camera feed is live. */
    isReady(): boolean {
        return this.running && this.detector !== null;
    }

    /**
     * Initialise: request camera, create detector, start frame loop.
     * Safe to call multiple times — subsequent calls are no-ops if already running.
     */
    async start(): Promise<boolean> {
        if (this.running) return true;

        try {
            const { tf, faceLandmarksDetection } = await loadDeps();

            // 1. Ensure WebGL backend is ready
            await tf.setBackend('webgl');
            await tf.ready();

            // 2. Request webcam
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
            });

            this.video = document.createElement('video');
            this.video.srcObject = this.stream;
            this.video.playsInline = true;
            this.video.muted = true;
            await this.video.play();

            // 3. Create the FaceMesh detector with iris refinement
            const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
            this.detector = await faceLandmarksDetection.createDetector(model, {
                runtime: 'mediapipe' as const,
                solutionPath: '/mediapipe/face_mesh',
                refineLandmarks: true,  // CRITICAL — enables iris landmarks 468-477
                maxFaces: 1,
            });

            // 4. Start the frame loop
            this.running = true;
            this.loop();

            return true;
        } catch (err) {
            console.error('[FaceMeshService] Failed to start:', err);
            this.cleanup();
            return false;
        }
    }

    /** Tear down camera, detector and frame loop. */
    stop(): void {
        this.running = false;
        this.cleanup();
    }

    // ──────────── Internals ────────────

    private loop = (): void => {
        if (!this.running) return;

        const now = performance.now();
        if (now - this.lastSendTs >= this.FRAME_INTERVAL) {
            this.lastSendTs = now;
            this.processFrame();
        }

        this.rafId = requestAnimationFrame(this.loop);
    };

    private async processFrame(): Promise<void> {
        if (!this.detector || !this.video || this.video.readyState < 2) return;

        try {
            const faces = await this.detector.estimateFaces(this.video, {
                flipHorizontal: false,
            });

            if (faces.length > 0 && faces[0].keypoints) {
                // Convert keypoints to normalised FaceMeshLandmark[]
                const kps = faces[0].keypoints;
                const vw = this.video.videoWidth || 640;
                const vh = this.video.videoHeight || 480;

                const landmarks: FaceMeshLandmark[] = kps.map((kp) => ({
                    x: kp.x / vw,
                    y: kp.y / vh,
                    z: kp.z ?? 0,
                }));

                for (const sub of this.subscribers) {
                    try { sub(landmarks); } catch { /* subscriber error — ignore */ }
                }
            }
        } catch {
            // Frame estimation failed — skip silently
        }
    }

    private cleanup(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.detector) {
            try { this.detector.dispose(); } catch { /* ignore */ }
            this.detector = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
            this.video = null;
        }

        this.running = false;
    }
}
