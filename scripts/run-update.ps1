# Spousti se z naplanovane ulohy (viz setup-task.ps1). Nacte lokalni prihlasovaci
# udaje a spusti stazeni + publikaci. Vystup se loguje do logs/run-update.log.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'run-update.log'

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

$credFile = Join-Path $root '.credentials.ps1'
if (-not (Test-Path $credFile)) {
    Log "CHYBA: chybi $credFile - spust nejdriv setup-task.ps1"
    exit 1
}
. $credFile

Log "Spoustim scrape.mjs..."
& node scripts/scrape.mjs 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
    Log "scrape.mjs selhal (exit $LASTEXITCODE), publish se nespousti."
    exit 1
}

Log "Spoustim publish.mjs..."
& node scripts/publish.mjs 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
    Log "publish.mjs selhal (exit $LASTEXITCODE)."
    exit 1
}

Log "Hotovo."
