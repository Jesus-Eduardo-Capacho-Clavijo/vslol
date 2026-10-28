import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

const DEFAULT_CONFIG = {
  discordClientId: '1194034071588851783', // ID oficial registrado como "League of Legends"
  imageStyle: 'ddragon-splash', // 'ddragon-splash' (Splash Art oficial de la Skin activa) | 'invade' | 'ddragon-tile'
  showCs: true,
  showLevel: true,
  showButtons: true,
  pollingIntervalMs: 2000,
  webPort: 3456,
  simulationMode: false,
};

let currentConfig = { ...DEFAULT_CONFIG };

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      currentConfig = { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    console.error('[Config] Error al cargar config.json, usando valores predeterminados:', err.message);
  }
  return currentConfig;
}

export function saveConfig(newConfig) {
  try {
    currentConfig = { ...currentConfig, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');
    return currentConfig;
  } catch (err) {
    console.error('[Config] Error al guardar config.json:', err.message);
    throw err;
  }
}

export function getConfig() {
  return currentConfig;
}

// Cargar al inicializar
loadConfig();
