"""
Text-to-Speech Service using pyttsx3 (eSpeak-ng backend)
Generates audio with word timing for synchronized highlighting
"""

import pyttsx3
import io
import re
from typing import List, Dict, Tuple
import time

class WordTiming:
    """Track word start/end times in audio"""
    def __init__(self, word: str, start_time: float, end_time: float):
        self.word = word
        self.start_time = start_time
        self.end_time = end_time

class TTSService:
    def __init__(self):
        self.engine = pyttsx3.init()
        self._configure_engine()

    def _configure_engine(self):
        """Configure pyttsx3 engine"""
        # Get available voices
        voices = self.engine.getProperty('voices')
        self.voices_by_lang = {}

        for voice in voices:
            lang = voice.languages[0] if voice.languages else 'en'
            if lang not in self.voices_by_lang:
                self.voices_by_lang[lang] = voice

        print(f"✅ TTS Engine initialized with {len(voices)} voices")
        print(f"   Available languages: {list(self.voices_by_lang.keys())}")

    def get_voice_for_lang(self, lang_code: str) -> str:
        """Get voice ID for language (e.g., 'hi-IN', 'kn-IN', 'en-IN')"""
        lang_part = lang_code.split('-')[0]  # 'hi', 'kn', 'en'

        # Try exact match first
        if lang_code in self.voices_by_lang:
            return self.voices_by_lang[lang_code].id

        # Try language-only match
        for code, voice in self.voices_by_lang.items():
            if code.startswith(lang_part):
                return voice.id

        # Fallback to first available
        if self.voices_by_lang:
            return list(self.voices_by_lang.values())[0].id

        return None

    def synthesize_word(self, word: str, lang_code: str, rate: float = 1.0) -> Tuple[bytes, float]:
        """
        Synthesize a single word to audio.
        Returns (audio_bytes, duration_in_seconds)
        """
        try:
            engine = pyttsx3.init()
            voice_id = self.get_voice_for_lang(lang_code)

            if voice_id:
                engine.setProperty('voice', voice_id)

            # Set speech rate (pyttsx3 default is ~200 WPM, rate adjusts this)
            # 0.5 = 100 WPM (slow), 1.0 = 200 WPM (normal), 2.0 = 400 WPM (fast)
            engine.setProperty('rate', 150 * rate)  # Adjusted rate for eSpeak

            # Capture audio to bytes
            output = io.BytesIO()
            engine.save_to_file(word, output)
            engine.runAndWait()

            audio_data = output.getvalue()

            # Estimate duration based on word length and rate
            # eSpeak speaks roughly 100-150 words per minute
            # Average word is ~5 characters, ~200ms per word
            estimated_duration = (len(word) / 5) * (1 / rate) * 0.2

            engine.stop()
            return audio_data, estimated_duration

        except Exception as e:
            print(f"❌ Error synthesizing word '{word}': {e}")
            return b'', 0.0

    def synthesize_text_with_timing(
        self,
        text: str,
        lang_code: str = 'en-IN',
        rate: float = 1.0,
        chunk_size: int = 180
    ) -> Dict:
        """
        Synthesize text to audio with word timing for highlighting.

        Returns:
        {
            "audio": base64_encoded_audio,
            "wordTimings": [
                {"word": "word1", "startTime": 0.0, "endTime": 0.2},
                {"word": "word2", "startTime": 0.2, "endTime": 0.4},
                ...
            ],
            "totalDuration": 5.6,
            "lang": "kn-IN"
        }
        """
        import base64

        try:
            # Split into words
            words = text.split()
            if not words:
                return {"audio": "", "wordTimings": [], "totalDuration": 0.0}

            # Process in chunks (180 char limit for eSpeak reliability)
            chunks = []
            current_chunk = []
            current_length = 0

            for word in words:
                word_len = len(word) + 1  # +1 for space
                if current_length + word_len > chunk_size and current_chunk:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = [word]
                    current_length = word_len
                else:
                    current_chunk.append(word)
                    current_length += word_len

            if current_chunk:
                chunks.append(" ".join(current_chunk))

            print(f"🎤 Synthesizing {len(words)} words in {len(chunks)} chunks, lang={lang_code}, rate={rate}x")

            # Synthesize each chunk and build timing map
            all_audio_chunks = []
            word_timings = []
            current_time = 0.0
            chunk_idx = 0

            for chunk in chunks:
                try:
                    engine = pyttsx3.init()
                    voice_id = self.get_voice_for_lang(lang_code)

                    if voice_id:
                        engine.setProperty('voice', voice_id)

                    engine.setProperty('rate', 150 * rate)

                    # Save to file-like object
                    output = io.BytesIO()
                    engine.save_to_file(chunk, output)
                    engine.runAndWait()

                    chunk_audio = output.getvalue()
                    if chunk_audio:
                        all_audio_chunks.append(chunk_audio)

                    # Track word timings within chunk
                    chunk_words = chunk.split()
                    avg_word_duration = (len(chunk) / len(chunk_words) / 5) * (1 / rate) * 0.22

                    for word in chunk_words:
                        start = current_time
                        end = current_time + avg_word_duration
                        word_timings.append({
                            "word": word,
                            "startTime": round(start, 3),
                            "endTime": round(end, 3)
                        })
                        current_time = end

                    engine.stop()
                    chunk_idx += 1
                    print(f"   ✅ Chunk {chunk_idx}/{len(chunks)}: {len(chunk_words)} words")

                except Exception as chunk_err:
                    print(f"   ⚠️  Chunk {chunk_idx} failed: {chunk_err}")
                    engine.stop()
                    continue

            # Combine all audio chunks
            combined_audio = b''.join(all_audio_chunks) if all_audio_chunks else b''
            total_duration = word_timings[-1]["endTime"] if word_timings else 0.0

            # Encode to base64
            audio_b64 = base64.b64encode(combined_audio).decode('utf-8') if combined_audio else ""

            print(f"✅ Synthesis complete: {len(words)} words, {total_duration:.1f}s, {len(combined_audio)} bytes audio")

            return {
                "audio": audio_b64,
                "mimeType": "audio/wav",
                "wordTimings": word_timings,
                "totalDuration": round(total_duration, 1),
                "lang": lang_code,
                "wordCount": len(words)
            }

        except Exception as e:
            print(f"❌ Synthesis error: {e}")
            raise

    def cleanup(self):
        """Shutdown engine"""
        try:
            self.engine.stop()
        except:
            pass


# Global instance
_tts_service = None

def get_tts_service() -> TTSService:
    """Get or create TTS service instance"""
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service
