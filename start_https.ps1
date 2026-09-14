$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$Quagga = Join-Path $ProjectDir "static\quagga.min.js"
if (!(Test-Path $Quagga)) {
    Write-Host "Quagga2 absent : telechargement automatique..." -ForegroundColor Yellow
    & (Join-Path $ProjectDir "setup_quagga.ps1")
}

if (Test-Path ".\venv\Scripts\Activate.ps1") { . .\venv\Scripts\Activate.ps1 }
$cert = Get-ChildItem -Path $ProjectDir -Filter "*.pem" | Where-Object { $_.Name -notlike "*-key.pem" } | Select-Object -First 1
$key  = Get-ChildItem -Path $ProjectDir -Filter "*-key.pem" | Select-Object -First 1
if (!$cert -or !$key) {
    Write-Host "Certificat HTTPS introuvable." -ForegroundColor Red
    exit 1
}
Write-Host "StockMaison V2.8 / Quagga2 - HTTPS port 8443" -ForegroundColor Cyan
python -m uvicorn app:app --host 0.0.0.0 --port 8443 --ssl-certfile $cert.FullName --ssl-keyfile $key.FullName
