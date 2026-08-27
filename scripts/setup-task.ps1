# Jednorazove nastaveni na novem pocitaci:
# - nainstaluje zavislosti (npm + Playwright Chromium)
# - vyzada prihlasovaci udaje a ulozi je LOKALNE (mimo git) do .credentials.ps1
# - zalozi naplanovanou ulohu ve Windows Plánovači úloh (2x denne)
#
# Spustit v PowerShellu (z korenu repozitare, nebo odkudkoli - cesty se dopocitaji):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-task.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== SK Obrany - nastaveni aktualizace zapasu ==" -ForegroundColor Green
Write-Host "Repozitar: $root"
Write-Host ""

# --- Node.js kontrola ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Node.js neni nainstalovany. Instaluji pres winget..." -ForegroundColor Yellow
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    Write-Host "Node.js nainstalovan. Zavri a znovu otevri PowerShell, pak skript spust znovu." -ForegroundColor Yellow
    exit 0
}

# --- zavislosti ---
Write-Host "Instaluji zavislosti (npm install)..."
npm install
Write-Host "Instaluji Chromium pro Playwright..."
npx playwright install chromium

# --- prihlasovaci udaje ---
$credFile = Join-Path $root '.credentials.ps1'
if (-not (Test-Path $credFile)) {
    Write-Host ""
    Write-Host "Zadej prihlasovaci udaje (ulozi se pouze lokalne do .credentials.ps1, NIKDY ne do gitu):" -ForegroundColor Cyan

    $isEmail = Read-Host "IS FACR e-mail"
    $isPassSecure = Read-Host "IS FACR heslo" -AsSecureString
    $isPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($isPassSecure))

    $wpUrl = Read-Host "WP URL (napr. https://www.skobrany.cz)"
    $wpUser = Read-Host "WP uzivatelske jmeno"
    $wpAppPassSecure = Read-Host "WP Application Password (Uzivatele -> Profil -> Hesla aplikaci)" -AsSecureString
    $wpAppPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($wpAppPassSecure))
    $wpPageId = Read-Host "WP Page ID (napr. 466)"

    function Esc($s) { return $s -replace '"', '`"' }

    $content = @"
`$env:IS_FOTBAL_EMAIL = "$(Esc $isEmail)"
`$env:IS_FOTBAL_PASSWORD = "$(Esc $isPass)"
`$env:WP_URL = "$(Esc $wpUrl)"
`$env:WP_USER = "$(Esc $wpUser)"
`$env:WP_APP_PASSWORD = "$(Esc $wpAppPass)"
`$env:WP_PAGE_ID = "$(Esc $wpPageId)"
"@
    Set-Content -Path $credFile -Value $content -Encoding utf8
    Write-Host "Ulozeno do $credFile" -ForegroundColor Green
} else {
    Write-Host "$credFile uz existuje, prihlasovaci udaje se nemeni (smaz ho rucne, pokud je chces zadat znovu)."
}

# --- naplanovana uloha ---
$taskName = "SKObrany-AktualizaceZapasu"
$scriptPath = Join-Path $root 'scripts\run-update.ps1'

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Naplanovana uloha '$taskName' uz existuje, ruším a zakládám znovu." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger1 = New-ScheduledTaskTrigger -Daily -At 7:00am
$trigger2 = New-ScheduledTaskTrigger -Daily -At 7:00pm
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger @($trigger1, $trigger2) `
    -Settings $settings `
    -Description "Aktualizace zapasu SK Obrany na skobrany.cz (IS FACR -> WordPress)" `
    -Force | Out-Null

Write-Host ""
Write-Host "Hotovo! Naplanovana uloha '$taskName' beží kazdy den v 7:00 a 19:00." -ForegroundColor Green
Write-Host "Rucni test hned ted:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "Log najdes v:         $root\logs\run-update.log"
