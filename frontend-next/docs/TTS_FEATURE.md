# Text-to-Speech (TTS) Feature for Dyslexic Users

## Overview
The TTS feature provides slow, clear audio playback of lecture content to help dyslexic users better understand and retain information.

## Implementation Details

### Technology
- **API**: Web Speech Synthesis API (browser built-in)
- **Speech Rate**: 0.75x (75% of normal speed)
- **Pitch**: 1.0 (normal)
- **Volume**: 1.0 (full volume)
- **Language**: en-US

### Features
1. **Read Aloud (Slow)** button - Starts reading text at 0.75x speed
2. **Pause Reading** button - Pauses the current speech
3. **Resume Reading** button - Continues from where it paused
4. **Stop** button - Completely stops and clears speech queue

### Availability
TTS buttons appear in 4 tabs (excluding Live Transcription):
- ✅ Breakdown Text
- ✅ Detailed Steps
- ✅ Mind Map
- ✅ Summary
- ❌ Live Transcription (excluded as requested)

### Button States
1. **Not Speaking**: Shows Volume2 icon + "Read Aloud (Slow)"
2. **Speaking**: Shows Pause icon + "Pause Reading"
3. **Paused**: Shows Play icon + "Resume Reading"
4. **Stop Button**: Appears only when speaking (red button with VolumeX icon)

### User Experience
- Only appears when content is available
- Disabled if browser doesn't support speech synthesis
- Smooth animations with Framer Motion
- Matches app's theme (light/dark mode)
- Clear visual feedback for current state

## Why Slow Speech?
Research shows that dyslexic users benefit from slower speech rates because:
- Improves comprehension and retention
- Reduces cognitive load
- Allows time for processing complex information
- Helps with word recognition and phonological awareness

## Browser Compatibility
- ✅ Chrome/Edge (full support)
- ✅ Safari (full support)
- ✅ Firefox (full support)
- ⚠️ Requires modern browser with Web Speech API

## Why Web Speech API vs AssemblyAI?
**Advantages of Web Speech API:**
1. **Free** - No API quota limits
2. **Offline** - Works without internet
3. **Better Control** - Precise speech rate control (essential for dyslexia)
4. **Simpler** - No backend setup needed
5. **Instant** - No network latency

**AssemblyAI TTS would require:**
- API key and quota management
- Backend endpoint for TTS
- Network requests (latency)
- Less control over speech rate
- Additional costs for heavy usage

## Files Modified
- `frontend/src/hooks/useTextToSpeech.js` - Custom React hook for TTS
- `frontend/src/pages/LecturePage.jsx` - Integrated TTS buttons into 4 tabs

## Usage Example
```javascript
import useTextToSpeech from '../hooks/useTextToSpeech';

function MyComponent() {
  const { speak, pause, resume, stop, isSpeaking, isPaused } = useTextToSpeech();
  
  return (
    <button onClick={() => speak("Hello world", { rate: 0.75 })}>
      Speak
    </button>
  );
}
```

## Future Enhancements
- Allow users to adjust speech rate (0.5x - 1.5x)
- Voice selection (male/female, different accents)
- Highlight text as it's being read
- Save preferred speech settings to user profile
- Keyboard shortcuts (Space = pause/resume, Esc = stop)
