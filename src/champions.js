import championsData from './champions.json' with { type: 'json' };

// Alias para nombres comunes, compuestos o traducciones al español
const CHAMPION_ALIASES = {
  'wukong': 'MonkeyKing',
  'monkeyking': 'MonkeyKing',
  'renataglasc': 'Renata',
  'renata': 'Renata',
  'nunu': 'Nunu',
  'nunuwillump': 'Nunu',
  'nunoywillump': 'Nunu',
  'bardo': 'Bard',
  'bard': 'Bard',
  'maestroyi': 'MasterYi',
  'masteryi': 'MasterYi',
};

// Normalizar nombres que la Live API a veces envía con prefijo o formato especial
export function normalizeChampionKey(raw) {
  if (!raw) return 'Ahri';
  // Algunos endpoints envían "game_character_displayname_Ahri"
  let clean = raw.replace(/^game_character_displayname_/i, '');
  // Quitar espacios y caracteres especiales
  clean = clean.replace(/[^a-zA-Z0-9]/g, '');

  const lower = clean.toLowerCase();

  // 1. Comprobar alias conocidos directamente
  if (CHAMPION_ALIASES[lower]) {
    return CHAMPION_ALIASES[lower];
  }

  // 2. Buscar coincidencia en keys de championsData
  for (const k of Object.keys(championsData)) {
    if (k.toLowerCase() === lower) return k;
  }

  // 3. Buscar coincidencia en el nombre mostrado (name) en championsData
  for (const [k, champ] of Object.entries(championsData)) {
    if (champ && champ.name) {
      const cleanName = champ.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanName === lower) return k;
    }
  }

  return clean;
}

export function getChampionInfo(rawName) {
  const key = normalizeChampionKey(rawName);
  const found = championsData[key];
  if (found) return found;

  return {
    id: 103, // Ahri por defecto si es desconocido
    key: key || 'Ahri',
    name: rawName || 'Campeón'
  };
}

export function getPatchVersion() {
  return '14.20.1';
}
