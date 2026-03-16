/**
 * GazeTTS — Invisible component that listens for `reread` DOM events
 * (fired by useRereadDetector) and auto-reads the struggling line's text
 * aloud using the Web Speech API.
 *
 * Props:
 *   containerRef — ref to the reading container holding [data-line-index] divs
 *   enabled      — master toggle (default: true)
 *   rate         — speech rate 0.5–2.0 (default: 0.85 — slower for dyslexia)
 *   lang         — BCP-47 language tag (default: 'en-US')
 */

import { useEffect, useRef, useCallback } from 'react';

const QUEUE_COOLDOWN_MS = 5000; // Don't re-read the same line within 5s

export default function GazeTTS({
    containerRef,
    enabled = true,
    rate = 0.85,
    lang = 'en-US',
}) {
    const lastSpokenRef = useRef(new Map()); // Map<lineIndex, timestamp>
    const utteranceRef = useRef(null);

    const speak = useCallback(
        (text) => {
            if (!('speechSynthesis' in window)) return;

            // Cancel any current speech
            window.speechSynthesis.cancel();

            const utt = new SpeechSynthesisUtterance(text);
            utt.rate = rate;
            utt.lang = lang;
            utt.pitch = 1;
            utt.volume = 1;
            utteranceRef.current = utt;

            window.speechSynthesis.speak(utt);
        },
        [rate, lang]
    );

    useEffect(() => {
        if (!enabled) return;

        const handler = (e) => {
            const { lineIndex } = e.detail;
            const now = Date.now();

            // Cooldown — don't re-read same line too quickly
            const lastSpoken = lastSpokenRef.current.get(lineIndex);
            if (lastSpoken && now - lastSpoken < QUEUE_COOLDOWN_MS) return;

            // Find the text content of that line
            const el = containerRef?.current;
            if (!el) return;

            const lineEl = el.querySelector(`[data-line-index="${lineIndex}"]`);
            if (!lineEl) return;

            const text = lineEl.textContent?.trim();
            if (!text) return;

            lastSpokenRef.current.set(lineIndex, now);
            speak(text);
        };

        window.addEventListener('reread', handler);
        return () => {
            window.removeEventListener('reread', handler);
            // Cancel speech on unmount
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, [enabled, containerRef, speak]);

    // Cancel speech when disabled mid-read
    useEffect(() => {
        if (!enabled && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }, [enabled]);

    // Render nothing — this is a behaviour-only component
    return null;
}
