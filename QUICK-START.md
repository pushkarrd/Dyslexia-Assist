# 🚀 Quick Start Guide - Next.js + Python Backend

## ⭐ RECOMMENDED: How to Start Everything

### Step 1: Run the Clear Cache & Restart Script
Double-click this file in your project root:
```
clear-cache-nextjs.bat
```

This will:
✅ Stop all running processes
✅ Clear Next.js `.next` build cache
✅ Clear Python `__pycache__` directories
✅ Start Python backend (port 8000)
✅ Start Next.js frontend (port 3000)

**Two new command windows will open - KEEP THEM OPEN!**

---

## 🔧 Alternative Scripts

### If you just want to restart (without clearing cache):
```
restart-nextjs.bat
```

### If you just want to stop everything:
```
stop-all.bat
```

---

## 🌐 Access the Application

After both servers start (~10 seconds):

| Service | URL | Port |
|---------|-----|------|
| **Frontend (Next.js)** | http://localhost:3000 | 3000 |
| **Backend API** | http://localhost:8000 | 8000 |
| **API Docs** | http://localhost:8000/docs | 8000 |

---

## 🐛 If Firebase Authentication Fails

### The Error
You might see: `ERR_QUIC_PROTOCOL_ERROR` or sign-in fails

### The Fix

**Option 1: Use the clear cache script (RECOMMENDED)**
```bash
clear-cache-nextjs.bat
```
Then follow Step 2 below.

**Option 2: Manual Steps**

1. After servers start, open Chrome DevTools: **F12**
2. Click **Application** tab (top)
3. In left sidebar, click **"Clear storage"**
4. Click **"Clear site data"** button (bottom right)
5. Close DevTools
6. Hard refresh: **Ctrl + Shift + R**
7. Try signing in again

---

## 📊 What Changed in Dashboard

✅ **New Sidebar Navigation** with 10 menu items:
- Home, Progress, Screen Time, Community, Motivation, Roadmap, Quiz Center, Courses, Leaderboard, Learning

✅ **Progress Cards**:
- Current Streak (days)
- Today's Challenge (with progress bar)
- Your Progress (4 stats: Concepts, Points, Day Streak, Best)

✅ **Screen Time Section** (Instagram, YouTube, Twitter)

✅ **Quick Actions** (3 buttons at bottom)

✅ **Text Visibility**: All text has blur backgrounds for clarity

✅ **Responsive Design**: Works on desktop, tablet, and mobile

---

## 🎯 Menu Activation

✨ **AI Learning Tools** (Reading, Handwriting, Generator, Analytics, Screening) appear in the menu ONLY after:
1. User logs in
2. User visits the Dashboard page
3. Menu items persist even after logout/refresh

This is done with `localStorage` for persistence.

---

## 🔍 Troubleshooting

### "Port 3000 already in use"
```bash
stop-all.bat
```
Then run `clear-cache-nextjs.bat` again.

### "Port 8000 already in use"
```bash
taskkill /F /IM python.exe
```
Then run the clear cache script again.

### Next.js won't start
Check you have Node.js v18+:
```bash
node --version
```

If not installed, install from https://nodejs.org

Then:
```bash
cd frontend-next
npm install
```

### Backend won't start
Check you have Python 3.9+:
```bash
python --version
```

If not installed, install from https://python.org

Then:
```bash
cd backend-python
pip install -r requirements.txt
```

### Services stop immediately after starting
Check for errors in the command window. Common causes:
- Missing dependencies
- Port already in use
- Wrong directory structure

---

## 💡 Development Tips

| Tip | What to Do |
|-----|-----------|
| **Code changes not showing?** | Hard refresh: `Ctrl + Shift + R` |
| **Still not showing?** | Run `clear-cache-nextjs.bat` |
| **Login issues?** | Clear browser storage + refresh |
| **After git pull?** | Always run `clear-cache-nextjs.bat` |
| **Want to keep services running?** | Don't close the command windows |

---

## 📁 Project Structure

```
Dyslexia-Assist/
├── frontend/                 # React + Vite (old)
├── frontend-next/            # Next.js (NEW - use this!)
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/    ← NEW DESIGN
│   │   │   ├── login/
│   │   │   └── ...
│   │   └── components/
│   │       └── layout/
│   │           └── Navbar.tsx ← AI Tools menu
│   └── package.json
├── backend-python/           # Python FastAPI
│   ├── main.py
│   ├── app/
│   └── requirements.txt
├── restart-nextjs.bat        ← Use this
├── clear-cache-nextjs.bat    ← Or use this
└── stop-all.bat
```

---

## 🎬 Common Workflows

### Start Development
```bash
# Double-click this in File Explorer:
clear-cache-nextjs.bat

# Or run in terminal:
cd frontend-next && npm run dev
```

### After Making Code Changes
1. Code changes auto-reload in Next.js ✨
2. If not showing: Hard refresh `Ctrl + Shift + R`

### After Git Pull
```bash
clear-cache-nextjs.bat
```

### Stop All Services
```bash
stop-all.bat
```

### Deploy to Production
```bash
cd frontend-next
npm run build
```

---

## ✅ Everything Working?

You should see:
- ✅ Backend window showing "Uvicorn running on http://0.0.0.0:8000"
- ✅ Frontend window showing "▲ Next.js 15.x"
- ✅ http://localhost:3000 loads successfully
- ✅ Can sign in without Firebase errors
- ✅ Dashboard shows new sidebar and progress cards

---

## 🆘 Need Help?

Check these files:
- `NEXTJS-RESTART-GUIDE.md` - Detailed Next.js guide
- `RESTART-GUIDE.md` - General restart guide
- Backend logs in the backend command window
- Browser DevTools console (F12)

---

Made with ❤️ for easier development!
