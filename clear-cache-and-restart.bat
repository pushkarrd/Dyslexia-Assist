@echo off
echo ========================================
echo   Clear Cache and Restart
echo ========================================
echo.

REM Stop all processes first
call stop-all.bat

echo.
echo [1/3] Clearing frontend cache...
cd frontend
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist dist rmdir /s /q dist
if exist .vite rmdir /s /q .vite
echo ✓ Frontend cache cleared
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

REM Now restart everything
call restart-all.bat
