/**
 * WebSpeechTTSService — Wrapper around the browser-native SpeechSynthesis API.
 * Handles queuing, speed control, word-boundary tracking, and the Chrome 15-second bug.
 * This is the ONLY TTS used in the app — no external APIs.
 */

// ──────────── Types ────────────

export interface TTSQueueItem {
    text: string;
    rate: number;
    type: 'word-revisit' | 'line-revisit' | 'pronunciation-correction' | 'manual';
    targetWordIndex: number | null;
    targetLineIndex: number | null;
    onStart?: () => void;
    onEnd?: () => void;
    onWordBoundary?: (charIndex: number, wordIndex: number) => void;
}

export interface TTSState {
    isPlaying: boolean;
    isSpeaking: boolean;
    currentText: string | null;
    currentRate: number;
    selectedVoice: SpeechSynthesisVoice | null;
    isSupported: boolean;
    queue: TTSQueueItem[];
}

// ──────────── Service ────────────

class WebSpeechTTSService {
    state: TTSState = {
        isPlaying: false,
        isSpeaking: false,
        currentText: null,
        currentRate: 1,
        selectedVoice: null,
        isSupported: false,
        queue: [],
    };

    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private queue: TTSQueueItem[] = [];
    private isProcessingQueue = false;
    private selectedVoice: SpeechSynthesisVoice | null = null;
    private chromeBugInterval: ReturnType<typeof setInterval> | null = null;
    private boundaryListeners = new Set<(charIndex: number, word: string) => void>();
    private endListeners = new Set<() => void>();

    // ──────────── Initialise ────────────

    initialise(): void {
        if (!window.speechSynthesis) {
            this.state.isSupported = false;
            console.warn('[WebSpeechTTS] SpeechSynthesis not supported in this browser');
            return;
        }

        this.state.isSupported = true;

        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) return;

            // Prefer Indian English male voice for a clear, slow pronunciation style.
            // Voice availability varies by browser / OS; try multiple patterns.
            const indianMale = voices.find(v =>
                v.lang === 'en-IN' &&
                (/male/i.test(v.name) || /ravi|hemant|prabhat|madhur/i.test(v.name)),
            );
            const anyIndian = voices.find(v => v.lang === 'en-IN');
            const googleIndian = voices.find(v =>
                v.lang === 'en-IN' && v.name.includes('Google'),
            );
            // Fallbacks: any male English → Google English → any English
            const maleEnglish = voices.find(v =>
                v.lang.startsWith('en') &&
                (/male/i.test(v.name) || /david|james|daniel|mark|richard|ravi/i.test(v.name)),
            );
            const englishGoogle = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
            const anyEnglish = voices.find(v => v.lang.startsWith('en'));

            this.selectedVoice =
                indianMale || googleIndian || anyIndian ||
                maleEnglish || englishGoogle || anyEnglish || voices[0];
            this.state.selectedVoice = this.selectedVoice;

            console.log('[WebSpeechTTS] Selected voice:', this.selectedVoice?.name, this.selectedVoice?.lang);
        };

        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();

        // Chrome bug workaround: pause/resume every 10s to prevent stalling at ~15s
        this.chromeBugInterval = setInterval(() => {
            if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            }
        }, 10000);
    }

    // ──────────── Queue Management ────────────

    speak(item: TTSQueueItem): void {
        this.queue.push(item);
        this.state.queue = [...this.queue];
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    speakImmediate(item: TTSQueueItem): void {
        window.speechSynthesis.cancel();
        this.queue = [item];
        this.state.queue = [...this.queue];
        this.isProcessingQueue = false;
        this.processQueue();
    }

    private processQueue(): void {
        if (this.queue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }
        if (this.isProcessingQueue) return;

        this.isProcessingQueue = true;
        const item = this.queue.shift()!;
        this.state.queue = [...this.queue];

        const utt = new SpeechSynthesisUtterance(item.text);
        utt.rate = Math.max(0.3, Math.min(1.0, item.rate));
        utt.pitch = 1.0;
        utt.volume = 1.0;
        if (this.selectedVoice) utt.voice = this.selectedVoice;

        utt.onstart = () => {
            this.state.isPlaying = true;
            this.state.isSpeaking = true;
            this.state.currentText = item.text;
            this.state.currentRate = item.rate;
            item.onStart?.();
        };

        utt.onboundary = (event: SpeechSynthesisEvent) => {
            if (event.name !== 'word') return;

            const charLen = (event as any).charLength || 10;
            const spokenWord = item.text.substring(
                event.charIndex,
                event.charIndex + charLen,
            ).trim();

            for (const listener of this.boundaryListeners) {
                listener(event.charIndex, spokenWord);
            }

            item.onWordBoundary?.(event.charIndex, 0);
        };

        utt.onend = () => {
            this.state.isPlaying = false;
            this.state.isSpeaking = false;
            this.state.currentText = null;
            this.currentUtterance = null;
            this.isProcessingQueue = false;
            item.onEnd?.();

            for (const listener of this.endListeners) {
                listener();
            }

            setTimeout(() => this.processQueue(), 300);
        };

        utt.onerror = (event: SpeechSynthesisErrorEvent) => {
            if (event.error === 'interrupted' || event.error === 'canceled') return;
            console.error('[WebSpeechTTS] Error:', event.error);
            this.isProcessingQueue = false;
            setTimeout(() => this.processQueue(), 500);
        };

        this.currentUtterance = utt;
        window.speechSynthesis.speak(utt);
    }

    // ──────────── Controls ────────────

    stop(): void {
        window.speechSynthesis.cancel();
        this.queue = [];
        this.state.queue = [];
        this.state.isPlaying = false;
        this.state.isSpeaking = false;
        this.isProcessingQueue = false;
        this.currentUtterance = null;
    }

    pause(): void {
        window.speechSynthesis.pause();
        this.state.isPlaying = false;
    }

    resume(): void {
        window.speechSynthesis.resume();
        this.state.isPlaying = true;
    }

    setVoice(voiceName: string): void {
        const voices = window.speechSynthesis.getVoices();
        const found = voices.find(v => v.name === voiceName);
        if (found) {
            this.selectedVoice = found;
            this.state.selectedVoice = found;
        }
    }

    getAvailableVoices(): SpeechSynthesisVoice[] {
        return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    }

    isCurrentlySpeaking(): boolean {
        return window.speechSynthesis.speaking;
    }

    // ──────────── Listeners ────────────

    addBoundaryListener(callback: (charIndex: number, word: string) => void): void {
        this.boundaryListeners.add(callback);
    }

    removeBoundaryListener(callback: (charIndex: number, word: string) => void): void {
        this.boundaryListeners.delete(callback);
    }

    addEndListener(callback: () => void): void {
        this.endListeners.add(callback);
    }

    removeEndListener(callback: () => void): void {
        this.endListeners.delete(callback);
    }

    // ──────────── Cleanup ────────────

    destroy(): void {
        if (this.chromeBugInterval) clearInterval(this.chromeBugInterval);
        this.stop();
        this.boundaryListeners.clear();
        this.endListeners.clear();
    }
}

export const webSpeechTTSService = new WebSpeechTTSService();
