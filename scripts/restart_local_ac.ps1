# Restart local Activated Carbon demo (MES API 8001 + Modbus 8010 + UI 5173)
# Usage: cd nyra-mes-ui; .\scripts\restart_local_ac.ps1

$UiRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = Split-Path -Parent $UiRoot
$ApiRoot = Join-Path $RepoRoot "nyra-mes-api"
$ModbusRoot = Join-Path $RepoRoot "nyra-smart-modbus-sim-api"

function Stop-Port([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            if ($_ -and $_ -ne 0) {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        }
}

Write-Host "`n=== Restart local AC stack ===" -ForegroundColor Cyan
Write-Host "Stopping old listeners on 8001, 8010, 5173..." -ForegroundColor Yellow
Stop-Port 8001
Stop-Port 8010
Stop-Port 5173
Start-Sleep -Seconds 2

Write-Host "Starting MES API on port 8001..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
    "cd '$ApiRoot'; .\venv\Scripts\Activate.ps1; `$env:AUTH_ENABLED='false'; `$env:AUTH_DEV_USER_ROLES='MES_SuperAdmin'; `$env:DEFAULT_TENANT_CODE='SAM_CARBONS'; uvicorn app.main:app --host 127.0.0.1 --port 8001"
) | Out-Null

Write-Host "Starting Modbus sim on port 8010..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
    "cd '$ModbusRoot'; .\.venv\Scripts\Activate.ps1; uvicorn main:app --host 127.0.0.1 --port 8010"
) | Out-Null

Write-Host "Waiting for backends..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $h1 = Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -TimeoutSec 3
        $h2 = Invoke-WebRequest -Uri "http://127.0.0.1:8010/health" -TimeoutSec 3
        if ($h1.StatusCode -eq 200 -and $h2.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Seconds 2 }
}

if ($ready) {
    Write-Host "Backends OK." -ForegroundColor Green
} else {
    Write-Host "WARN: backends slow to start - check the two new PowerShell windows." -ForegroundColor Yellow
}

Set-Location $UiRoot
Write-Host "`nStarting UI (npm run dev:ac)..." -ForegroundColor Green
Write-Host ""
Write-Host "Open:" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:5173/activated-carbon/dashboard"
Write-Host "  http://127.0.0.1:5173/activated-carbon/kiln-telemetry"
Write-Host ""
Write-Host "MES API:  http://127.0.0.1:8001  (not 8000)" -ForegroundColor Cyan
Write-Host "Modbus:   http://127.0.0.1:8010" -ForegroundColor Cyan
Write-Host ""

npm run dev:ac -- --host 127.0.0.1 --port 5173
