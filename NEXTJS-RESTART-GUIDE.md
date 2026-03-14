# 🔄 Restart Scripts - Next.js Version

## 🚀 Quick Commands

### ⭐ RECOMMENDED: Clear Cache and Restart (Use this for Firebase errors!)
```bash
clear-cache-nextjs.bat
```

### Simple Restart (No cache clearing)
```bash
restart-nextjs.bat
```

### Stop All Services
```bash
stop-all.bat
```

---

## 🔥 Fixing Firebase Authentication Error

If you see `ERR_QUIC_PROTOCOL_ERROR` or can't sign in:

### Step 1: Run Clear Cache Script
Double-click **`clear-cache-nextjs.bat`**

### Step 2: Clear Browser Storage (CRITICAL!)
After both servers start (~15 seconds):
1. Open `http://localhost:3000` in your browser
2. Press **F12** to open DevTools
3. Click **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Find **"Clear storage"** in the left sidebar
5. Click **"Clear site data"** button
6. Close DevTools
7. Hard refresh: **Ctrl + Shift + R**

### Step 3: Try Signing In
The Firebase error should now be fixed!

---

## 📊 Dashboard Changes Implemented

✅ **New Dashboard Layout** - Matches your reference design
- Left sidebar with collapsible navigation
- Current Streak card
- Today's Challenge with progress bar
- Your Progress (4 stats: Concepts, Points, Day Streak, Best)
- Screen Time section (Instagram, YouTube, Twitter)
- Quick Actions buttons

✅ **Text Visibility Fixed** - All text has blur card backgrounds for clarity

✅ **AI Learning Tools Moved** - Removed from dashboard, now in main menu bar

✅ **Menu Activation** - Menu items appear after first dashboard visit (persistent)

✅ **Fully Responsive** - Works on desktop, tablet, and mobile

---

## 🌐 Service URLs

After starting:
- **Next.js Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## 📝 What Each Script Does

### `restart-nextjs.bat`
- Kills existing Node.js and Python processes
- Starts Python backend (port 8000)
- Starts Next.js frontend (port 3000)
- Both run in separate command windows

### `clear-cache-nextjs.bat`
- Stops all services
- Deletes `.next` build folder
- Deletes `node_modules/.cache`
- Deletes all `__pycache__` folders
- Restarts both services
- Shows browser cache clearing instructions

### `stop-all.bat`
- Safely stops Node.js processes
- Safely stops Python processes

---

## ⚠️ Important Notes

1. **Always use `clear-cache-nextjs.bat` if you have Firebase errors**
2. Next.js runs on **port 3000** (not 5173 like Vite)
3. Backend and frontend open in **separate windows** - keep them open
4. To stop: close the command windows OR run `stop-all.bat`
5. Next.js has Fast Refresh - code changes reload automatically

---

## 🐛 Troubleshooting

### "Port 3000 already in use"
Run `stop-all.bat` then try again.

### Next.js won't start
1. Check Node.js: `node --version` (need v18+)
2. Install dependencies:
   ```bash
   cd frontend-next
   npm install
   ```

### Backend won't start
1. Check Python: `python --version` (need 3.9+)
2. Install dependencies:
   ```bash
   cd backend-python
   pip install -r requirements.txt
   ```

### Firebase errors persist
1. Clear browser cache (see Step 2 above)
2. Try incognito/private mode
3. Check `.env.local` in `frontend-next` has correct Firebase credentials

### Dashboard changes not showing
1. Make sure you ran `clear-cache-nextjs.bat` (not the old Vite script)
2. Hard refresh with `Ctrl + Shift + R`
3. Check you're on http://localhost:3000 (not 5173)

---

## 💡 Development Tips

- **Hot Reload**: Code changes reload automatically in Next.js
- **After Git Pull**: Always run `clear-cache-nextjs.bat`
- **Login Issues**: Always run `clear-cache-nextjs.bat` + clear browser storage
- **Keep Windows Open**: Services run in command windows - closing stops them
- **Check Logs**: Command windows show live logs for debugging

---

Made with ❤️ for easier Next.js development
