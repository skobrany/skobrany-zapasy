import { formatCzechDate } from './date-utils.mjs';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderLastPlayed(m) {
  if (!m) {
    return `<p class="sko-empty">Zatím nebyl odehrán žádný zápas.</p>`;
  }
  const isHome = m.home.startsWith('Obřany');
  return `
    <div class="sko-match sko-match--played">
      <div class="sko-match-date">${esc(formatCzechDate(m.date))}</div>
      <div class="sko-match-teams">
        <span class="${isHome ? 'sko-team-us' : ''}">${esc(m.home)}</span>
        <span class="sko-score">${esc(m.score)}</span>
        <span class="${!isHome ? 'sko-team-us' : ''}">${esc(m.away)}</span>
      </div>
    </div>`;
}

function renderUpcoming(list) {
  if (!list || !list.length) {
    return `<p class="sko-empty">V následujících 7 dnech se nehraje.</p>`;
  }
  const items = list
    .map((m) => {
      const isHome = m.home.startsWith('Obřany');
      return `
      <div class="sko-match">
        <div class="sko-match-date">${esc(formatCzechDate(m.date))}</div>
        <div class="sko-match-teams">
          <span class="${isHome ? 'sko-team-us' : ''}">${esc(m.home)}</span>
          <span class="sko-vs">–</span>
          <span class="${!isHome ? 'sko-team-us' : ''}">${esc(m.away)}</span>
        </div>
      </div>`;
    })
    .join('\n');
  return items;
}

function renderCategory(cat) {
  if (cat.error) {
    return `
    <div class="sko-card">
      <h3 class="sko-card-title">${esc(cat.name)}</h3>
      <p class="sko-empty">Data se teď nepodařilo načíst, zkusíme to znovu při příští aktualizaci.</p>
    </div>`;
  }
  return `
    <div class="sko-card">
      <h3 class="sko-card-title">${esc(cat.name)}</h3>
      <div class="sko-section">
        <div class="sko-section-label">Poslední zápas</div>
        ${renderLastPlayed(cat.lastPlayed)}
      </div>
      <div class="sko-section">
        <div class="sko-section-label">Nadcházející zápasy (7 dní)</div>
        ${renderUpcoming(cat.upcoming)}
      </div>
    </div>`;
}

export function renderPage(data) {
  const updated = formatCzechDate(new Date(data.generatedAt));
  const cards = data.categories.map(renderCategory).join('\n');

  return `<!-- wp:html -->
<style>
.sko-zapasy-wrap { --sko-green:#1c6b32; --sko-bg:#f6f8f6; --sko-border:#dfe6df; font-family:inherit; }
.sko-zapasy-updated { font-size:0.85em; color:#6b7a6f; margin:0 0 1.2em; }
.sko-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
.sko-card { background:var(--sko-bg); border:1px solid var(--sko-border); border-radius:10px; padding:16px 18px; }
.sko-card-title { margin:0 0 10px; font-size:1.05em; color:var(--sko-green); border-bottom:2px solid var(--sko-green); padding-bottom:6px; }
.sko-section { margin-bottom:12px; }
.sko-section:last-child { margin-bottom:0; }
.sko-section-label { font-size:0.75em; text-transform:uppercase; letter-spacing:0.04em; color:#7c8a7f; margin-bottom:6px; font-weight:600; }
.sko-match { padding:8px 0; border-top:1px solid var(--sko-border); }
.sko-match:first-of-type { border-top:none; }
.sko-match-date { font-size:0.8em; color:#6b7a6f; margin-bottom:2px; }
.sko-match-teams { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:0.95em; }
.sko-team-us { font-weight:700; }
.sko-score { font-weight:700; color:var(--sko-green); }
.sko-vs { color:#9aa89d; }
.sko-empty { color:#8a978c; font-size:0.9em; font-style:italic; margin:0; }
@media (max-width:480px){ .sko-grid{ grid-template-columns:1fr; } }
</style>
<div class="sko-zapasy-wrap">
  <p class="sko-zapasy-updated">Aktualizováno: ${esc(updated)} (automaticky, zdroj: fotbal.cz)</p>
  <div class="sko-grid">
    ${cards}
  </div>
</div>
<!-- /wp:html -->`;
}
