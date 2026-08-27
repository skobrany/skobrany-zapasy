# Zápasy SK Obřany na skobrany.cz

Stahuje rozpis a výsledky všech 11 družstev SK Obřany z **IS FAČR** (is.fotbal.cz)
a publikuje je jako obsah stránky https://skobrany.cz/zapasy/ přes WordPress REST API.

Pro každé družstvo se zobrazí:
- poslední odehraný zápas (s výsledkem),
- zápasy v následujících 7 dnech.

## Proč to neběží automaticky v cloudu

Původně mělo tohle běžet přes GitHub Actions na cronu (viz historie commitů). Ukázalo se ale,
že **celá infrastruktura FAČR (www.fotbal.cz i is.fotbal.cz) blokuje datacentrové IP adresy**
(GitHub Actions, pravděpodobně i jiné cloudové poskytovatele) na síťové/firewall úrovni —
požadavky končí timeoutem (`ERR_CONNECTION_TIMED_OUT`), zatímco ze "obyčejné" domácí IP adresy
vše funguje normálně.

Řešení proto běží **lokálně** — spouští se ručně (nebo časem přes Windows Plánovač úloh)
na počítači správce klubu.

## Jak spustit aktualizaci

Vyžaduje Node.js 18+ (na tomto PC už je nainstalovaný).

```bash
npm install
npx playwright install chromium
```

Nastav proměnné prostředí a spusť stažení + publikaci:

```powershell
$env:IS_FOTBAL_EMAIL = "..."
$env:IS_FOTBAL_PASSWORD = "..."
node scripts/scrape.mjs

$env:WP_URL = "https://www.skobrany.cz"
$env:WP_USER = "SKObrany"
$env:WP_APP_PASSWORD = "..."
$env:WP_PAGE_ID = "466"
node scripts/publish.mjs
```

`IS_FOTBAL_EMAIL` / `IS_FOTBAL_PASSWORD` jsou přihlašovací údaje do IS FAČR (účet správce
klubu s přístupem k "Utkání klubu"). `WP_APP_PASSWORD` je Application Password vytvořené
v profilu WP účtu (Uživatelé → Profil → Hesla aplikací).

**Nikdy tyto proměnné/hesla nezapisuj do souborů, které se commitují do gitu.**

## Jak to funguje

1. `scripts/scrape.mjs` – přihlásí se přes Playwright (headless Chromium) do IS FAČR,
   otevře stránku „Utkání klubu", projde stránkování a vytáhne zápasy všech 11 družstev
   (viz `scripts/competitions.mjs`). Výsledek uloží do `data/matches.json`.
2. `scripts/publish.mjs` – z `data/matches.json` vyrenderuje HTML (`scripts/render.mjs`)
   a přes WordPress REST API (`/wp-json/wp/v2/pages/466`) přepíše obsah stránky Zápasy.

## Případná automatizace přes Windows Plánovač úloh

Až bude chuť to zautomatizovat, jde vytvořit naplánovanou úlohu, která spustí:

```powershell
node scripts/scrape.mjs; node scripts/publish.mjs
```

s výše uvedenými proměnnými prostředí nastavenými v samotné úloze (ne v repozitáři).
Funguje to jen když je počítač zapnutý a připojený k internetu v čase spuštění.

## Úprava vzhledu / družstev

- Seznam družstev a jejich přiřazení k soutěžím: `scripts/competitions.mjs`
- Vzhled stránky (barvy, rozložení): `scripts/render.mjs`

## GitHub Actions (aktuálně nepoužíváno)

Workflow `.github/workflows/update-matches.yml` zůstává v repozitáři pro případ, že by FAČR
blokaci v budoucnu zrušil. Naplánované spouštění (cron) je zakomentované. Pro ruční test by
bylo potřeba znovu nastavit GitHub Secrets (`WP_URL`, `WP_USER`, `WP_APP_PASSWORD`,
`WP_PAGE_ID`, `IS_FOTBAL_EMAIL`, `IS_FOTBAL_PASSWORD`) — ty byly z bezpečnostních důvodů
smazány, protože bez fungující sítě nebyly k ničemu.
