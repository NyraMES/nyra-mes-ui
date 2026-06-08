# Start Nyra MES UI in video demo mode (matches API on port 8000)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env.demo")) {
    Copy-Item ".env.demo.example" ".env.demo"
    Write-Host "Created .env.demo from example" -ForegroundColor Yellow
}

Write-Host "Starting UI demo at http://127.0.0.1:5173/workflow" -ForegroundColor Green
Write-Host "Ensure API is running: cd ..\nyra-mes-api; .\scripts\run_video_demo.ps1" -ForegroundColor Cyan

npm run dev:demo -- --host 127.0.0.1 --port 5173
