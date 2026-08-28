import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEAMS } from './competitions.mjs';
import { parseCzechDateTime } from './date-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATCHES_URL = 'https://is.fotbal.cz/public/kluby/zapasy-klubu/?sport=fotbal';

// Píšeme přes stderr (console.error), protože Node ho na Windows i při přesměrování
// do souboru flushuje synchronně řádek po řádku - stdout (console.log) se při
// přesměrování často bufferuje a objeví se najednou až na konci/při pádu procesu.
function log(msg) {
  console.error(`[${new Date().toISOString()}] ${msg}`);
}

async function login(page, email, password) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`Načítám přihlašovací stránku IS FAČR (pokus ${attempt}/3)...`);
    try {
      await page.goto('https://is.fotbal.cz/?discipline=football', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      log(`  Pokus ${attempt}/3 o načtení přihlašovací stránky selhal: ${e.message}`);
      await page.waitForTimeout(5000);
    }
  }
  if (lastErr) throw lastErr;

  log('Přihlašovací stránka načtena, vyplňuji formulář...');
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  log('Klikám na tlačítko Přihlásit...');
  await page.locator('button:has-text("Přihlásit"), button[type="submit"]').first().click();
  await page.waitForTimeout(4000);

  const stillHasPasswordField = await page.locator('input[type="password"]').count();
  if (stillHasPasswordField > 0) {
    throw new Error('Přihlášení do IS FAČR se nezdařilo (formulář pro heslo je stále zobrazen).');
  }
  log('Přihlášení potvrzeno (formulář pro heslo zmizel).');
}

function parseRow(cells) {
  // cells: array of 9 <td> elements' data already extracted in the browser context
  return cells;
}

async function scrapeAllMatches(page) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`Načítám stránku s rozpisem zápasů (pokus ${attempt}/3)...`);
    try {
      await page.goto(MATCHES_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('table[id*="gridData"]', { timeout: 20000 });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      log(`  Pokus ${attempt}/3 o načtení rozpisu zápasů selhal: ${e.message}`);
      await page.waitForTimeout(5000);
    }
  }
  if (lastErr) throw lastErr;
  log('Tabulka se zápasy načtena, prochazím stránkování...');

  const allRows = [];
  const seenPages = new Set();
  let currentPage = 1;
  let maxPage = 1;

  for (let guard = 0; guard < 25; guard++) {
    await page.waitForTimeout(600);
    const { rows, pagerNumbers } = await page.evaluate(() => {
      const table = document.querySelector('table[id*="gridData"]');
      const trs = Array.from(table.querySelectorAll('tr'));
      const rows = [];
      for (const tr of trs) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 9) continue;
        const dateDiv = tds[0];
        const matchNumber = dateDiv.querySelector('div') ? dateDiv.querySelector('div').textContent.trim() : '';
        const dateText = dateDiv.querySelector('strong') ? dateDiv.querySelector('strong').textContent.trim() : '';
        const teamLinks = tds[3].querySelectorAll('a');
        if (teamLinks.length < 2) continue;
        const home = teamLinks[0].textContent.trim();
        const away = teamLinks[1].textContent.trim();
        const score = tds[4].textContent.replace(/\s+/g, ' ').trim();
        const compLinks = tds[7].querySelectorAll('a');
        const competitionCode = compLinks[0] ? compLinks[0].textContent.trim() : '';
        const competitionName = compLinks[1] ? compLinks[1].textContent.trim() : '';
        rows.push({ matchNumber, dateText, home, away, score, competitionCode, competitionName });
      }
      const pagerNumbers = Array.from(document.querySelectorAll('a[href*="Page$"]'))
        .map((a) => a.textContent.trim())
        .filter((t) => /^\d+$/.test(t))
        .map(Number);
      return { rows, pagerNumbers };
    });

    allRows.push(...rows);
    seenPages.add(currentPage);
    if (pagerNumbers.length) {
      maxPage = Math.max(maxPage, ...pagerNumbers);
    }
    log(`  Stránka ${currentPage}/${maxPage}: ${rows.length} řádků (celkem zatím ${allRows.length}).`);

    const nextPage = currentPage + 1;
    if (nextPage > maxPage || seenPages.has(nextPage)) break;

    // Klikneme na skutečný odkaz stránky (ne __doPostBack přes evaluate - to naráží na
    // strict-mode omezení Playwrightu v interakci s legacy ASP.NET WebForms skriptem).
    await page
      .locator(`a[href*="'Page$${nextPage}');"]`)
      .first()
      .click();
    await page.waitForTimeout(1500);
    currentPage = nextPage;
  }

  return allRows
    .map((r) => ({ ...r, date: parseCzechDateTime(r.dateText) }))
    .filter((r) => r.date instanceof Date && !isNaN(r.date));
}

function splitClubTeam(text) {
  // "6220521 - Obřany A" -> { clubId: "6220521", teamName: "Obřany A" }
  const m = text.match(/^(\d+)\s*-\s*(.+)$/);
  if (!m) return { clubId: '', teamName: text.trim() };
  return { clubId: m[1], teamName: m[2].trim() };
}

async function main() {
  const email = process.env.IS_FOTBAL_EMAIL;
  const password = process.env.IS_FOTBAL_PASSWORD;
  if (!email || !password) {
    console.error('Chybí IS_FOTBAL_EMAIL / IS_FOTBAL_PASSWORD.');
    process.exit(1);
  }

  log('Spouštím headless Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'cs-CZ', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  log('Přihlašuji se do IS FAČR...');
  await login(page, email, password);
  log('Přihlášení OK, stahuji rozpis zápasů...');

  const rawMatches = await scrapeAllMatches(page);
  log(`Staženo ${rawMatches.length} řádků z rozpisu.`);

  await browser.close();

  const now = new Date();

  const results = [];
  for (const team of TEAMS) {
    const teamMatches = rawMatches
      .filter((r) => r.competitionCode === team.competitionCode)
      .map((r) => {
        const home = splitClubTeam(r.home);
        const away = splitClubTeam(r.away);
        return { ...r, home, away };
      })
      .filter((r) => home_or_away_is_team(r, team.teamName))
      .sort((a, b) => a.date - b.date);

    // Ukládáme kompletní rozpis (odehrané i budoucí zápasy) - stránka si je sama
    // po týdnech (po-ne) filtruje na klientovi (viz render.mjs).
    results.push({
      code: team.competitionCode,
      name: team.name,
      matches: teamMatches.map(formatMatch),
    });

    const played = teamMatches.filter((m) => m.score && !m.score.includes('--')).length;
    log(`  ${team.name}: ${teamMatches.length} zápasů celkem, odehráno ${played}`);
  }

  function home_or_away_is_team(r, teamName) {
    return r.home.teamName === teamName || r.away.teamName === teamName;
  }

  function formatMatch(m) {
    return {
      home: m.home.teamName,
      away: m.away.teamName,
      score: m.score && !m.score.includes('--') ? m.score.replace(/\s*:\s*/, ':') : null,
      dateText: m.dateText,
      date: m.date,
      matchNumber: m.matchNumber,
    };
  }

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'matches.json'),
    JSON.stringify({ generatedAt: now.toISOString(), categories: results }, null, 2),
    'utf-8'
  );

  log('Hotovo. Uloženo do data/matches.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
