@echo off
setlocal EnableExtensions EnableDelayedExpansion
:: ============================================================
::  start-all.bat — Lance backend + frontend en meme temps
::  Double-clique ici pour tout demarrer en une fois
:: ============================================================
SET ROOT=%~dp0
SET PYTHON=%ROOT%.venv\Scripts\python.exe

IF NOT EXIST "%PYTHON%" (
    echo [ERREUR] Python introuvable : %PYTHON%
    pause
    exit /b 1
)

where npm >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERREUR] npm est introuvable. Installe Node.js puis relance.
    pause
    exit /b 1
)

echo.
echo   === AI-EDU Platform ===
echo.

:: Tuer les processus uvicorn du projet + tout process en ecoute sur 8002/8003
echo   [1/4] Nettoyage des instances backend...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match 'uvicorn app.main:app' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match 'uvicorn app.socketio_console:app' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8002 .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8003 .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo   [2/4] Verification ports 8002/8003...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8002 .*LISTENING"') do (
    "%PYTHON%" -c "import urllib.request,sys; r=urllib.request.urlopen('http://127.0.0.1:8002/health', timeout=2); sys.exit(0 if getattr(r, 'status', 0)==200 else 1)" >nul 2>&1
    if errorlevel 1 "%PYTHON%" -c "import urllib.request,sys; r=urllib.request.urlopen('http://127.0.0.1:8002/docs', timeout=2); sys.exit(0 if getattr(r, 'status', 0)==200 else 1)" >nul 2>&1
    if not errorlevel 1 (
        echo   Backend deja actif sur 8002 ^(PID %%P^). Reutilisation.
        goto BACKEND_READY
    )
    echo [ERREUR] Le port 8002 est occupe ^(PID %%P^) et le backend ne repond ni sur /health ni sur /docs.
    echo Ferme ce process puis relance le script.
    pause
    exit /b 1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8003 .*LISTENING"') do (
    echo [ERREUR] Le port 8003 est occupe ^(PID %%P^) et bloque Socket.IO.
    pause
    exit /b 1
)

echo   [3/4] Lancement du backend sur http://127.0.0.1:8002 + Socket.IO sur 8003
start "Backend 8002" cmd /k "cd /d "%ROOT%backend" && "%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --ws wsproto --reload"
start "Backend Socket.IO 8003" cmd /k "cd /d "%ROOT%backend" && "%PYTHON%" -m uvicorn app.socketio_console:app --host 127.0.0.1 --port 8003 --reload"

:: Attendre que le backend soit pret avant de lancer le frontend
echo   Attente du backend...
set WAIT_TRIES=0
:WAIT_BACKEND
timeout /t 2 /nobreak >nul
set /a WAIT_TRIES+=1
echo     verification backend... (!WAIT_TRIES!/30)
"%PYTHON%" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8002/health', timeout=2)" >nul 2>&1
IF ERRORLEVEL 1 "%PYTHON%" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8002/docs', timeout=2)" >nul 2>&1
IF NOT ERRORLEVEL 1 GOTO BACKEND_READY
if !WAIT_TRIES! GEQ 30 (
    echo.
    echo   [ERREUR] Backend non joignable apres 60 secondes.
    echo   Ouvre la fenetre "Backend 8002" pour voir l erreur.
    pause
    exit /b 1
)
GOTO WAIT_BACKEND

:BACKEND_READY
echo   Backend pret.

echo   [4/4] Lancement du frontend sur http://localhost:3000
start "Frontend 3000" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo   Les services sont en cours d execution.
echo   Backend API    : http://127.0.0.1:8002
echo   Backend Socket : http://127.0.0.1:8003
echo   Frontend : http://localhost:3000
echo.
echo   Ferme cette fenetre quand tu veux. Les serveurs continuent dans leurs fenetres.
pause
