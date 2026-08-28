# Spousti se z naplanovane ulohy (viz setup-task.ps1). Pred kazdym behem se pokusi
# stahnout nejnovejsi verzi kodu z gitu, pak nacte lokalni prihlasovaci udaje a spusti
# stazeni + publikaci. Vystup se loguje do logs/run-update.log.

# POZOR: NEnastavovat $ErrorActionPreference = 'Stop' - v kombinaci s "2>&1" na
# nativnim prikazu (node.exe) to v PowerShellu 5.1 zpusobi, ze KAZDY radek na stderr
# (i bezna informacni hlaska, ne jen chyba) je bran jako ukoncujici vyjimka a cely
# skript se potichu zabije bez zapisu do logu. Chyby resime rucne pres $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
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

Log "===== Start ====="

# --- automaticka aktualizace z gitu (pokud je k dispozici) ---
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    try {
        $before = (& git rev-parse --short HEAD 2>&1)
        $pullOutput = (& git pull --ff-only 2>&1 | Out-String).Trim()
        $after = (& git rev-parse --short HEAD 2>&1)
        if ($before -ne $after) {
            Log "Kod aktualizovan: $before -> $after"
            Log "  git pull: $pullOutput"
        } else {
            Log "Kod je aktualni (verze $after), zadne nove zmeny."
        }
    } catch {
        Log "VAROVANI: git pull selhal, pokracuji se stavajici verzi kodu. Chyba: $($_.Exception.Message)"
    }
} else {
    Log "VAROVANI: git neni dostupny, aktualizace kodu se preskakuje."
}

$version = try { (& git rev-parse --short HEAD 2>&1) } catch { "neznama" }
Log "Bezici verze kodu: $version"

$credFile = Join-Path $root '.credentials.ps1'
if (-not (Test-Path $credFile)) {
    Log "CHYBA: chybi $credFile - spust nejdriv setup-task.ps1"
    exit 1
}
. $credFile

Log "Spoustim scrape.mjs..."
& node scripts/scrape.mjs 2>&1 | ForEach-Object {
    Write-Host $_
    Add-Content -Path $logFile -Value $_
}
if ($LASTEXITCODE -ne 0) {
    Log "scrape.mjs selhal (exit $LASTEXITCODE), publish se nespousti."
    exit 1
}

Log "Spoustim publish.mjs..."
& node scripts/publish.mjs 2>&1 | ForEach-Object {
    Write-Host $_
    Add-Content -Path $logFile -Value $_
}
if ($LASTEXITCODE -ne 0) {
    Log "publish.mjs selhal (exit $LASTEXITCODE)."
    exit 1
}

Log "Hotovo."
