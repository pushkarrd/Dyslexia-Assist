@echo off
echo ========================================
echo   Restarting Dyslexia-Assist Project
echo ========================================
echo.

REM Kill any existing frontend processes
echo [1/4] Stopping frontend processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Kill any existing backend processes
echo [2/4] Stopping backend processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM pythonw.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Starting Backend (Python FastAPI)
echo ========================================
echo.

REM Start backend in new window
cd backend-python
start "Backend Server" cmd /k "python main.py"
cd ..

echo Backend starting in new window...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   Starting Frontend (React + Vite)
echo ========================================
echo.

REM Start frontend in new window
cd frontend
start "Frontend Dev Server" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Backend and Frontend are running in separate windows.
echo Close those windows to stop the services.
echo.
echo Press any key to close this window...
pause >nul
