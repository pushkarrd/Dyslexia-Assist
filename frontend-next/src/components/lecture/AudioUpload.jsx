// Audio Upload Component
// Handles file upload, audio transcription using Web Speech API, and processing

import React, { useState, useRef } from 'react';
import { Upload, X, FileAudio, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function AudioUpload({ onUploadComplete, onClose }) {
  const { isDark } = useTheme();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState('');
  const [error, setError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTranscription, setManualTranscription] = useState('');
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      setError('Please select a valid audio file');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please drop a valid audio file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Transcribe audio using backend API (AssemblyAI)
  const transcribeAudio = async () => {
    if (!selectedFile) return;

    try {
      setIsTranscribing(true);
      setTranscriptionProgress('Uploading audio file...');
      setError('');

      // Create FormData to send file
      const formData = new FormData();
      formData.append('file', selectedFile);

      setTranscriptionProgress('Processing audio with AI...');

      // Send to backend API - use environment variable
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const apiUrl = API_BASE_URL.replace('/api', '') + '/api/transcribe-audio';

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Transcription failed');
      }

      const result = await response.json();

      setTranscriptionProgress('Transcription complete!');
      setIsTranscribing(false);

      if (!result.transcription || result.transcription.trim().length === 0) {
        setError('No speech detected in the audio file. Please try a different file with clear speech or use manual input.');
        return;
      }

      // Pass transcription to parent
      setTimeout(() => {
        if (onUploadComplete) {
          onUploadComplete(result.transcription.trim());
        }
      }, 500);

    } catch (err) {
      console.error('Error transcribing audio:', err);
      setIsTranscribing(false);

      // Show helpful error message
      if (err.message.includes('API key not configured')) {
        setError('Speech-to-text API is not configured. Please use "Enter Manually" option to input the transcription.');
      } else if (err.message.includes('timeout')) {
        setError('Transcription is taking too long. Please try a shorter audio file or use manual input.');
      } else {
        setError(err.message || 'Transcription failed. Please try manual input instead.');
      }
    }
  };

  // Cancel transcription
  const cancelTranscription = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Stop recognition failed:', e);
      }
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsTranscribing(false);
    setTranscriptionProgress('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`max-w-2xl w-full rounded-2xl p-8 ${isDark ? 'bg-gray-900 border-2 border-gray-700' : 'bg-white border-2 border-gray-300'
        }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Upload Audio File
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
            disabled={isTranscribing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* File upload area */}
        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDark
                ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50'
                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
            <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Drop audio file here or click to browse
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Supports: MP3, WAV, M4A, OGG (Max 50MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div>
            {/* Selected file info */}
            <div className={`border-2 rounded-xl p-6 mb-6 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
              }`}>
              <div className="flex items-center gap-4">
                <FileAudio className={`w-12 h-12 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <div className="flex-grow">
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedFile.name}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                {!isTranscribing && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                      }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Transcription progress */}
            {isTranscribing && (
              <div className={`rounded-xl p-6 mb-6 ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-300'
                }`}>
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <p className={`font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                    {transcriptionProgress}
                  </p>
                </div>
                <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  This may take a few minutes depending on audio length...
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 mb-6">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Manual transcription input */}
            {showManualInput && (
              <div className="mb-6">
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Enter or paste transcription manually:
                </label>
                <textarea
                  value={manualTranscription}
                  onChange={(e) => setManualTranscription(e.target.value)}
                  placeholder="Paste or type the audio transcription here..."
                  className={`w-full h-40 p-4 rounded-lg border-2 resize-none ${isDark
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              {!isTranscribing ? (
                <>
                  {!showManualInput ? (
                    <>
                      <button
                        onClick={transcribeAudio}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                      >
                        Auto Transcribe
                      </button>
                      <button
                        onClick={() => setShowManualInput(true)}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all ${isDark
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                          }`}
                      >
                        Enter Manually
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (manualTranscription.trim()) {
                            onUploadComplete(manualTranscription.trim());
                          } else {
                            setError('Please enter some transcription text.');
                          }
                        }}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all ${isDark
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        disabled={!manualTranscription.trim()}
                      >
                        Submit Transcription
                      </button>
                      <button
                        onClick={() => {
                          setShowManualInput(false);
                          setManualTranscription('');
                        }}
                        className={`px-6 py-3 rounded-lg font-semibold transition-all ${isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
                          }`}
                      >
                        Back
                      </button>
                    </>
                  )}
                  <button
                    onClick={onClose}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all ${isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
                      }`}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={cancelTranscription}
                  className="flex-1 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition-all"
                >
                  Stop Transcription
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
