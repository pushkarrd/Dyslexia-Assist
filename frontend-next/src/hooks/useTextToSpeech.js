// Custom hook for Text-to-Speech functionality
// Optimized for dyslexic users with slower speech rate

import { useState, useEffect, useRef } from 'react';

export default function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    // Check if browser supports speech synthesis
    setIsSupported('speechSynthesis' in window);

    // Cleanup on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = (text, options = {}) => {
    if (!isSupported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Settings optimized for dyslexic users
    utterance.rate = options.rate || 0.75; // Slower rate (0.75 = 75% of normal speed)
    utterance.pitch = options.pitch || 1.0; // Normal pitch
    utterance.volume = options.volume || 1.0; // Full volume
    utterance.lang = options.lang || 'en-US';

    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    // Start speaking
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (isSupported && isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
    }
  };

  const resume = () => {
    if (isSupported && isSpeaking && isPaused) {
      window.speechSynthesis.resume();
    }
  };

  const stop = () => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  return {
    speak,
    pause,
    resume,
    stop,
    isSpeaking,
    isPaused,
    isSupported,
  };
}
