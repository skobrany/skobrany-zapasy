# Zápasy SK Obřany na skobrany.cz

Automaticky stahuje rozpis a výsledky všech 10 kategorií SK Obřany z fotbal.cz
a publikuje je jako obsah stránky na skobrany.cz (WordPress) přes REST API.

Pro každou kategorii se zobrazí:
- poslední odehraný zápas (s výsledkem),
- zápasy v následujících 7 dnech.

Běží automaticky každých 6 hodin přes GitHub Actions (zdarma, žádný vlastní server není potřeba).

## Jak to funguje

1. `scripts/scrape.mjs` – otevře přes Playwright (headless Chromium) stránku s rozpisem
   zápasů pro každou z 10 soutěží SK Obřany a vytáhne zápasy týmu „Obřany“.
   Výsledek uloží do `data/matches.json`.
2. `scripts/publish.mjs` – z `data/matches.json` vyrenderuje HTML (`scripts/render.mjs`)
   a přes WordPress REST API (`/wp-json/wp/v2/pages/{ID}`) přepíše obsah zvolené stránky.
3. `.github/workflows/update-matches.yml` – spouští oba kroky na cronu.

fotbal.cz nemá veřejné API a je chráněný Cloudflare, proto se nepoužívá jednoduchý
HTTP request, ale skutečný (headless) prohlížeč. Pokud FAČR ochranu proti robotům
v budoucnu zpřísní, může být potřeba scraper upravit – v takovém případě přijde
e-mail od GitHub Actions o selhání workflow.

## Nastavení – co je potřeba udělat (jednorázově)

### 1. Založit GitHub repozitář

Nahraj obsah této složky do nového (klidně privátního) GitHub repozitáře.

### 2. Připravit stránku ve WordPressu

V administraci skobrany.cz vytvoř novou **stránku** (Stránky → Přidat novou), např. s názvem
„Zápasy“, jednou ji ulož/publikuj (obsah může být prázdný, přepíše se automaticky) a z URL
v adresním řádku editoru zjisti její **ID** (číslo v `post.php?post=ID&action=edit`).

### 3. Vytvořit Application Password

V administraci: **Uživatelé → Profil** (u účtu, který smí upravovat stránky) → dole sekce
„Aplikační hesla“ (Application Passwords) → zadej název např. `skobrany-zapasy-bot` → Přidat.
Zobrazí se heslo ve formátu `xxxx xxxx xxxx xxxx xxxx xxxx` – zkopíruj si ho, zobrazí se jen jednou.

> Pozn.: Aby se zachovalo formátování (barvy, karty), účet musí mít oprávnění `unfiltered_html`
> (běžný administrátor na samostatné instalaci WP toto oprávnění má automaticky).

### 4. Nastavit GitHub Secrets

V repozitáři: **Settings → Secrets and variables → Actions → New repository secret**,
přidej:

| Název | Hodnota |
|---|---|
| `WP_URL` | `https://www.skobrany.cz` (bez lomítka na konci) |
| `WP_USER` | uživatelské jméno WP účtu z kroku 3 |
| `WP_APP_PASSWORD` | aplikační heslo z kroku 3 (i s mezerami) |
| `WP_PAGE_ID` | ID stránky z kroku 2 |

### 5. Spustit poprvé ručně

V repozitáři: **Actions → Aktualizace zápasů SK Obřany → Run workflow**. Po doběhnutí
(pár minut) zkontroluj:
- že běh workflow proběhl zeleně (bez chyby),
- že se stránka na skobrany.cz opravdu aktualizovala.

Pokud první běh selže na načtení fotbal.cz (Cloudflare), zkus workflow spustit znovu –
jde o stránku chráněnou proti robotům a příležitostné selhání je očekávatelné.

### 6. Zobrazení stránky v menu

Stránku přidej do navigačního menu webu (Vzhled → Menu) tak, jak jsi zvyklý u ostatních
stránek skobrany.cz.

## Lokální testování (nepovinné)

Vyžaduje Node.js 18+.

```bash
npm install
npx playwright install --with-deps chromium
npm run scrape
```

Zkontroluj `data/matches.json`. Publikování lokálně (potřeba nastavit env proměnné
`WP_URL`, `WP_USER`, `WP_APP_PASSWORD`, `WP_PAGE_ID`):

```bash
npm run publish
```

## Úprava vzhledu / kategorií

- Seznam soutěží a jejich pořadí: `scripts/competitions.mjs`
- Vzhled stránky (barvy, rozložení): `scripts/render.mjs`
- Frekvence aktualizace: `.github/workflows/update-matches.yml` (řádek `cron`)
