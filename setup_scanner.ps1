$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StaticDir = Join-Path $ProjectDir "static"
$Target = Join-Path $StaticDir "html5-qrcode.min.js"
$Url = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js"

Write-Host "Installation locale du scanner StockMaison..." -ForegroundColor Cyan

if (!(Test-Path $StaticDir)) {
    New-Item -ItemType Directory -Path $StaticDir | Out-Null
}

if (Test-Path $Target) {
    $size = (Get-Item $Target).Length
    if ($size -gt 100000) {
        Write-Host "html5-qrcode est deja installe localement ($size octets)." -ForegroundColor Green
        exit 0
    }
}

try {
    Invoke-WebRequest -Uri $Url -OutFile $Target -UseBasicParsing
} catch {
    Write-Host "Le telechargement principal a echoue. Essai avec jsDelivr..." -ForegroundColor Yellow
    $Url2 = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"
    Invoke-WebRequest -Uri $Url2 -OutFile $Target -UseBasicParsing
}

$size = (Get-Item $Target).Length
if ($size -lt 100000) {
    throw "Le fichier telecharge semble invalide ($size octets)."
}

Write-Host "Scanner installe localement : $Target" -ForegroundColor Green
Write-Host "Taille : $size octets" -ForegroundColor Green
