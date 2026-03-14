@echo off
echo ========================================
echo   Stopping Dyslexia-Assist Project
echo ========================================
echo.

REM Kill frontend processes
echo [1/2] Stopping frontend (Node.js)...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Frontend stopped
) else (
    echo ℹ No frontend process found
)

REM Kill backend processes
echo [2/2] Stopping backend (Python)...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM pythonw.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Backend stopped
) else (
    echo ℹ No backend process found
)

echo.
echo ========================================
echo   All Services Stopped!
echo ========================================
echo.
echo Press any key to close...
pause >nul
