@echo off
echo ========================================
echo   Clear Cache and Restart (Next.js)
echo ========================================
echo.

REM Stop all processes first
echo Stopping all services...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
taskkill /F /IM pythonw.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [1/3] Clearing Next.js cache...
cd frontend-next
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache
if exist .turbo rmdir /s /q .turbo
echo ✓ Next.js cache cleared
cd ..

echo.
echo [2/3] Clearing backend cache...
cd backend-python
if exist __pycache__ rmdir /s /q __pycache__
if exist app\__pycache__ rmdir /s /q app\__pycache__
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
echo ✓ Backend cache cleared
cd ..

echo.
echo [3/3] Clearing browser storage...
echo.
echo ⚠️  IMPORTANT: After the servers start, please:
echo    1. Open Chrome DevTools (F12)
echo    2. Go to Application tab
echo    3. Click "Clear storage" on the left
echo    4. Click "Clear site data" button
echo    5. Refresh the page (Ctrl+Shift+R)
echo.
echo This will fix Firebase authentication errors.
echo.

timeout /t 5 /nobreak

REM Start backend
echo.
echo Starting Backend...
cd backend-python
start "Backend Server" cmd /k "python main.py"
cd ..
timeout /t 5 /nobreak

REM Start Next.js frontend
echo Starting Next.js Frontend...
cd frontend-next
start "Next.js Dev Server" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo   Services Started!
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to close...
pause >nul
