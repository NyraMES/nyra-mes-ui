# Start UI for Activated Carbon local validation (not video demo)
# Usage: .\scripts\run_ac_ui.ps1

$UiRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path "$UiRoot\.env.ac")) {
    Copy-Item "$UiRoot\.env.ac.example" "$UiRoot\.env.ac"
    Write-Host "Created .env.ac from .env.ac.example" -ForegroundColor Yellow
}

Set-Location $UiRoot
Write-Host "`n=== Activated Carbon UI (npm run dev:ac) ===" -ForegroundColor Green
Write-Host "Open: http://127.0.0.1:5173/activated-carbon/dashboard`n" -ForegroundColor Cyan
npm run dev:ac -- --host 127.0.0.1 --port 5173
