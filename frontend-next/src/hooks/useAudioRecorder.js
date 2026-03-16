// Custom hook for recording audio from microphone
// Uses Web Audio API and MediaRecorder
// Returns: isRecording, audioBlob, duration, startRecording, stopRecording, error
// Handles microphone permissions and errors
// Records in chunks for streaming to backend later
// Audio format: WAV or WebM depending on browser support

import { useState, useRef, useCallback } from 'react';

export default function useAudioRecorder() {
  // State for recording status, audio blob, duration, errors
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  
  // Refs for MediaRecorder, audio stream, chunks, timer
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  
  // Start recording function
  // 1. Request microphone permission
  // 2. Create MediaRecorder with audio stream
  // 3. Set up ondataavailable to collect chunks
  // 4. Set up onstop to create final blob
  // 5. Start recording with timeslice (1000ms for 1 second chunks)
  // 6. Start duration timer
  const startRecording = useCallback(async () => {
    try {
      // Reset state
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];
      setDuration(0);
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording. Please use Chrome, Edge, or Firefox.');
      }
      
      // Request microphone access with enhanced constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      audioStreamRef.current = stream;
      
      // Check if we got a valid audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      }
      
      console.log('Microphone access granted:', audioTracks[0].label);
      
      // Determine best audio format - mobile-friendly priority order
      let mimeType = '';
      const formats = [
        'audio/webm;codecs=opus',  // Chrome desktop/mobile
        'audio/webm',               // Firefox
        'audio/mp4',                // Safari desktop/iOS
        'audio/ogg;codecs=opus',    // Fallback
        'audio/wav',                // Legacy fallback
        ''                          // Let browser decide
      ];
      
      for (const format of formats) {
        if (format === '' || MediaRecorder.isTypeSupported(format)) {
          mimeType = format;
          break;
        }
      }
      
      // Create MediaRecorder with best format
      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream); // Let browser choose
      
      mediaRecorderRef.current = mediaRecorder;
      
      const finalType = mimeType || 'browser-default';
      console.log('Recording with format:', finalType);
      
      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      // Handle stop event
      mediaRecorder.onstop = () => {
        console.log('🎙️ Recording stopped. Chunks:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        console.log('📦 Audio blob created:', blob.size, 'bytes, type:', blob.type);
        setAudioBlob(blob);
        chunksRef.current = [];
      };
      
      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError('Recording error: ' + event.error);
      };
      
      // Start recording with 1 second chunks
      mediaRecorder.start(1000);
      console.log('✅ MediaRecorder started successfully');
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      
      setIsRecording(true);
      console.log('✅ Recording state set to true');
    } catch (err) {
      console.error('Error starting recording:', err);
      
      // Provide user-friendly error messages
      let errorMessage = err.message;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please allow microphone permissions in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application. Please close other apps and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Could not start microphone with the requested settings. Please try a different microphone.';
      } else if (err.name === 'TypeError') {
        errorMessage = 'Browser does not support audio recording. Please use Chrome, Edge, or Firefox.';
      }
      
      setError(errorMessage);
      alert(errorMessage);
    }
  }, []);
  
  // Stop recording function
  // Stops the MediaRecorder and timer, resets duration
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks immediately (stops microphone access)
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        audioStreamRef.current = null;
      }
      
      // Clear timer and reset duration to 0
      clearInterval(timerRef.current);
      setDuration(0);
      
      setIsRecording(false);
    }
  }, [isRecording]);
  
  return {
    isRecording,
    audioBlob,
    duration,
    error,
    startRecording,
    stopRecording,
  };
}