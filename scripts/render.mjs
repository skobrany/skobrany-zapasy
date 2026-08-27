import { formatCzechDate, formatCzechDateShort } from './date-utils.mjs';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function teamSpan(name) {
  const isUs = name.startsWith('Obřany');
  return `<span class="${isUs ? 'sko-team-us' : ''}">${esc(name)}</span>`;
}

function renderLastRow(cat) {
  const m = cat.lastPlayed;
  if (cat.error) {
    return `
      <div class="sko-row">
        <span class="sko-cat">${esc(cat.name)}</span>
        <span class="sko-empty">data se nepodařilo načíst</span>
      </div>`;
  }
  if (!m) {
    return `
      <div class="sko-row">
        <span class="sko-cat">${esc(cat.name)}</span>
        <span class="sko-empty">zatím nebyl odehrán žádný zápas</span>
      </div>`;
  }
  return `
    <div class="sko-row">
      <span class="sko-cat">${esc(cat.name)}</span>
      <span class="sko-match-line">${teamSpan(m.home)} <span class="sko-score">${esc(m.score)}</span> ${teamSpan(m.away)}</span>
      <span class="sko-date">${esc(formatCzechDateShort(m.date))}</span>
    </div>`;
}

function renderUpcomingRows(cat) {
  if (cat.error) return '';
  if (!cat.upcoming || !cat.upcoming.length) {
    return `
      <div class="sko-row">
        <span class="sko-cat">${esc(cat.name)}</span>
        <span class="sko-empty">v následujících 7 dnech se nehraje</span>
      </div>`;
  }
  return cat.upcoming
    .map(
      (m) => `
    <div class="sko-row">
      <span class="sko-cat">${esc(cat.name)}</span>
      <span class="sko-match-line">${teamSpan(m.home)} <span class="sko-vs">–</span> ${teamSpan(m.away)}</span>
      <span class="sko-date">${esc(formatCzechDateShort(m.date))}</span>
    </div>`
    )
    .join('\n');
}

export function renderPage(data) {
  const updated = formatCzechDate(new Date(data.generatedAt));
  const lastRows = data.categories.map(renderLastRow).join('\n');
  const upcomingRows = data.categories.map(renderUpcomingRows).join('\n');

  return `<!-- wp:html -->
<style>
.sko-zapasy-wrap { --sko-green:#1c6b32; --sko-bg:#f6f8f6; --sko-border:#dfe6df; font-family:inherit; }
.sko-zapasy-updated { font-size:0.85em; color:#6b7a6f; margin:0 0 1.4em; }
.sko-block { margin-bottom: 2em; }
.sko-block-title { font-size:1.3em; color:var(--sko-green); border-bottom:2px solid var(--sko-green); padding-bottom:8px; margin:0 0 4px; }
.sko-list { background:var(--sko-bg); border:1px solid var(--sko-border); border-radius:10px; overflow:hidden; }
.sko-row { display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 12px; padding:10px 16px; border-top:1px solid var(--sko-border); }
.sko-row:first-child { border-top:none; }
.sko-cat { font-weight:600; min-width:220px; flex-shrink:0; }
.sko-match-line { flex-grow:1; }
.sko-team-us { font-weight:700; }
.sko-score { font-weight:700; color:var(--sko-green); }
.sko-vs { color:#9aa89d; }
.sko-date { font-size:0.85em; color:#6b7a6f; margin-left:auto; white-space:nowrap; }
.sko-empty { color:#8a978c; font-size:0.9em; font-style:italic; }
@media (max-width:600px){
  .sko-cat { min-width:100%; }
  .sko-date { margin-left:0; }
}
</style>
<div class="sko-zapasy-wrap">
  <p class="sko-zapasy-updated">Aktualizováno: ${esc(updated)} (automaticky, zdroj: IS FAČR)</p>

  <div class="sko-block">
    <h2 class="sko-block-title">Poslední zápasy</h2>
    <div class="sko-list">
      ${lastRows}
    </div>
  </div>

  <div class="sko-block">
    <h2 class="sko-block-title">Nejbližší zápasy (7 dní)</h2>
    <div class="sko-list">
      ${upcomingRows}
    </div>
  </div>
</div>
<!-- /wp:html -->`;
}
