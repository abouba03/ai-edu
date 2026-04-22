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
Write-Host "  Port   : 8002" -ForegroundColor DarkGray
Write-Host "  URL    : http://127.0.0.1:8002" -ForegroundColor Green
Write-Host ""

Write-Host "  [1/3] Nettoyage des instances backend..." -ForegroundColor Yellow
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -match "uvicorn app.main:app" } |
    ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
    }

Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
        try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
    }

Start-Sleep -Milliseconds 800

$busy = Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "[ERREUR] Le port 8002 est encore occupe." -ForegroundColor Red
    exit 1
}

Write-Host "  [2/3] Port 8002 libre" -ForegroundColor Green
Write-Host "  [3/3] Demarrage backend..." -ForegroundColor Green

Set-Location "$Root\backend"

& $Python -m uvicorn app.main:app `
    --host 127.0.0.1 `
    --port 8002 `
    --ws wsproto `
    --reload
