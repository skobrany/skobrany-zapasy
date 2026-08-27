import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderPage } from './render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Chybí proměnná prostředí ${name}.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const wpUrl = requireEnv('WP_URL').replace(/\/+$/, '');
  const wpUser = requireEnv('WP_USER');
  const wpAppPassword = requireEnv('WP_APP_PASSWORD');
  const wpPageId = requireEnv('WP_PAGE_ID');

  const dataPath = path.join(__dirname, '..', 'data', 'matches.json');
  if (!fs.existsSync(dataPath)) {
    console.error('data/matches.json neexistuje, spusť nejdřív "npm run scrape".');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const html = renderPage(data);

  const endpoint = `${wpUrl}/wp-json/wp/v2/pages/${wpPageId}`;
  const auth = Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64');

  console.log(`Publikuji na ${endpoint} ...`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`WordPress REST API vrátilo chybu ${res.status}: ${body}`);
    process.exit(1);
  }

  const json = await res.json();
  console.log(`Hotovo. Stránka aktualizována: ${json.link || wpPageId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
