$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Target = Join-Path $ProjectDir "static\quagga.min.js"
$Url = "https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js"
Write-Host "Installation locale de Quagga2..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $Url -OutFile $Target
if (!(Test-Path $Target)) { throw "Le fichier Quagga2 n'a pas ete cree." }
$size=(Get-Item $Target).Length
if ($size -lt 50000) { throw "Le fichier Quagga2 telecharge semble invalide ($size octets)." }
Write-Host "Quagga2 installe : $Target ($size octets)" -ForegroundColor Green
