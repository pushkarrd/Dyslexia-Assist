/**
 * MicrophoneService — Raw microphone capture and audio feature extraction
 * using Web Audio API. Separate from speech recognition.
 */

// ──────────── Types ────────────

export interface AudioFeatures {
    rms: number;
    isSpeaking: boolean;
    isSubvocalizing: boolean;
    zeroCrossingRate: number;
    spectralCentroid: number;
    isSilent: boolean;
    timestamp: number;
}

// ──────────── Service ────────────

class MicrophoneService {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private mediaStream: MediaStream | null = null;
    isActive = false;
    private featureListeners = new Map<string, (features: AudioFeatures) => void>();
    private processingInterval: ReturnType<typeof setInterval> | null = null;
    private speakingThreshold = 0.02;
    private subvocalThreshold = 0.005;
    private frequencyData: any = null;
    private timeData: any = null;
    isPermissionDenied = false;
    private lastRms = 0;

    async start(): Promise<boolean> {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
            });

            this.audioContext = new AudioContext({ sampleRate: 16000 });
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            source.connect(this.analyser);

            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Float32Array(this.analyser.fftSize);

            this.processingInterval = setInterval(() => this.processAudio(), 33);

            this.isActive = true;
            return true;
        } catch {
            this.isPermissionDenied = true;
            this.isActive = false;
            console.warn('[MicrophoneService] Microphone unavailable — voice input disabled');
            return false;
        }
    }

    private processAudio(): void {
        if (!this.analyser || !this.timeData || !this.frequencyData) return;

        this.analyser.getFloatTimeDomainData(this.timeData);

        // RMS
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            sum += this.timeData[i] * this.timeData[i];
        }
        const rms = Math.sqrt(sum / this.timeData.length);
        this.lastRms = rms;

        // Zero crossing rate
        let crossings = 0;
        for (let i = 1; i < this.timeData.length; i++) {
            if ((this.timeData[i] >= 0) !== (this.timeData[i - 1] >= 0)) crossings++;
        }
        const zcr = crossings / this.timeData.length;

        // Spectral centroid
        this.analyser.getByteFrequencyData(this.frequencyData);
        let weightedSum = 0;
        let totalMagnitude = 0;
        for (let i = 0; i < this.frequencyData.length; i++) {
            weightedSum += i * this.frequencyData[i];
            totalMagnitude += this.frequencyData[i];
        }
        const spectralCentroid = totalMagnitude > 0
            ? (weightedSum / totalMagnitude) / this.frequencyData.length
            : 0;

        const features: AudioFeatures = {
            rms,
            isSpeaking: rms > this.speakingThreshold,
            isSubvocalizing: rms > this.subvocalThreshold && rms <= this.speakingThreshold,
            isSilent: rms <= this.subvocalThreshold,
            zeroCrossingRate: zcr,
            spectralCentroid,
            timestamp: Date.now(),
        };

        for (const [, callback] of this.featureListeners) {
            callback(features);
        }
    }

    stop(): void {
        if (this.processingInterval) clearInterval(this.processingInterval);
        this.mediaStream?.getTracks().forEach(t => t.stop());
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(() => { });
        }
        this.isActive = false;
        this.analyser = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.frequencyData = null;
        this.timeData = null;
    }

    getVolumeLevel(): number {
        return this.isActive ? this.lastRms : 0;
    }

    addFeatureListener(id: string, callback: (f: AudioFeatures) => void): void {
        this.featureListeners.set(id, callback);
    }

    removeFeatureListener(id: string): void {
        this.featureListeners.delete(id);
    }

    isAvailable(): boolean {
        return this.isActive && !this.isPermissionDenied;
    }
}

export const microphoneService = new MicrophoneService();
