# Start UI + run Playwright E2E (Activated Carbon local mode)
# Usage: .\scripts\run_e2e_local.ps1
#        .\scripts\run_e2e_local.ps1 -SkipWebServer   # UI already running

param(
    [switch]$SkipWebServer,
    [switch]$Headed
)

$UiRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $UiRoot

if (-not (Test-Path "$UiRoot\.env.ac")) {
    Copy-Item "$UiRoot\.env.ac.example" "$UiRoot\.env.ac"
    Write-Host "Created .env.ac from .env.ac.example" -ForegroundColor Yellow
}

Write-Host "`n=== Installing Playwright (if needed) ===" -ForegroundColor Green
npm install
npx playwright install chromium

$env:E2E_SKIP_WEBSERVER = if ($SkipWebServer) { "1" } else { "" }

$playwrightArgs = @("test")
if ($Headed) { $playwrightArgs += "--headed" }

Write-Host "`n=== Running E2E tests ===" -ForegroundColor Green
npx playwright @playwrightArgs
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nAll tests passed. Report: tests/e2e-report/index.html" -ForegroundColor Cyan
} else {
    Write-Host "`nSome tests failed. Open report: npx playwright show-report tests/e2e-report" -ForegroundColor Red
}

exit $exitCode
