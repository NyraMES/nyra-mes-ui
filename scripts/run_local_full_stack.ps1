# Local Activated Carbon stack — MES API + Modbus Sim + UI
#
# Usage (from nyra-mes-ui):
#   .\scripts\run_local_full_stack.ps1
#   .\scripts\run_local_full_stack.ps1 -Seed   # re-seed SAM_CARBONS demo data first
#
# Opens API and Modbus sim in new PowerShell windows; UI runs in this window.

param(
    [switch]$Seed
)

$UiRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = Split-Path -Parent $UiRoot
$ApiRoot = Join-Path $RepoRoot "nyra-mes-api"
$ModbusRoot = Join-Path $RepoRoot "nyra-smart-modbus-sim-api"

foreach ($path in @($ApiRoot, $ModbusRoot)) {
    if (-not (Test-Path $path)) {
        Write-Host "ERROR: Missing $path" -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path "$UiRoot\.env.ac")) {
    Copy-Item "$UiRoot\.env.ac.example" "$UiRoot\.env.ac"
    Write-Host "Created .env.ac from .env.ac.example" -ForegroundColor Yellow
}

function Stop-PortListener {
    param([int]$Port)
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            if ($_ -and $_ -ne 0) {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        }
}

function Wait-HttpOk {
    param([string]$Url, [int]$Attempts = 45)
    for ($i = 0; $i -lt $Attempts; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $Url -TimeoutSec 3
            if ($r.StatusCode -eq 200) { return $true }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

Write-Host "`n=== Nyra MES — local Activated Carbon stack ===" -ForegroundColor Green

$apiScript = Join-Path $ApiRoot "scripts\run_sam_carbons_api.ps1"
$seedArg = if ($Seed) { "-Seed" } else { "" }

Write-Host "1) Starting MES API (port 8000) in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $apiScript, $seedArg
) | Out-Null

Write-Host "2) Starting Modbus Sim API (port 8010) in a new window..." -ForegroundColor Cyan
$modbusCmd = @"
Set-Location '$ModbusRoot'
& '$ModbusRoot\.venv\Scripts\Activate.ps1'
Write-Host 'Modbus Sim API: http://127.0.0.1:8010/docs' -ForegroundColor Cyan
uvicorn main:app --reload --host 127.0.0.1 --port 8010
"@
Start-Process powershell -ArgumentList @(
    "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $modbusCmd
) | Out-Null

Write-Host "3) Waiting for backends..." -ForegroundColor Cyan
$mesOk = Wait-HttpOk "http://127.0.0.1:8000/health"
$modbusOk = Wait-HttpOk "http://127.0.0.1:8010/health"
if ($mesOk) { Write-Host "   MES API: OK" -ForegroundColor Green }
else { Write-Host "   MES API: not ready — check the API window (DB password / venv)" -ForegroundColor Yellow }
if ($modbusOk) { Write-Host "   Modbus Sim: OK" -ForegroundColor Green }
else { Write-Host "   Modbus Sim: not ready — check the Modbus window (.env DATABASE_URL)" -ForegroundColor Yellow }

Stop-PortListener -Port 5173
Start-Sleep -Seconds 1

Set-Location $UiRoot
Write-Host "`n4) Starting UI (npm run dev:ac)..." -ForegroundColor Cyan
Write-Host @"

Open in browser:
  http://127.0.0.1:5173/
  http://127.0.0.1:5173/activated-carbon/dashboard

Tenant:  SAM_CARBONS
Workspace: SAM_CARBONS_ACTIVATED_CARBON
MES API:   http://127.0.0.1:8000
Modbus:    http://127.0.0.1:8010

"@ -ForegroundColor Green

npm run dev:ac -- --host 127.0.0.1 --port 5173
