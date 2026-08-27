import { formatCzechDate } from './date-utils.mjs';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Statický výpis pro <noscript> zálohu: aktuální kalendářní týden (po-ne), spočítaný
// v čase generování stránky (bez JS nejde dopočítat návštěvníkův "teď").
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = neděle
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function teamSpanStatic(name) {
  const isUs = name.startsWith('Obřany');
  return `<span class="${isUs ? 'sko-team-us' : ''}">${esc(name)}</span>`;
}

function renderStaticRow(cat, weekStart, weekEnd) {
  if (cat.error) {
    return `
      <div class="sko-row">
        <span class="sko-cat">${esc(cat.name)}</span>
        <span class="sko-empty">data se nepodařilo načíst</span>
      </div>`;
  }
  const matches = (cat.matches || []).filter((m) => {
    const d = new Date(m.date);
    return d >= weekStart && d < weekEnd;
  });
  if (!matches.length) {
    return `
      <div class="sko-row">
        <span class="sko-cat">${esc(cat.name)}</span>
        <span class="sko-empty">v tomto týdnu se nehraje</span>
      </div>`;
  }
  return matches
    .map((m) => {
      const line = m.score
        ? `${teamSpanStatic(m.home)} <span class="sko-score">${esc(m.score)}</span> ${teamSpanStatic(m.away)}`
        : `${teamSpanStatic(m.home)} <span class="sko-vs">–</span> ${teamSpanStatic(m.away)}`;
      return `
      <div class="sko-row">
        <span class="sko-cat">${esc(cat.name)}</span>
        <span class="sko-match-line">${line}</span>
        <span class="sko-date">${esc(m.dateText)}</span>
      </div>`;
    })
    .join('\n');
}

function renderStaticFallback(data) {
  const now = new Date();
  const weekStart = mondayOf(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const rows = data.categories.map((c) => renderStaticRow(c, weekStart, weekEnd)).join('\n');
  return rows;
}

function renderWidget(data) {
  const payload = data.categories.map((c) => ({
    name: c.name,
    error: !!c.error,
    matches: (c.matches || []).map((m) => ({ home: m.home, away: m.away, score: m.score, date: m.date })),
  }));
  // Bezpečné vložení JSON do <script> tagu - escapujeme "<", aby nemohlo dojít
  // k předčasnému uzavření tagu (např. řetězcem "</script>" v názvu soupeře).
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const staticRows = renderStaticFallback(data);

  return `
  <div class="sko-block">
    <div class="sko-upcoming-header">
      <h2 class="sko-block-title sko-block-title--flex">Nejbližší zápasy</h2>
      <div class="sko-week-nav">
        <button type="button" id="sko-prev-week" aria-label="Předchozí týden">‹</button>
        <span id="sko-week-label" class="sko-week-label"></span>
        <button type="button" id="sko-next-week" aria-label="Další týden">›</button>
      </div>
    </div>
    <div class="sko-list" id="sko-week-list"></div>
    <noscript>
      <div class="sko-list">
        ${staticRows}
      </div>
    </noscript>
  </div>
  <script type="application/json" id="sko-week-data">${json}</script>
  <script>
  (function () {
    var dataEl = document.getElementById('sko-week-data');
    var listEl = document.getElementById('sko-week-list');
    var labelEl = document.getElementById('sko-week-label');
    var prevBtn = document.getElementById('sko-prev-week');
    var nextBtn = document.getElementById('sko-next-week');
    if (!dataEl || !listEl) return;

    var DATA = JSON.parse(dataEl.textContent);
    var offset = 0;
    var DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

    function pad(n) { return String(n).padStart(2, '0'); }
    function fmtDate(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.'; }
    function fmtDateTime(d) {
      return DAY_NAMES[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function teamSpan(name) {
      var isUs = name.indexOf('Obřany') === 0;
      return '<span class="' + (isUs ? 'sko-team-us' : '') + '">' + esc(name) + '</span>';
    }
    function mondayOf(date) {
      var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      var day = d.getDay();
      var diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d;
    }

    function weekBounds() {
      var start = mondayOf(new Date());
      start.setDate(start.getDate() + offset * 7);
      var end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start: start, end: end };
    }

    function render() {
      var b = weekBounds();
      var endInclusive = new Date(b.end.getTime() - 1);
      labelEl.textContent = (offset === 0 ? 'Aktuální týden ' : '') + fmtDate(b.start) + ' – ' + fmtDate(endInclusive);

      var rows = [];
      DATA.forEach(function (cat) {
        if (cat.error) {
          rows.push('<div class="sko-row"><span class="sko-cat">' + esc(cat.name) + '</span><span class="sko-empty">data se nepodařilo načíst</span></div>');
          return;
        }
        var matches = cat.matches.filter(function (m) {
          var d = new Date(m.date);
          return d >= b.start && d < b.end;
        });
        if (!matches.length) {
          rows.push('<div class="sko-row"><span class="sko-cat">' + esc(cat.name) + '</span><span class="sko-empty">v tomto týdnu se nehraje</span></div>');
        } else {
          matches.forEach(function (m) {
            var d = new Date(m.date);
            var line = m.score
              ? teamSpan(m.home) + ' <span class="sko-score">' + esc(m.score) + '</span> ' + teamSpan(m.away)
              : teamSpan(m.home) + ' <span class="sko-vs">–</span> ' + teamSpan(m.away);
            rows.push(
              '<div class="sko-row"><span class="sko-cat">' + esc(cat.name) + '</span>' +
              '<span class="sko-match-line">' + line + '</span>' +
              '<span class="sko-date">' + fmtDateTime(d) + '</span></div>'
            );
          });
        }
      });
      listEl.innerHTML = rows.join('');
    }

    prevBtn.addEventListener('click', function () { offset -= 1; render(); });
    nextBtn.addEventListener('click', function () { offset += 1; render(); });

    render();
  })();
  </script>`;
}

export function renderPage(data) {
  const updated = formatCzechDate(new Date(data.generatedAt));

  return `<!-- wp:html -->
<style>
.sko-zapasy-wrap { --sko-green:#1c6b32; --sko-bg:#f6f8f6; --sko-border:#dfe6df; font-family:inherit; }
.sko-zapasy-updated { font-size:0.85em; color:#6b7a6f; margin:0 0 1.4em; }
.sko-block { margin-bottom: 2em; }
.sko-block-title { font-size:1.3em; color:var(--sko-green); margin:0; }
.sko-upcoming-header { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:8px; border-bottom:2px solid var(--sko-green); padding-bottom:8px; margin:0 0 4px; }
.sko-week-nav { display:flex; align-items:center; gap:10px; }
.sko-week-nav button { background:var(--sko-green); color:#fff; border:none; border-radius:6px; width:2em; height:2em; font-size:1.1em; line-height:1; cursor:pointer; }
.sko-week-nav button:hover { opacity:0.85; }
.sko-week-label { font-size:0.9em; color:#3d4a3f; min-width:13em; text-align:center; }
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
  ${renderWidget(data)}
</div>
<!-- /wp:html -->`;
}
