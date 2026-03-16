"use client";

// Dyslexia-Friendly Reading Interface
// Features: Read Aloud (TTS), syllable breakdown, gaze tracking, PDF/text upload

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    BookOpen, Upload, Play, Pause, ArrowLeft,
    Volume2, VolumeX, Type, Eye, FileText, Loader2,
    SplitSquareHorizontal, Crosshair, BarChart3, Zap,
} from 'lucide-react';
import useDyslexiaStore from '@/stores/dyslexiaStore';
import { useAuth } from '@/context/AuthContext';
import { logReadingSession } from '@/services/progressService';
// Gaze tracking
import { GazeProvider, useGaze } from '@/context/GazeContext';
import CalibrationWizard from '@/components/gaze/CalibrationWizard';
import GazeHighlighter from '@/components/gaze/GazeHighlighter';
import GazeHeatmap from '@/components/gaze/GazeHeatmap';
import GazePiP from '@/components/gaze/GazePiP';
import WordHighlighter from '@/components/gaze/WordHighlighter';
import ReadingAnalytics from '@/components/gaze/ReadingAnalytics';
import useLineMapper, { splitIntoReadingLines } from '@/hooks/useLineMapper';
import useRereadDetector from '@/hooks/useRereadDetector';
import useAdaptiveTypography from '@/hooks/useAdaptiveTypography';
import {
    startGazeSession, recordLineGaze, recordRereadEvent,
    recordAdaptiveLevel, endGazeSession, getCurrentSessionSnapshot,
} from '@/services/gazeAnalytics';

// Wrapper that provides gaze context
export default function ReadingPage() {
    return (
        <GazeProvider>
            <ReadingPageInner />
        </GazeProvider>
    );
}

function ReadingPageInner() {
    const router = useRouter();
    const { currentUser: user } = useAuth();
    const [text, setText] = useState('');
    const [textError, setTextError] = useState('');
    const readingStartRef = useRef(null);
    const [isReading, setIsReading] = useState(false);
    const [displayMode, setDisplayMode] = useState('input'); // input | reading
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
    const [speechRate, setSpeechRate] = useState(1);
    const [isExtractingPDF, setIsExtractingPDF] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [syllableMode, setSyllableMode] = useState(false);
    const [language, setLanguage] = useState<'en' | 'hi' | 'kn'>('en');
    const textDisplayRef = useRef(null);
    const utteranceRef = useRef(null);
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
    const googleTTSAudioRef = useRef<HTMLAudioElement | null>(null);

    // Pre-load TTS voices — Chrome populates voices asynchronously
    useEffect(() => {
        const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
        load();
        window.speechSynthesis.addEventListener('voiceschanged', load);
        return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
    }, []);

    // Gaze tracking state
    const { startGaze, stopGaze, gazeActive, isCalibrated, setCalibrated, faceLandmarksRef, faceMeshService } = useGaze();
    const [gazeEnabled, setGazeEnabled] = useState(false);
    const [showCalibration, setShowCalibration] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapSnapshot, setHeatmapSnapshot] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Gaze hooks (only active when gazeEnabled && displayMode === 'reading')
    const gazeReading = gazeEnabled && displayMode === 'reading';
    const { currentLine, rebuildRects } = useLineMapper(gazeReading ? textDisplayRef : { current: null });
    const { rereadLines, rereadLog, resetReread } = useRereadDetector(gazeReading ? currentLine : -1, gazeReading);
    const { getLineStyle, getLineLevel, resetTypography } = useAdaptiveTypography(rereadLines, gazeReading);

    // Record line gaze for analytics
    useEffect(() => {
        if (gazeReading && currentLine >= 0) {
            recordLineGaze(currentLine);
            const level = getLineLevel(currentLine);
            if (level > 0) recordAdaptiveLevel(currentLine, level);
        }
    }, [currentLine, gazeReading, getLineLevel]);

    // Record reread events for analytics
    useEffect(() => {
        if (!gazeReading) return;
        const handler = (e) => {
            const { lineIndex, count } = e.detail;
            recordRereadEvent(lineIndex, count);
        };
        window.addEventListener('reread', handler);
        return () => window.removeEventListener('reread', handler);
    }, [gazeReading]);

    // Reset syllable mode when switching to non-Latin language
    useEffect(() => {
        if (language !== 'en') setSyllableMode(false);
    }, [language]);

    // Toggle gaze tracking
    const handleToggleGaze = useCallback(async () => {
        if (gazeEnabled) {
            stopGaze();
            setGazeEnabled(false);
            const snap = getCurrentSessionSnapshot();
            setHeatmapSnapshot(snap);
            await endGazeSession();
        } else {
            const ok = await startGaze();
            if (ok) {
                setGazeEnabled(true);
                if (!isCalibrated) {
                    setShowCalibration(true);
                }
            }
        }
    }, [gazeEnabled, startGaze, stopGaze, isCalibrated]);

    const { dyslexicFont, fontSize, letterSpacing, wordSpacing, lineHeight, focusMode } = useDyslexiaStore();

    const speedOptions = [0.5, 0.8, 1, 1.2, 1.5, 2];

    const LANGUAGE_CONFIG = {
        en: {
            label: 'English',
            bcp47: 'en-IN',
            samples: [
                {
                    title: "Photosynthesis",
                    text: "Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water. Photosynthesis in plants generally involves the green pigment chlorophyll and generates oxygen as a byproduct. The process takes place primarily in the leaves of plants. Light energy is absorbed by chlorophyll, a green pigment contained in structures called chloroplasts."
                },
                {
                    title: "The Water Cycle",
                    text: "The water cycle describes how water evaporates from the surface of the earth, rises into the atmosphere, cools and condenses into rain or snow in clouds, and falls again to the surface as precipitation. The water falling on land collects in rivers and lakes, soil, and porous layers of rock, and much of it flows back into the oceans, where it will once more evaporate. The cycling of water in and out of the atmosphere is a significant aspect of the weather patterns on Earth."
                },
                {
                    title: "Simple Machines",
                    text: "A simple machine is a device that changes the direction or magnitude of a force. The six classical simple machines are the lever, wheel and axle, pulley, inclined plane, wedge, and screw. Simple machines are the basis for all mechanical systems. They make work easier by allowing us to push or pull over increased distances or with less force."
                },
            ],
        },
        hi: {
            label: 'हिंदी',
            bcp47: 'hi-IN',
            samples: [
                {
                    title: "प्रकाश संश्लेषण",
                    text: "प्रकाश संश्लेषण वह प्रक्रिया है जिसके द्वारा हरे पौधे सूर्य के प्रकाश का उपयोग करके भोजन बनाते हैं। पत्तियों में हरे रंग का क्लोरोफिल होता है जो सूर्य की ऊर्जा को अवशोषित करता है। पौधे कार्बन डाइऑक्साइड और पानी का उपयोग करके ग्लूकोज और ऑक्सीजन बनाते हैं। यह प्रक्रिया पृथ्वी पर जीवन के लिए अत्यंत महत्वपूर्ण है।"
                },
                {
                    title: "जल चक्र",
                    text: "जल चक्र प्रकृति में पानी के निरंतर प्रवाह को दर्शाता है। सूर्य की गर्मी से नदियों और समुद्रों का पानी भाप बनकर ऊपर उठता है। यह भाप ठंडी होकर बादलों के रूप में बदलती है। फिर वर्षा या हिम के रूप में धरती पर वापस आती है। यही चक्र बार-बार दोहराता है और पृथ्वी पर जीवन को बनाए रखता है।"
                },
                {
                    title: "सौर मंडल",
                    text: "सौर मंडल में सूर्य और उसके चारों ओर घूमने वाले आठ ग्रह हैं। सूर्य एक विशाल तारा है जो हमें प्रकाश और ऊर्जा देता है। पृथ्वी सूर्य से तीसरा ग्रह है और एकमात्र ग्रह है जहाँ जीवन पाया जाता है। बृहस्पति सबसे बड़ा ग्रह है और शनि के चारों ओर सुंदर वलय हैं।"
                },
            ],
        },
        kn: {
            label: 'ಕನ್ನಡ',
            bcp47: 'kn-IN',
            samples: [
                {
                    title: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ",
                    text: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂಬುದು ಹಸಿರು ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಬಳಸಿ ಆಹಾರ ತಯಾರಿಸುವ ಪ್ರಕ್ರಿಯೆ. ಸಸ್ಯದ ಎಲೆಗಳಲ್ಲಿರುವ ಕ್ಲೋರೋಫಿಲ್ ಎಂಬ ಹಸಿರು ವರ್ಣದ್ರವ್ಯ ಸೂರ್ಯನ ಶಕ್ತಿಯನ್ನು ಹೀರಿಕೊಳ್ಳುತ್ತದೆ. ಸಸ್ಯಗಳು ಇಂಗಾಲದ ಡೈಆಕ್ಸೈಡ್ ಮತ್ತು ನೀರನ್ನು ಬಳಸಿ ಗ್ಲೂಕೋಸ್ ಮತ್ತು ಆಮ್ಲಜನಕ ತಯಾರಿಸುತ್ತವೆ."
                },
                {
                    title: "ನೀರಿನ ಚಕ್ರ",
                    text: "ನೀರಿನ ಚಕ್ರ ಪ್ರಕೃತಿಯಲ್ಲಿ ನೀರಿನ ನಿರಂತರ ಚಲನೆಯನ್ನು ವಿವರಿಸುತ್ತದೆ. ಸೂರ್ಯನ ಶಾಖದಿಂದ ನದಿ ಮತ್ತು ಸಮುದ್ರದ ನೀರು ಆವಿಯಾಗಿ ಮೇಲೇರುತ್ತದೆ. ಈ ಆವಿ ತಣ್ಣಗಾಗಿ ಮೋಡಗಳಾಗಿ ಮಾರ್ಪಡುತ್ತದೆ. ನಂತರ ಮಳೆ ಅಥವಾ ಹಿಮದ ರೂಪದಲ್ಲಿ ಭೂಮಿಗೆ ಮರಳುತ್ತದೆ."
                },
                {
                    title: "ಸೌರಮಂಡಲ",
                    text: "ಸೌರಮಂಡಲದಲ್ಲಿ ಸೂರ್ಯ ಮತ್ತು ಅದರ ಸುತ್ತ ಸುತ್ತುವ ಎಂಟು ಗ್ರಹಗಳಿವೆ. ಸೂರ್ಯ ಒಂದು ದೈತ್ಯ ನಕ್ಷತ್ರ ಮತ್ತು ಅದು ನಮಗೆ ಬೆಳಕು ಮತ್ತು ಶಕ್ತಿ ನೀಡುತ್ತದೆ. ಭೂಮಿ ಸೂರ್ಯನಿಂದ ಮೂರನೇ ಗ್ರಹ ಮತ್ತು ಜೀವ ಇರುವ ಏಕೈಕ ಗ್ರಹ. ಗುರು ಅತ್ಯಂತ ದೊಡ್ಡ ಗ್ರಹ ಮತ್ತು ಶನಿಯ ಸುತ್ತ ಸುಂದರ ಉಂಗುರಗಳಿವೆ."
                },
            ],
        },
    } as const;

    // Helper: pick the best available TTS voice for a BCP-47 lang code
    const getVoiceForLang = (bcp47: string): SpeechSynthesisVoice | null => {
        // Use cached voices; fall back to live call if cache is empty
        const voices = voicesRef.current.length > 0
            ? voicesRef.current
            : window.speechSynthesis.getVoices();
        return (
            voices.find(v => v.lang === bcp47) ??
            voices.find(v => v.lang.startsWith(bcp47.slice(0, 2))) ??
            null
        );
    };

    const handleStartReading = () => {
        if (text.trim()) {
            setDisplayMode('reading');
            setIsReading(true);
            readingStartRef.current = Date.now();
            if (gazeEnabled) {
                const lines = splitIntoReadingLines(text);
                startGazeSession('reading', lines.length);
            }
        }
    };

    const handleStopReading = () => {
        if (user?.uid && readingStartRef.current) {
            const elapsed = Math.round((Date.now() - readingStartRef.current) / 1000);
            logReadingSession(user.uid, { textLength: text.length, readingTime: elapsed });
            readingStartRef.current = null;
        }
        setDisplayMode('input');
        setIsSpeaking(false);
        window.speechSynthesis.cancel();
        if (googleTTSAudioRef.current) {
            googleTTSAudioRef.current.pause();
            googleTTSAudioRef.current = null;
        }
        if (gazeEnabled) {
            const snap = getCurrentSessionSnapshot();
            setHeatmapSnapshot(snap);
            endGazeSession();
            resetReread();
            resetTypography();
        }
        setShowAnalytics(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadError('');

        if (file.type === 'application/pdf') {
            setIsExtractingPDF(true);
            try {
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const items = content.items;
                    let lastY = null;
                    let lineText = '';
                    for (const item of items) {
                        const ti = item as any;
                        if (lastY !== null && Math.abs(ti.transform[5] - lastY) > 2) {
                            fullText += lineText.trim() + '\n';
                            lineText = '';
                        }
                        lineText += ti.str + ' ';
                        lastY = ti.transform[5];
                    }
                    if (lineText.trim()) fullText += lineText.trim() + '\n';
                    fullText += '\n';
                }
                const extracted = fullText.trim();
                if (!extracted) {
                    setUploadError('Could not extract text from this PDF. It may be scanned/image-based.');
                } else {
                    setText(extracted);
                }
            } catch (err) {
                setUploadError('Failed to read PDF. Please try a different file or paste text manually.');
            } finally {
                setIsExtractingPDF(false);
            }
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (ev) => { setText(ev.target.result as string); };
            reader.onerror = () => { setUploadError('Failed to read the text file.'); };
            reader.readAsText(file);
        } else {
            setUploadError('Unsupported file type. Please upload a .pdf or .txt file.');
        }
        e.target.value = '';
    };

    const handleSpeak = async () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            if (googleTTSAudioRef.current) {
                googleTTSAudioRef.current.pause();
                googleTTSAudioRef.current = null;
            }
            setIsSpeaking(false);
            setHighlightedWordIndex(-1);
            return;
        }

        const bcp47 = LANGUAGE_CONFIG[language].bcp47;
        const voice = getVoiceForLang(bcp47);

        // English: use Web Speech API (native voice available)
        if (language === 'en' && voice) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = speechRate;
            utterance.pitch = 1.0;
            utterance.lang = bcp47;
            utterance.voice = voice;
            const wordsArr = text.split(/\s+/).filter(w => w.length > 0);
            let wordIndex = 0;
            utterance.onboundary = (event) => {
                if (event.name === 'word' && wordIndex < wordsArr.length) {
                    setHighlightedWordIndex(wordIndex);
                    wordIndex++;
                }
            };
            utterance.onend = () => { setIsSpeaking(false); setHighlightedWordIndex(-1); };
            utterance.onerror = () => { setIsSpeaking(false); setHighlightedWordIndex(-1); };
            utteranceRef.current = utterance;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
            return;
        }

        // Hindi/Kannada: Try Web Speech API first, then fall back to backend proxy
        if (voice) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = speechRate;
            utterance.pitch = 1.0;
            utterance.lang = bcp47;
            utterance.voice = voice;
            const wordsArr = text.split(/\s+/).filter(w => w.length > 0);
            let wordIndex = 0;
            utterance.onboundary = (event) => {
                if (event.name === 'word' && wordIndex < wordsArr.length) {
                    setHighlightedWordIndex(wordIndex);
                    wordIndex++;
                }
            };
            utterance.onend = () => { setIsSpeaking(false); setHighlightedWordIndex(-1); };
            utterance.onerror = () => { setIsSpeaking(false); setHighlightedWordIndex(-1); };
            utteranceRef.current = utterance;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
            return;
        }

        // No native voice: use backend TTS proxy (Google Translate via backend)
        try {
            setIsSpeaking(true);
            const allWords = text.split(/\s+/).filter(w => w.length > 0);

            // Split text into chunks of max 200 chars
            const chunks: string[] = [];
            const sentences = text.match(/[^।.!?\n]+[।.!?\n]*/g) || [text];
            let current = '';
            for (const s of sentences) {
                if ((current + s).length <= 200) { current += s; }
                else { if (current.trim()) chunks.push(current.trim()); current = s; }
            }
            if (current.trim()) chunks.push(current.trim());

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';
            let chunkIdx = 0;
            let wordIdx = 0;

            const playChunk = async () => {
                if (chunkIdx >= chunks.length) {
                    setIsSpeaking(false);
                    setHighlightedWordIndex(-1);
                    googleTTSAudioRef.current = null;
                    return;
                }

                const chunkText = chunks[chunkIdx];
                const chunkWords = chunkText.split(/\s+/).filter(w => w.length > 0);

                try {
                    const response = await fetch(`${backendUrl}/api/tts/synthesize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: chunkText, language, rate: speechRate })
                    });

                    if (!response.ok) throw new Error(`TTS error: ${response.status}`);

                    const data = await response.json();
                    const binaryString = atob(data.audio);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    const audioBlob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.playbackRate = Math.min(Math.max(speechRate, 0.5), 2);

                    // Word highlighting during playback
                    const chunkStartWord = wordIdx;
                    const highlightInterval = setInterval(() => {
                        if (!audio.paused && audio.duration > 0) {
                            const progress = audio.currentTime / audio.duration;
                            const idx = chunkStartWord + Math.min(
                                Math.floor(progress * chunkWords.length),
                                chunkWords.length - 1
                            );
                            if (idx < allWords.length) setHighlightedWordIndex(idx);
                        }
                    }, 100);

                    audio.onended = () => {
                        clearInterval(highlightInterval);
                        URL.revokeObjectURL(audioUrl);
                        chunkIdx++;
                        wordIdx += chunkWords.length;
                        playChunk();
                    };

                    audio.onerror = () => {
                        clearInterval(highlightInterval);
                        URL.revokeObjectURL(audioUrl);
                        chunkIdx++;
                        wordIdx += chunkWords.length;
                        playChunk(); // Skip failed chunk, continue
                    };

                    googleTTSAudioRef.current = audio;
                    audio.play();
                } catch (err) {
                    console.error('Chunk fetch error:', err);
                    chunkIdx++;
                    wordIdx += chunkWords.length;
                    playChunk(); // Skip failed chunk
                }
            };

            await playChunk();
        } catch (err) {
            console.error('TTS error:', err);
            setIsSpeaking(false);
            setHighlightedWordIndex(-1);
        }
    };

    const words = text.split(/\s+/).filter(w => w.length > 0);

    const breakIntoSyllables = (word) => {
        const punctMatch = word.match(/^([^a-zA-Z]*)(.*?)([^a-zA-Z]*)$/);
        if (!punctMatch) return word;
        const [, leadPunct, core, trailPunct] = punctMatch;
        if (core.length < 6) return word;
        const lower = core.toLowerCase();
        const syllables = [];
        let current = '';
        const isVowel = (c) => 'aeiouy'.includes(c);
        for (let i = 0; i < core.length; i++) {
            current += core[i];
            if (i < core.length - 1) {
                const curIsVowel = isVowel(lower[i]);
                const nextIsVowel = isVowel(lower[i + 1]);
                if (curIsVowel && !nextIsVowel && i + 2 < core.length && isVowel(lower[i + 2])) {
                    syllables.push(current); current = '';
                } else if (!curIsVowel && !nextIsVowel && current.length > 1 && i + 1 < core.length - 1) {
                    const blend = lower[i] + lower[i + 1];
                    const commonBlends = ['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'ph', 'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'str', 'sw', 'th', 'tr', 'tw', 'wh', 'wr'];
                    if (!commonBlends.includes(blend)) { syllables.push(current); current = ''; }
                } else if (!curIsVowel && nextIsVowel && current.length > 2) {
                    const lastChar = current[current.length - 1];
                    syllables.push(current.slice(0, -1));
                    current = lastChar;
                }
            }
        }
        if (current) syllables.push(current);
        if (syllables.length <= 1) return word;
        return leadPunct + syllables.join('\u00B7') + trailPunct;
    };

    const renderWord = (word, i) => {
        const isHighlighted = highlightedWordIndex === i;

        if (syllableMode && word.replace(/[^a-zA-Z]/g, '').length >= 6) {
            const broken = breakIntoSyllables(word);
            const parts = broken.split('\u00B7');
            if (parts.length > 1) {
                return (
                    <span
                        key={i}
                        data-word-index={i}
                        className={`inline transition-colors duration-150 ${isHighlighted ? 'bg-indigo-500/30 text-white rounded px-1' : 'text-foreground/90'}`}
                    >
                        {parts.map((part, pi) => (
                            <span key={pi}>
                                {part}
                                {pi < parts.length - 1 && (
                                    <span className="text-indigo-400 font-bold mx-[1px] text-[0.7em]">{'\u00B7'}</span>
                                )}
                            </span>
                        ))}
                        {' '}
                    </span>
                );
            }
        }
        return (
            <span
                key={i}
                data-word-index={i}
                className={`inline transition-colors duration-150 ${isHighlighted ? 'bg-indigo-500/30 text-white rounded px-1' : 'text-foreground/90'}`}
            >
                {word}{' '}
            </span>
        );
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-4xl mx-4 sm:mx-auto pt-6 pb-2 content-blur-card p-4 sm:p-6 mt-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground mb-2">
                    📖 Reading Assistant
                </h1>
                <p className="text-base text-muted-foreground">
                    Read with dyslexia-friendly tools, word highlighting and text-to-speech
                </p>
            </div>

            <div className="max-w-4xl mx-4 sm:mx-auto py-8 content-blur-card p-4 sm:p-8">
                {displayMode === 'input' ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Info banner */}
                        <div className="rounded-2xl p-6 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                            <div className="flex items-start gap-3">
                                <Eye size={24} className="text-indigo-400 mt-1 shrink-0" />
                                <div>
                                    <h2 className="text-lg font-semibold mb-1">Dyslexia-Friendly Reading</h2>
                                    <p className="text-foreground/60 text-sm">
                                        Paste or upload any text to read it with OpenDyslexic font, adjustable spacing,
                                        colour overlays, reading ruler, and Read Aloud. Use the accessibility toolbar
                                        (bottom-right) to customise your experience.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Language selector */}
                        <div>
                            <label className="block text-sm text-foreground/60 mb-2">Select Language</label>
                            <div className="flex items-center gap-2">
                                {(Object.keys(LANGUAGE_CONFIG) as ('en' | 'hi' | 'kn')[]).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => { setLanguage(lang); setText(''); }}
                                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            background: language === lang ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.05)',
                                            border: `1px solid ${language === lang ? 'rgba(99,102,241,0.6)' : 'rgba(0,0,0,0.2)'}`,
                                            color: language === lang ? '#4f46e5' : '#111827',
                                        }}
                                    >
                                        {LANGUAGE_CONFIG[lang].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Text input */}
                        <div>
                            <label className="block text-sm text-foreground/60 mb-2">Paste your text here</label>
                            <textarea
                                value={text}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setText(val);
                                    if (val.trim().length > 5) {
                                        if (!/\p{L}/u.test(val)) {
                                            setTextError('Please enter readable text — only letters, words, or sentences are accepted. Dots, spaces, or symbols alone are not valid.');
                                        } else {
                                            const nonSpace = val.replace(/\s/g, '').length;
                                            const letters = (val.match(/\p{L}/gu) || []).length;
                                            if (nonSpace > 10 && letters / nonSpace < 0.1) {
                                                setTextError('Text appears to be mostly symbols or numbers. Please enter readable content in any language.');
                                            } else {
                                                setTextError('');
                                            }
                                        }
                                    } else {
                                        setTextError('');
                                    }
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (!val) { setTextError(''); return; }
                                    if (!/\p{L}/u.test(val)) {
                                        setTextError('Please enter readable text — only letters, words, or sentences are accepted.');
                                    }
                                }}
                                rows={8}
                                placeholder="Paste or type the text you want to read..."
                                className={`w-full rounded-xl p-4 bg-white/10 backdrop-blur-md border text-foreground placeholder-foreground/30 focus:outline-none resize-none transition-colors ${
                                    textError
                                        ? 'border-red-500/70 focus:border-red-500'
                                        : 'border-white/15 focus:border-indigo-500'
                                }`}
                                style={{ fontSize: '16px', lineHeight: '1.6' }}
                            />
                            {textError && (
                                <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
                                    <span>⚠</span> {textError}
                                </p>
                            )}
                        </div>

                        {/* File upload */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
                                <Upload size={18} />
                                <span className="text-sm">Upload .txt file</span>
                                <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 cursor-pointer transition-colors">
                                <FileText size={18} className="text-indigo-400" />
                                <span className="text-sm">Upload PDF</span>
                                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                            </label>
                            {isExtractingPDF && (
                                <div className="flex items-center gap-2 text-indigo-400 text-sm">
                                    <Loader2 size={16} className="animate-spin" />
                                    Extracting text from PDF...
                                </div>
                            )}
                            <span className="text-foreground/40 text-sm">or pick a sample →</span>
                        </div>
                        {uploadError && (
                            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                                {uploadError}
                            </div>
                        )}

                        {/* Sample texts */}
                        <div>
                            <h3 className="text-sm text-foreground/60 mb-3">Sample Texts</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {LANGUAGE_CONFIG[language].samples.map((sample, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setText(sample.text)}
                                        className="text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition-all"
                                    >
                                        <div className="font-medium text-sm mb-1">{sample.title}</div>
                                        <div className="text-xs text-foreground/40 line-clamp-2">{sample.text.substring(0, 80)}...</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Start reading */}
                        <motion.button
                            onClick={handleStartReading}
                            disabled={!text.trim() || !!textError}
                            className="w-full py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-30"
                            style={{ background: text.trim() && !textError ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#333' }}
                            whileHover={text.trim() && !textError ? { scale: 1.02 } : {}}
                            whileTap={text.trim() && !textError ? { scale: 0.98 } : {}}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <BookOpen size={20} />
                                Start Reading
                            </div>
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        {/* Controls bar */}
                        <div className="flex flex-wrap items-center gap-2 rounded-xl p-4 bg-white/5 border border-white/10">
                            <button
                                onClick={handleStopReading}
                                className="flex items-center gap-2 text-sm text-foreground/60 hover:text-white transition-colors mr-2"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>

                            {/* Language selector in reading mode */}
                            <div className="flex items-center gap-1 mr-2">
                                {(Object.keys(LANGUAGE_CONFIG) as ('en' | 'hi' | 'kn')[]).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => { setLanguage(lang); if (lang !== 'en') setSyllableMode(false); window.speechSynthesis.cancel(); if (googleTTSAudioRef.current) { googleTTSAudioRef.current.pause(); googleTTSAudioRef.current = null; } setIsSpeaking(false); setHighlightedWordIndex(-1); }}
                                        className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                                        style={{
                                            background: language === lang ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.05)',
                                            border: `1px solid ${language === lang ? 'rgba(99,102,241,0.6)' : 'rgba(0,0,0,0.2)'}`,
                                            color: language === lang ? '#4f46e5' : '#111827',
                                            minHeight: '32px',
                                        }}
                                    >
                                        {LANGUAGE_CONFIG[lang].label}
                                    </button>
                                ))}
                            </div>

                            {/* Read Aloud button */}
                            <button
                                onClick={handleSpeak}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                                style={{
                                    background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                    border: `1px solid ${isSpeaking ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                                }}
                            >
                                {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                <span className="text-sm">{isSpeaking ? 'Stop' : 'Read Aloud'}</span>
                            </button>

                            {/* Speed buttons */}
                            <div className="flex items-center gap-1">
                                {speedOptions.map((speed) => (
                                    <button
                                        key={speed}
                                        onClick={() => {
                                            setSpeechRate(speed);
                                            if (isSpeaking) {
                                                window.speechSynthesis.cancel();
                                                if (googleTTSAudioRef.current) {
                                                    googleTTSAudioRef.current.pause();
                                                    googleTTSAudioRef.current = null;
                                                }
                                                setIsSpeaking(false);
                                                setHighlightedWordIndex(-1);
                                                // Restart with new speed
                                                setTimeout(() => {
                                                    handleSpeak();
                                                }, 100);
                                            }
                                        }}
                                        className="px-2 py-1 rounded text-xs font-medium transition-all"
                                        style={{
                                            background: speechRate === speed ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.05)',
                                            border: speechRate === speed ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid rgba(0,0,0,0.2)',
                                            color: speechRate === speed ? '#4f46e5' : '#111827',
                                            minWidth: '36px', minHeight: '32px',
                                        }}
                                    >
                                        {speed}x
                                    </button>
                                ))}
                            </div>

                            {/* Syllable toggle — English only (Latin-script heuristic) */}
                            {language === 'en' && (
                            <button
                                onClick={() => setSyllableMode(!syllableMode)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
                                style={{
                                    background: syllableMode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${syllableMode ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                                    color: syllableMode ? '#c084fc' : 'rgba(255,255,255,0.5)',
                                    minHeight: '32px',
                                }}
                            >
                                <SplitSquareHorizontal size={16} />
                                <span className="text-xs">{syllableMode ? 'Syllables ON' : 'Break Down'}</span>
                            </button>
                            )}

                            {/* Heatmap toggle */}
                            {gazeEnabled && (
                                <button
                                    onClick={() => { setHeatmapSnapshot(getCurrentSessionSnapshot()); setShowHeatmap(!showHeatmap); }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
                                    style={{
                                        background: showHeatmap ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${showHeatmap ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                        color: showHeatmap ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                                        minHeight: '32px',
                                    }}
                                >
                                    <BarChart3 size={16} />
                                    <span className="text-xs">Heatmap</span>
                                </button>
                            )}

                            {/* Analytics toggle */}
                            {gazeEnabled && (
                                <button
                                    onClick={() => { setHeatmapSnapshot(getCurrentSessionSnapshot()); setShowAnalytics(!showAnalytics); }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
                                    style={{
                                        background: showAnalytics ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${showAnalytics ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                        color: showAnalytics ? '#67e8f9' : 'rgba(255,255,255,0.5)',
                                        minHeight: '32px',
                                    }}
                                >
                                    <Zap size={16} />
                                    <span className="text-xs">Analytics</span>
                                </button>
                            )}
                        </div>

                        {/* Calibration Wizard */}
                        {showCalibration && (
                            <CalibrationWizard
                                onComplete={() => setShowCalibration(false)}
                                onSkip={() => setShowCalibration(false)}
                            />
                        )}

                        {/* Camera PiP for gaze */}
                        <GazePiP enabled={gazeEnabled} />

                        {/* Reading area */}
                        <div className="relative">
                            <GazeHighlighter
                                containerRef={textDisplayRef}
                                currentLine={currentLine}
                                enabled={gazeReading}
                            />
                            <WordHighlighter
                                containerRef={textDisplayRef}
                                enabled={gazeReading}
                                struggleWords={new Set()}
                                rereadWords={new Map()}
                            />
                            <div
                                ref={textDisplayRef}
                                className="reading-content p-8 rounded-2xl bg-white/5 border border-white/10"
                                style={{
                                    fontFamily: dyslexicFont ? "'OpenDyslexic', sans-serif" : 'inherit',
                                    fontSize: `${fontSize}px`,
                                    letterSpacing: `${letterSpacing}px`,
                                    wordSpacing: `${wordSpacing}px`,
                                    lineHeight: lineHeight,
                                    maxWidth: '100%',
                                    position: 'relative',
                                }}
                            >
                                {gazeEnabled
                                    ? splitIntoReadingLines(text).map((lineProps) => {
                                        const lineIdx = lineProps['data-line-index'];
                                        const lineWords = lineProps.children.split(/\s+/).filter(Boolean);
                                        const startWordIdx = lineIdx * 12;
                                        return (
                                            <div
                                                key={lineProps.key}
                                                data-line-index={lineIdx}
                                                className="py-1"
                                                style={getLineStyle(lineIdx, fontSize)}
                                            >
                                                {lineWords.map((w, wi) => renderWord(w, startWordIdx + wi))}
                                            </div>
                                        );
                                    })
                                    : words.map((word, i) => renderWord(word, i))
                                }
                            </div>
                        </div>

                        {/* Gaze Heatmap */}
                        {showHeatmap && heatmapSnapshot && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="rounded-2xl p-6 bg-white/5 border border-white/10"
                            >
                                <h3 className="text-sm font-semibold text-foreground/70 mb-3 flex items-center gap-2">
                                    <BarChart3 size={16} className="text-indigo-400" />
                                    Reading Heatmap
                                </h3>
                                <GazeHeatmap
                                    heatmapData={heatmapSnapshot.heatmap || []}
                                    rereadLines={rereadLines}
                                    totalLines={heatmapSnapshot.totalLines || 0}
                                />
                            </motion.div>
                        )}

                        {/* Reading Analytics */}
                        <ReadingAnalytics
                            visible={showAnalytics && gazeEnabled}
                            snapshot={heatmapSnapshot}
                        />

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-sm text-foreground/40">
                            <span>{words.length} words</span>
                            <span>~{Math.ceil(words.length / 200)} min read</span>
                            <span>{text.split(/[.!?]+/).length - 1} sentences</span>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
