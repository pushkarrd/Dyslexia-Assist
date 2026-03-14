# 🔄 Restart Scripts for Dyslexia-Assist

## Quick Start

### Option 1: Clear Cache and Restart (RECOMMENDED for Firebase errors)
```bash
clear-cache-and-restart.bat
```
This will:
- Stop all running services
- Clear frontend and backend caches
- Show instructions to clear browser storage
- Restart both servers

### Option 2: Simple Restart
```bash
restart-all.bat
```
Only use this if you don't have cache/Firebase issues.

### Option 3: Stop All Services
```bash
stop-all.bat
```
Use this to cleanly stop all running processes.

---

## 🔥 Fixing Firebase Authentication Error (ERR_QUIC_PROTOCOL_ERROR)

If you see this error, follow these steps:

### Step 1: Run the Clear Cache Script
Double-click `clear-cache-and-restart.bat`

### Step 2: Clear Browser Storage
After both servers start:
1. Open your browser to `http://localhost:5173`
2. Press `F12` to open DevTools
3. Go to **Application** tab (in Chrome) or **Storage** tab (in Firefox)
4. Find **"Clear storage"** in the left sidebar
5. Click **"Clear site data"** button
6. Close DevTools
7. Do a hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

### Step 3: Try Signing In Again
The Firebase error should now be fixed!

---

## 📝 What Each Script Does

### `restart-all.bat`
- Kills any existing Node.js and Python processes
- Starts the backend (Python FastAPI) in a new window
- Starts the frontend (React + Vite) in a new window
- Both services run in separate command windows

### `stop-all.bat`
- Safely stops all Node.js processes (frontend)
- Safely stops all Python processes (backend)
- Confirms what was stopped

### `clear-cache-and-restart.bat`
- Runs `stop-all.bat` first
- Deletes `.vite` cache folder in frontend
- Deletes `dist` folder in frontend
- Deletes all `__pycache__` folders in backend
- Shows instructions for clearing browser cache
- Runs `restart-all.bat` to start fresh

---

## 🌐 Service URLs

After running the restart script:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Backend API Docs**: http://localhost:8000/docs

---

## ⚠️ Important Notes

1. **Always use `clear-cache-and-restart.bat` if you have Firebase errors**
2. The backend and frontend will open in **separate windows** - keep them open
3. To stop services, either:
   - Close the command windows manually
   - Run `stop-all.bat`
4. If ports are already in use, the scripts will kill the processes first

---

## 🐛 Troubleshooting

### "Port already in use" error
Run `stop-all.bat` then try again.

### Frontend won't load
1. Check if Node.js is installed: `node --version`
2. Check if dependencies are installed: Go to `frontend` folder and run `npm install`

### Backend won't start
1. Check if Python is installed: `python --version`
2. Check if dependencies are installed: Go to `backend-python` folder and run `pip install -r requirements.txt`

### Firebase errors persist
1. Make sure you've cleared browser cache (see Step 2 above)
2. Try using a different browser
3. Try incognito/private mode
4. Check if your `.env` file has correct Firebase credentials

---

## 💡 Tips

- Use `clear-cache-and-restart.bat` **after pulling new changes** from Git
- Use `clear-cache-and-restart.bat` **if login/signup isn't working**
- Keep the command windows open - closing them stops the services
- If you edit code, Vite will hot-reload automatically (no restart needed)

---

Made with ❤️ for easier development
