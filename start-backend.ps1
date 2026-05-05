# ============================================================
#  start-backend.ps1 — Lance le backend FastAPI sur port 8002
# ============================================================
$Root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = "$Root\.venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Host "[ERREUR] Python introuvable : $Python" -ForegroundColor Red
    Write-Host "Appuie sur une touche pour fermer."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "  Backend AI-EDU" -ForegroundColor Cyan
Write-Host "  Python : $Python" -ForegroundColor DarkGray
Write-Host "  API    : http://127.0.0.1:8002" -ForegroundColor Green
Write-Host "  Socket : http://127.0.0.1:8003" -ForegroundColor Green
Write-Host ""

Write-Host "  [1/4] Nettoyage des instances backend..." -ForegroundColor Yellow
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -match "uvicorn app.main:app" } |
    ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
    }

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -match "uvicorn app.socketio_console:app" } |
    ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
    }

Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
        try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
    }

Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
        try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
    }

Start-Sleep -Milliseconds 800

$busy = Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue
$busySocket = Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue
if ($busy -or $busySocket) {
    Write-Host "[ERREUR] Le port 8002 ou 8003 est encore occupe." -ForegroundColor Red
    exit 1
}

Write-Host "  [2/4] Ports 8002/8003 libres" -ForegroundColor Green
Write-Host "  [3/4] Demarrage Socket.IO sur 8003..." -ForegroundColor Green

Set-Location "$Root\backend"

Start-Process -FilePath $Python -ArgumentList @(
    "-m", "uvicorn",
    "app.socketio_console:app",
    "--host", "127.0.0.1",
    "--port", "8003",
    "--reload"
) -WindowStyle Normal

Write-Host "  [4/4] Demarrage API backend sur 8002..." -ForegroundColor Green

& $Python -m uvicorn app.main:app `
    --host 127.0.0.1 `
    --port 8002 `
    --ws wsproto `
    --reload
