@echo off
setlocal EnableExtensions
:: ============================================================
::  start-backend.bat — Double-clique pour lancer le backend
:: ============================================================
SET ROOT=%~dp0
SET PYTHON=%ROOT%.venv\Scripts\python.exe

IF NOT EXIST "%PYTHON%" (
    echo [ERREUR] Python introuvable : %PYTHON%
    pause
    exit /b 1
)

echo.
echo   Backend AI-EDU
echo   Python : %PYTHON%
echo   API    : http://127.0.0.1:8002
echo   Socket : http://127.0.0.1:8003
echo.

echo   [1/4] Nettoyage des instances backend...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match 'uvicorn app.main:app' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match 'uvicorn app.socketio_console:app' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8002 .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8003 .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo   [2/4] Verification ports 8002/8003...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8002 .*LISTENING"') do (
    echo [ERREUR] Le port 8002 est encore occupe ^(PID %%P^).
    pause
    exit /b 1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8003 .*LISTENING"') do (
    echo [ERREUR] Le port 8003 est encore occupe ^(PID %%P^).
    pause
    exit /b 1
)

echo   [3/4] Demarrage serveur Socket.IO sur 8003...
start "Backend Socket.IO 8003" cmd /k "cd /d "%ROOT%backend" && "%PYTHON%" -m uvicorn app.socketio_console:app --host 127.0.0.1 --port 8003 --reload"

echo   [4/4] Demarrage API backend sur 8002...

cd /d "%ROOT%backend"
"%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --ws wsproto --reload

pause
