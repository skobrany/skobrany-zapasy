// Družstva SK Obřany dle IS FAČR (Klub > Družstva a utkání > Družstva klubu), ročník 2026.
// competitionCode musí odpovídat prefixu "Číslo soutěže" ve výpisu utkání (např. 2026622A1A).
// teamName musí přesně odpovídat názvu týmu ve sloupci Domácí/Hosté (např. "Obřany A").
// Pořadí: od nejstarší kategorie (muži) po nejmladší (přípravky).
export const TEAMS = [
  { competitionCode: '2026622A1A', teamName: 'Obřany', name: 'Muži A' },
  { competitionCode: '2026622C1A', teamName: 'Obřany', name: 'Dorost' },
  { competitionCode: '2026621E1A', teamName: 'Obřany', name: 'Starší žáci' },
  { competitionCode: '2026623E1B', teamName: 'Obřany', name: 'Starší žáci sk. B' },
  { competitionCode: '2026621F1A', teamName: 'Obřany', name: 'Mladší žáci sk. A' },
  { competitionCode: '2026623F1B', teamName: 'Obřany', name: 'Mladší žáci sk. B' },
  { competitionCode: '2026622G1B', teamName: 'Obřany A', name: 'Starší přípravka sk. B' },
  { competitionCode: '2026622G1D', teamName: 'Obřany B', name: 'Starší přípravka sk. D' },
  { competitionCode: '2026622H1A', teamName: 'Obřany A', name: 'Mladší přípravka sk. A' },
  { competitionCode: '2026622H1A', teamName: 'Obřany B', name: 'Mladší přípravka sk. A' },
  { competitionCode: '2026622H1C', teamName: 'Obřany C', name: 'Mladší přípravka sk. C' },
];

export const CLUB_ID = '6220521';
