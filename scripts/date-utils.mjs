// Parsování data ve formátu "Sobota 15. 8. 2026 10:00" (čas je v pražském čase)
// a bezpečný převod na UTC bez závislosti na timezone běžícího stroje (GitHub Actions běží v UTC).

function lastSundayOfMonthUTC(year, month1based) {
  const d = new Date(Date.UTC(year, month1based, 0)); // poslední den daného měsíce
  const day = d.getUTCDay(); // 0 = neděle
  d.setUTCDate(d.getUTCDate() - day);
  return d.getUTCDate();
}

// Vrací offset Praha vs. UTC (1 = CET, 2 = CEST) pro daný okamžik (hrubý odhad dle EU pravidla DST).
function pragueOffsetHours(year, month0based, day, hour) {
  const marchLastSun = lastSundayOfMonthUTC(year, 3);
  const octLastSun = lastSundayOfMonthUTC(year, 10);
  const instant = Date.UTC(year, month0based, day, hour);
  const dstStart = Date.UTC(year, 2, marchLastSun, 1); // poslední neděle v březnu, 01:00 UTC
  const dstEnd = Date.UTC(year, 9, octLastSun, 1); // poslední neděle v říjnu, 01:00 UTC
  return instant >= dstStart && instant < dstEnd ? 2 : 1;
}

export function parseCzechDateTime(text) {
  if (!text) return null;
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, dStr, moStr, yStr, hStr, miStr] = m;
  const d = Number(dStr), mo = Number(moStr), y = Number(yStr), h = Number(hStr), mi = Number(miStr);
  const offset = pragueOffsetHours(y, mo - 1, d, h);
  return new Date(Date.UTC(y, mo - 1, d, h - offset, mi));
}

export function formatCzechDate(date) {
  if (!date) return '';
  if (!(date instanceof Date)) date = new Date(date);
  const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  // Zpět převod z UTC na pražský čas jen pro zobrazení (přibližně, +1/+2h dle sezóny odhadnuté z UTC měsíce)
  const month0 = date.getUTCMonth();
  const isSummer = month0 >= 2 && month0 <= 9; // hrubý odhad duben-říjen jako CEST, dostatečné pro zobrazení
  const offset = isSummer ? 2 : 1;
  const local = new Date(date.getTime() + offset * 3600 * 1000);
  const dayName = days[local.getUTCDay()];
  const dd = String(local.getUTCDate()).padStart(2, '0');
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  return `${dayName} ${dd}. ${mm}. ${local.getUTCFullYear()} ${hh}:${min}`;
}
