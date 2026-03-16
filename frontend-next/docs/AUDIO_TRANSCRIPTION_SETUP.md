# Audio Transcription Setup Guide

## Free Speech-to-Text API Setup

The audio upload feature uses **AssemblyAI** for automatic transcription (5 hours/month free).

### Option 1: Use AssemblyAI (Recommended - Most Accurate)

1. **Sign up for free account:**
   - Visit: https://www.assemblyai.com/dashboard/signup
   - No credit card required
   - Get 5 hours/month free transcription

2. **Get your API key:**
   - After signup, go to: https://www.assemblyai.com/dashboard
   - Copy your API key

3. **Add to backend .env file:**
   ```bash
   cd backend-python
   # Copy .env.example to .env if not exists
   cp .env.example .env
   
   # Add your API key
   ASSEMBLYAI_API_KEY=your_actual_api_key_here
   ```

4. **Install dependencies:**
   ```bash
   pip install requests python-multipart
   # Or install all:
   pip install -r requirements.txt
   ```

5. **Restart backend:**
   ```bash
   python -m uvicorn main:app --port 8000
   ```

### Option 2: Manual Input (No API Key Needed)

If you don't want to set up an API key, users can:
1. Click "Upload Audio"
2. Select audio file
3. Click "Enter Manually" instead of "Auto Transcribe"
4. Paste or type the transcription manually

This is useful for:
- Testing without API setup
- When API quota is exhausted
- Poor quality audio files

## Alternative Free APIs

If you prefer other services:

### Deepgram ($200 free credits)
1. Sign up: https://console.deepgram.com/signup
2. Get API key from dashboard
3. Update backend code to use Deepgram API

### Google Cloud Speech-to-Text (60 min/month free)
1. Create Google Cloud account
2. Enable Speech-to-Text API
3. Create API key
4. Update backend code

### Azure Speech (5 hours/month free)
1. Create Azure account
2. Create Speech resource
3. Get API key
4. Update backend code

## Usage

Once configured:
1. Click "Upload Audio" on Dashboard
2. Select audio file (MP3, WAV, M4A, OGG)
3. Click "Auto Transcribe"
4. Wait for transcription (2-5 minutes for long files)
5. Automatically redirects to Lecture page
6. AI processing starts immediately

## Features

✅ Automatic speech-to-text transcription
✅ Support for multiple audio formats
✅ Progress indicators
✅ Fallback to manual input
✅ Same workflow as live recording
✅ Immediate AI processing

## Troubleshooting

**Error: "API key not configured"**
- Add ASSEMBLYAI_API_KEY to backend-python/.env file
- Restart backend server

**Error: "Transcription failed"**
- Check audio quality (clear speech, low background noise)
- Try manual input option
- Verify API key is valid

**Error: "Timeout"**
- Audio file may be too long
- Split into smaller segments
- Use manual input

## Free Tier Limits

- **AssemblyAI:** 5 hours/month
- **Deepgram:** $200 credits (~33 hours)
- **Google:** 60 minutes/month
- **Azure:** 5 hours/month

Choose based on your needs!
