# 🚀 Quick Start Guide

## Start SimplifiED in 3 Steps

### Method 1: Automatic (Recommended)
```powershell
.\start.ps1
```

### Method 2: Manual

**Step 1: Start Backend**
```powershell
cd backend-python
python -m uvicorn main:app --port 8000
```

**Step 2: Start Frontend** (new terminal)
```powershell
cd frontend
npm run dev
```

**Step 3: Open Browser**
```
http://localhost:5173
```

---

## First Time Use

1. **Sign Up** with email/password
2. **Click Microphone** icon to start recording
3. **Speak** your lecture notes
4. **Click Stop** when done
5. **Wait** ~30 seconds for AI processing
6. **View Results** in all 4 tabs:
   - Simple Text (dyslexia-friendly)
   - Detailed Steps
   - Mind Map
   - Summary

---

## Need Help?

### Backend won't start?
```powershell
# Check if Ollama is running
ollama serve

# Test backend
curl http://localhost:8000/health
```

### Frontend won't start?
```powershell
# Install dependencies
cd frontend
npm install

# Try again
npm run dev
```

### Microphone not working?
- Allow browser microphone permission
- Use Chrome, Edge, or Safari
- Check if another app is using mic

---

## Stop All Services

**Close all terminal windows** or press `Ctrl+C` in each terminal.

---

## What Makes This Special?

✅ **No API Keys** - Everything runs locally  
✅ **100% Private** - Your data never leaves your computer  
✅ **Always Free** - No subscriptions or credits  
✅ **Works Offline** - Internet only for Firebase sync  
✅ **Dyslexia-Friendly** - Optimized for accessibility  

---

Built with ❤️ using Ollama + llama3.2:3b
