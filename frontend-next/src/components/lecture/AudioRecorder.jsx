// Audio recorder component with visual feedback and live transcription
// Shows large record/stop button with pulse animation when recording
// Displays duration timer in MM:SS format
// Shows waveform animation when recording
// Props: onRecordingComplete - callback with audio blob when done
// Props: onTranscriptionUpdate - callback for live transcription updates
// Uses Web Speech API for live transcription

import React, { useEffect, useState, useRef } from 'react';
import useAudioRecorder from '../../hooks/useAudioRecorder';

export default function AudioRecorder({ onRecordingComplete, onTranscriptionUpdate, onRecordingStateChange }) {
  const { isRecording, audioBlob, duration, error, startRecording, stopRecording } = useAudioRecorder();
  const [transcription, setTranscription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const accumulatedTranscriptRef = useRef(''); // Store accumulated text across restarts

  // Initialize Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      // Mobile Android Chrome needs different language settings
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      recognitionRef.current.lang = isMobile ? 'en-US' : 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      console.log('🎤 Web Speech API initialized for:', isMobile ? 'Mobile' : 'Desktop');

      recognitionRef.current.onresult = (event) => {
        console.log('🎤 Speech detected! Results:', event.results.length);

        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;

          console.log(`Result ${i}:`, transcript, `(${event.results[i].isFinal ? 'Final' : 'Interim'}, confidence: ${confidence?.toFixed(2) || 'N/A'})`);

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Append final transcript to accumulated ref to persist across restarts
        if (finalTranscript) {
          accumulatedTranscriptRef.current += finalTranscript;
          console.log('✅ Final transcript added:', finalTranscript);
        }

        // Combine accumulated + interim for display
        const fullTranscript = accumulatedTranscriptRef.current + interimTranscript;
        setTranscription(accumulatedTranscriptRef.current);

        // Send live updates to parent
        if (onTranscriptionUpdate) {
          onTranscriptionUpdate(fullTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.log('🚨 Speech recognition error:', event.error);

        // Silently handle 'no-speech' and 'aborted' - they're normal during continuous recognition
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Don't log - this is expected behavior when there's silence
          return;
        } else if (event.error === 'audio-capture') {
          console.error('❌ Microphone error - please check your microphone');
          alert('Microphone error. Please ensure microphone is working.');
          setIsListening(false);
        } else if (event.error === 'not-allowed') {
          console.error('❌ Microphone permission denied');
          alert('Microphone access denied. Please allow microphone permissions in browser settings.');
          setIsListening(false);
        } else if (event.error === 'network') {
          console.error('❌ Network error - speech recognition requires internet connection');
          alert('Internet connection required for speech recognition. Please check your connection.');
          setIsListening(false);
        } else {
          console.error('❌ Speech recognition error:', event.error);
          alert(`Speech recognition error: ${event.error}. Try again or use manual input.`);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🔄 Speech recognition ended. IsRecording:', isRecording, 'IsListening:', isListening);

        // Auto-restart if still recording (with delay to prevent rapid restarts)
        if (isListening && isRecording) {
          setTimeout(() => {
            if (isListening && isRecording && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                console.log('✅ Speech recognition restarted');
              } catch (e) {
                // Silently fail - might be already started
                if (!e.message.includes('already started')) {
                  console.log('Recognition restart issue:', e.message);
                }
              }
            }
          }, 300); // 300ms delay for mobile compatibility
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.onstart = () => {
        console.log('✅ Speech recognition active and listening...');
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          console.log('📱 Mobile device detected - make sure you have internet connection for speech recognition');
        }
      };
    } else {
      console.warn('⚠️ Web Speech API not available on this browser');
      console.warn('Browser:', navigator.userAgent);
    }

    return () => {
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
    };
  }, [transcription, onTranscriptionUpdate, isListening, isRecording]);

  // Handle start recording
  const handleStartRecording = async () => {
    // Clear transcription immediately (no delay)
    setTranscription('');
    accumulatedTranscriptRef.current = '';

    // Notify parent to clear live transcription display immediately
    if (onTranscriptionUpdate) {
      onTranscriptionUpdate('');
    }

    await startRecording();

    // Notify parent that recording has started
    if (onRecordingStateChange) {
      onRecordingStateChange(true);
    }

    // Start speech recognition with a minimal delay after microphone starts
    if (recognitionRef.current) {
      setTimeout(() => {
        try {
          // Ensure recognition is stopped first (mobile compatibility)
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore - might not be running
          }

          // Small delay then start
          setTimeout(() => {
            setIsListening(true);
            recognitionRef.current.start();
            console.log('🎤 Speech recognition started - speak clearly into your microphone');
            console.log('📱 Device:', /Android/i.test(navigator.userAgent) ? 'Android' : 'Other');
          }, 100);
        } catch (e) {
          console.error('❌ Could not start speech recognition:', e.message);
          alert('Speech recognition unavailable. Your speech won\'t be transcribed, but audio will be recorded. You can add text manually later.');
          setIsListening(false);
        }
      }, 300); // Increased delay for mobile compatibility
    }
  };
  // Handle stop recording
  const handleStopRecording = () => {
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }

    stopRecording();

    // Notify parent that recording has stopped
    if (onRecordingStateChange) {
      onRecordingStateChange(false);
    }

    console.log('✅ Recording stopped');
  };

  // When recording stops and audioBlob is ready, pass it to parent
  useEffect(() => {
    if (audioBlob && onRecordingComplete) {
      onRecordingComplete(audioBlob, transcription);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, transcription]);

  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 p-4 sm:p-6 md:p-8 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
      {/* Title */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground drop-shadow-lg text-center">
        {isRecording ? '🎙️ Recording...' : '🎤 Ready to Record'}
      </h2>

      {/* Microphone & Speech Recognition Status */}
      {isRecording && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center text-xs sm:text-sm">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-600 dark:text-green-200">Microphone On</span>
          </div>
          {isListening && (
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-blue-600 dark:text-blue-200">Speech Recognition</span>
            </div>
          )}
        </div>
      )}

      {/* Record/Stop button */}
      {/* Large circular button - responsive sizes */}
      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        className={`
          w-24 sm:w-28 md:w-32 h-24 sm:h-28 md:h-32 rounded-full flex items-center justify-center text-2xl sm:text-3xl md:text-4xl
          transition-all duration-300 transform hover:scale-110 active:scale-95
          focus:outline-none focus:ring-4 focus:ring-blue-500/50 touch-target
          ${isRecording
            ? 'bg-red-600 animate-pulse shadow-lg shadow-red-600/50'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg'
          }
        `}
      >
        {isRecording ? '⏹️' : '⏺️'}
      </button>

      {/* Duration display */}
      <div className="text-xl sm:text-2xl md:text-3xl font-mono text-foreground drop-shadow-md">
        {formatDuration(duration)}
      </div>

      {/* Status text */}
      <p className="text-sm sm:text-base md:text-lg text-foreground/70 text-center max-w-xs sm:max-w-md drop-shadow-md">
        {isRecording
          ? 'Recording your lecture. Click stop when finished.'
          : 'Click to start recording your lecture.'}
      </p>

      {/* Error message if any */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm max-w-xs sm:max-w-md text-center">
          {error}
        </div>
      )}

      {/* Waveform animation when recording */}
      {isRecording && (
        <div className="flex items-center gap-1 h-12 sm:h-14 md:h-16">
          {/* 5 animated bars with different delays */}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 sm:w-2 bg-blue-400 rounded-full animate-pulse"
              style={{
                height: '100%',
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.8s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}