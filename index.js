import { DiscordIPC } from './src/discord-ipc.js';
import { RiotLiveApi } from './src/riot-live-api.js';
import { RiotLcu } from './src/riot-lcu.js';
import { buildInGamePresence, buildLcuPresence, formatRankedTier } from './src/presence-builder.js';
import { getChampionInfo } from './src/champions.js';
import { getConfig } from './src/config.js';

const config = getConfig();
const discordIpc = new DiscordIPC(config.discordClientId);
const riotLiveApi = new RiotLiveApi();
const riotLcu = new RiotLcu();

let lastPresenceJson = '';
let lastPhase = '';
let clientLogged = false;
let gameLogged = false;
let cachedRankText = '';
let lastRankFetchTime = 0;
let lastSentTime = 0;
const DISCORD_THROTTLE_MS = 15000; // 15s para respetar el límite oficial de Discord RPC

async function getOrUpdateRank() {
  const now = Date.now();
  if (!cachedRankText || (now - lastRankFetchTime > 60000)) {
    try {
      const rankedData = await riotLcu.getRankedStats();
      if (rankedData) {
        cachedRankText = formatRankedTier(rankedData);
        lastRankFetchTime = now;
      }
    } catch {
      // Ignorar errores menores
    }
  }
  return cachedRankText;
}

console.log('=======================================================');
console.log('  League of Legends • Discord Rich Presence en Vivo    ');
console.log('  Rendimiento ultra-rápido (1s) • Sin interfaz web     ');
console.log('=======================================================');

// Conectar con Discord IPC
discordIpc.on('connected', () => {
  console.log('[Discord] Conectado exitosamente al pipe de Discord.');
});

discordIpc.on('disconnected', () => {
  console.warn('[Discord] Desconectado de Discord. Reintentando...');
});

discordIpc.connect();

// Función de actualización instantánea
async function updatePresence() {
  try {
    const now = Date.now();

    // 1. Prioridad: Partida en curso (Live Client Data API en 127.0.0.1:2999)
    const liveData = await riotLiveApi.fetchLiveGame();

    if (liveData && liveData.inGame) {
      const isFirstGameDetection = !gameLogged;
      if (isFirstGameDetection) {
        console.log(`[LoL Partida] ¡Partida detectada! Campeón: ${liveData.championName} • Modo: ${liveData.gameModeName}`);
        gameLogged = true;
        clientLogged = false;
      }

      const rankText = await getOrUpdateRank();
      const champ = getChampionInfo(liveData.championName);
      const skinName = await riotLcu.getSkinName(champ.id, liveData.skinNum, champ.name);
      const presence = buildInGamePresence(liveData, config, rankText, skinName);
      const json = JSON.stringify(presence);

      // Despachar a Discord si la información cambió y:
      // a) Es la primera detección de partida (despacho inmediato), o
      // b) Han transcurrido al menos 15 segundos desde el último envío
      const shouldSend = json !== lastPresenceJson && (isFirstGameDetection || (now - lastSentTime >= DISCORD_THROTTLE_MS));

      if (shouldSend) {
        discordIpc.setActivity(presence);
        lastPresenceJson = json;
        lastSentTime = now;
        console.log(`[Discord Update] ${presence.details} | ${presence.state}`);
      }
      return;
    }

    const wasInGame = gameLogged;
    gameLogged = false;

    // 2. Si no hay partida activa: Verificar Cliente de LoL (LCU)
    // El cliente se reconoce apenas se abre en la PC (incluso si phase es "None")
    const phase = await riotLcu.getGameflowPhase();

    if (phase !== null) {
      const summoner = await riotLcu.getCurrentSummoner();

      if (!clientLogged && summoner) {
        const rankText = await getOrUpdateRank();
        const rankDisplay = rankText ? ` (${rankText})` : '';
        console.log(`[LoL Cliente] Invocador: ${summoner.gameName}#${summoner.tagLine} (Nivel ${summoner.summonerLevel})${rankDisplay}`);
        clientLogged = true;
      }

      const rankText = await getOrUpdateRank();
      const presence = buildLcuPresence(phase, summoner, config, rankText);
      const json = JSON.stringify(presence);

      const isPhaseChange = phase !== lastPhase;
      const shouldSend = json !== lastPresenceJson && (wasInGame || isPhaseChange || (now - lastSentTime >= DISCORD_THROTTLE_MS));

      if (shouldSend) {
        discordIpc.setActivity(presence);
        lastPresenceJson = json;
        lastSentTime = now;
        if (isPhaseChange || wasInGame) {
          console.log(`[Discord Update] ${presence.details} | ${presence.state}`);
          lastPhase = phase;
        }
      }
      return;
    }

    // 3. Ni partida ni cliente abierto: Limpiar actividad de Discord
    if (clientLogged || lastPresenceJson) {
      console.log('[LoL] Cliente cerrado. Limpiando presencia de Discord...');
      discordIpc.clearActivity();
      lastPresenceJson = '';
      lastPhase = '';
      clientLogged = false;
      lastSentTime = 0;
    }
  } catch (err) {
    // Errores menores de socket no detienen el ciclo
  }
}

// Sondeo rápido cada 1000 ms (1 segundo) para actualización instantánea
setInterval(updatePresence, 1000);
updatePresence();

// Cierre limpio
process.on('SIGINT', () => {
  console.log('\nCerrando aplicación y desconectando de Discord...');
  discordIpc.clearActivity();
  discordIpc.disconnect();
  process.exit(0);
});
