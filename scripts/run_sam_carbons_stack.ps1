# Start SAM_CARBONS Activated Carbon — API + UI (two terminals)
#
# Usage (from nyra-mes-ui):
#   .\scripts\run_sam_carbons_stack.ps1
#   .\scripts\run_sam_carbons_stack.ps1 -Seed    # wipe/seed DB first
#
# Opens API in a new PowerShell window, then starts the UI here.

param(
    [switch]$Seed
)

$UiRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ApiRoot = Join-Path (Split-Path -Parent $UiRoot) "nyra-mes-api"

if (-not (Test-Path $ApiRoot)) {
    Write-Host "ERROR: nyra-mes-api not found at $ApiRoot" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$UiRoot\.env.ac")) {
    Copy-Item "$UiRoot\.env.ac.example" "$UiRoot\.env.ac"
    Write-Host "Created .env.ac from .env.ac.example" -ForegroundColor Yellow
}

$apiScript = Join-Path $ApiRoot "scripts\run_sam_carbons_api.ps1"
if (-not (Test-Path $apiScript)) {
    Write-Host "ERROR: Missing $apiScript" -ForegroundColor Red
    exit 1
}

$seedArg = if ($Seed) { "-Seed" } else { "" }

Write-Host "`n=== SAM_CARBONS stack ===" -ForegroundColor Green
Write-Host "1) Starting API in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $apiScript,
    $seedArg
) | Out-Null

Write-Host "2) Waiting for API health..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 3
        if ($r.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "WARN: API not ready yet — check the API window for DB/password errors." -ForegroundColor Yellow
} else {
    Write-Host "OK: API is up." -ForegroundColor Green
}

Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
        if ($_ -and $_ -ne 0) {
            $proc = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -match "node") {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        }
    }
Start-Sleep -Seconds 1

Set-Location $UiRoot
Write-Host "`n3) Starting UI (npm run dev:ac)..." -ForegroundColor Cyan
Write-Host @"

When Vite is ready, open:
  http://127.0.0.1:5173/activated-carbon/dashboard
  http://127.0.0.1:5173/activated-carbon/masters

Tenant: SAM_CARBONS · Workspace: SAM_CARBONS_ACTIVATED_CARBON

"@ -ForegroundColor Green

npm run dev:ac -- --host 127.0.0.1 --port 5173
