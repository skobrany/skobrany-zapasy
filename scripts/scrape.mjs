import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { COMPETITIONS, CLUB_TEAM_NAME } from './competitions.mjs';
import { parseCzechDateTime } from './date-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function scrapeCompetition(page, comp) {
  const url = `https://www.fotbal.cz/souteze/turnaje/zapas/${comp.id}`;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('li.MatchRound.js-matchRound', { timeout: 20000 });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      if (process.env.DEBUG_SCRAPE) {
        const dir = path.join(__dirname, '..', 'data', 'debug');
        fs.mkdirSync(dir, { recursive: true });
        const base = `${comp.code}-attempt${attempt}`;
        try {
          await page.screenshot({ path: path.join(dir, `${base}.png`), fullPage: true });
          fs.writeFileSync(path.join(dir, `${base}.html`), await page.content(), 'utf-8');
          fs.writeFileSync(path.join(dir, `${base}.txt`), `URL: ${page.url()}\nTitle: ${await page.title()}\n`, 'utf-8');
        } catch (dbgErr) {
          console.error('Debug capture failed:', dbgErr.message);
        }
      }
      await page.waitForTimeout(4000 + attempt * 2000);
    }
  }
  if (lastError) {
    throw new Error(`Nepodařilo se načíst zápasy pro "${comp.name}" (${comp.id}): ${lastError.message}`);
  }

  const rawMatches = await page.$$eval('li.MatchRound.js-matchRound', (cards) => {
    return cards.map((card) => {
      const main = card.querySelector('.MatchRound-mainInfoContainer');
      const teamSpans = main ? main.querySelectorAll('span.H7') : [];
      const home = teamSpans[0] ? teamSpans[0].textContent.trim() : '';
      const away = teamSpans[1] ? teamSpans[1].textContent.trim() : '';
      const scoreEl = main ? main.querySelector('strong.H4.u-c-tertiary') : null;
      const score = scoreEl ? scoreEl.textContent.trim() : null;

      let dateText = null;
      let matchNumber = null;
      card.querySelectorAll('ul.MatchRound-meta li').forEach((li) => {
        const t = li.textContent.replace(/\s+/g, ' ').trim();
        if (t.startsWith('Datum:')) dateText = t.replace('Datum:', '').trim();
        if (t.startsWith('Číslo utkání:')) matchNumber = t.replace('Číslo utkání:', '').trim();
      });

      return { home, away, score, dateText, matchNumber };
    });
  });

  return rawMatches
    .filter((m) => m.home === CLUB_TEAM_NAME || m.away === CLUB_TEAM_NAME)
    .map((m) => ({ ...m, date: parseCzechDateTime(m.dateText) }))
    .filter((m) => m.date instanceof Date && !isNaN(m.date))
    .sort((a, b) => a.date - b.date);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'cs-CZ',
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const results = [];
  const errors = [];

  const competitions = process.env.DEBUG_SCRAPE ? COMPETITIONS.slice(0, 1) : COMPETITIONS;

  for (const comp of competitions) {
    console.log(`Stahuji: ${comp.name}...`);
    try {
      const matches = await scrapeCompetition(page, comp);
      const played = matches.filter((m) => m.score);
      const lastPlayed = played.length ? played[played.length - 1] : null;
      const upcoming = matches.filter((m) => !m.score && m.date >= now && m.date <= weekAhead);
      results.push({ code: comp.code, name: comp.name, lastPlayed, upcoming });
      console.log(`  -> odehráno celkem ${played.length}, nadcházejících (7 dní): ${upcoming.length}`);
    } catch (e) {
      console.error(`  CHYBA: ${e.message}`);
      errors.push({ competition: comp.name, error: e.message });
      results.push({ code: comp.code, name: comp.name, lastPlayed: null, upcoming: [], error: e.message });
    }
    await page.waitForTimeout(1200 + Math.random() * 1500);
  }

  await browser.close();

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'matches.json'),
    JSON.stringify({ generatedAt: now.toISOString(), categories: results }, null, 2),
    'utf-8'
  );

  console.log(`Hotovo. Uloženo do data/matches.json (${results.length} kategorií, ${errors.length} chyb).`);

  // Pokud selhaly úplně všechny kategorie, ukonči s chybou -> GitHub Actions pošle upozornění mailem
  // a nepřepíšeme WP stránku prázdnými/nesmyslnými daty.
  if (errors.length === competitions.length) {
    console.error('Všechny kategorie selhaly, přerušuji (stránka na webu zůstane nezměněná).');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
