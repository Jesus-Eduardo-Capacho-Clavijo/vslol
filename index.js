import { DiscordIPC } from './src/discord-ipc.js';
import { RiotLiveApi } from './src/riot-live-api.js';
import { RiotLcu } from './src/riot-lcu.js';
import { buildInGamePresence, buildLcuPresence, formatRankedTier, resolveGameModeName } from './src/presence-builder.js';
import { getChampionInfo } from './src/champions.js';
import { getConfig } from './src/config.js';
import { handleInstallerAndSingleInstance } from './src/installer.js';

const config = getConfig();
const discordIpc = new DiscordIPC(config.discordClientId);
const riotLiveApi = new RiotLiveApi();
const riotLcu = new RiotLcu();

let lastPresenceJson = '';
let lastPhase = '';
let clientLogged = false;
let gameLogged = false;
let cachedRankText = '';
let cachedInGameMode = '';
let lastRankFetchTime = 0;
let lastSentTime = 0;
let lastSummonerPuuid = '';
let lastInGameKda = '';
let lastInGameDead = false;
const DISCORD_THROTTLE_MS = 15000; // 15s para respetar el límite oficial de Discord RPC

async function getOrUpdateRank(force = false) {
  const now = Date.now();
  if (force || !cachedRankText || (now - lastRankFetchTime > 60000)) {
    try {
      const rankedData = await riotLcu.getRankedStats();
      if (rankedData) {
        cachedRankText = formatRankedTier(rankedData);
        lastRankFetchTime = now;
      }
    } catch (err) {
      console.warn('[Rank] Aviso al consultar estadísticas clasificatorias:', err?.message || err);
    }
  }
  return cachedRankText;
}

console.log('=======================================================');
console.log('  League of Legends • Discord Rich Presence en Vivo    ');
console.log('  Rendimiento ultra-rápido (1s) • Sin interfaz web     ');
console.log('=======================================================');

// Configurar eventos de Discord IPC
discordIpc.on('connected', () => {
  console.log('[Discord] Conectado exitosamente al pipe de Discord.');
});

discordIpc.on('disconnected', () => {
  console.warn('[Discord] Desconectado de Discord. Reintentando...');
});

// Función de actualización instantánea
async function updatePresence() {
  try {
    const now = Date.now();

    // 1. Prioridad: Partida en curso (Live Client Data API en 127.0.0.1:2999)
    const liveData = await riotLiveApi.fetchLiveGame();

    if (liveData && liveData.inGame) {
      // Determinar modo de juego preciso (LCU queueId o Live API gameMode)
      if (!cachedInGameMode) {
        const modeInfo = await riotLcu.getCurrentGameModeInfo();
        const queueId = modeInfo?.queueId;
        const isCustom = modeInfo?.isCustom || false;
        const rawMode = modeInfo?.gameMode || liveData.gameMode;
        cachedInGameMode = resolveGameModeName(queueId, rawMode, isCustom);
      }
      const gameModeName = cachedInGameMode;

      const isFirstGameDetection = !gameLogged;
      if (isFirstGameDetection) {
        console.log(`[LoL Partida] ¡Partida detectada! Campeón: ${liveData.championName} • Modo: ${gameModeName}`);
        gameLogged = true;
        clientLogged = false;
      }

      const rankText = await getOrUpdateRank();
      const champ = getChampionInfo(liveData.championName);
      const skinName = await riotLcu.getSkinName(champ.id, liveData.skinNum, champ.name);
      const presence = buildInGamePresence(liveData, config, rankText, skinName, gameModeName);
      const json = JSON.stringify(presence);

      // Detección de KDA en tiempo real y cambio de estado de muerte
      const currentKda = `${liveData.kills}/${liveData.deaths}/${liveData.assists}`;
      const isKdaChanged = currentKda !== lastInGameKda;
      const isDeadChanged = Boolean(liveData.isDead) !== lastInGameDead;
      const isUrgent = isFirstGameDetection || isKdaChanged || isDeadChanged;

      // Despacho a Discord:
      // a) Prioridad absoluta en tiempo real a cambios de KDA, muerte/respawn, o inicio de partida
      // b) Actualizaciones por decenas de CS (10, 20, 30...) tras el intervalo de seguridad de Discord
      const shouldSend = json !== lastPresenceJson && (isUrgent || (now - lastSentTime >= DISCORD_THROTTLE_MS));

      if (shouldSend) {
        discordIpc.setActivity(presence);
        lastPresenceJson = json;
        lastSentTime = now;
        lastInGameKda = currentKda;
        lastInGameDead = Boolean(liveData.isDead);
        console.log(`[Discord Update] ${presence.details} | ${presence.state}`);
      }
      return;
    }

    const wasInGame = gameLogged;
    gameLogged = false;
    lastInGameKda = '';
    lastInGameDead = false;
    cachedInGameMode = '';

    // 2. Si no hay partida activa: Verificar Cliente de LoL (LCU)
    // El cliente se reconoce apenas se abre en la PC (incluso si phase es "None")
    const phase = await riotLcu.getGameflowPhase();

    if (phase !== null) {
      const summoner = await riotLcu.getCurrentSummoner();

      // Si el cliente apenas está abriendo o cambiando de sesión, esperar a que cargue el perfil
      if (!summoner || (!summoner.gameName && !summoner.displayName)) {
        return;
      }

      // Detectar cambio de cuenta o primer inicio del cliente
      const isNewAccount = summoner.puuid && summoner.puuid !== lastSummonerPuuid;
      if (isNewAccount) {
        lastSummonerPuuid = summoner.puuid;
        cachedRankText = ''; // Limpiar caché de rango de la cuenta anterior
        lastRankFetchTime = 0;
        lastPresenceJson = ''; // Forzar actualización inmediata en Discord

        const rankText = await getOrUpdateRank(true);
        const rankDisplay = rankText ? ` (${rankText})` : '';
        const nameDisplay = summoner.gameName ? `${summoner.gameName}#${summoner.tagLine}` : summoner.displayName;
        console.log(`[LoL Cliente] Invocador detectado: ${nameDisplay} (Nivel ${summoner.summonerLevel})${rankDisplay}`);
        clientLogged = true;
      }

      // Detectar modo de juego en sala/búsqueda/selección de campeón
      let clientModeName = '';
      if (['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'].includes(phase)) {
        const modeInfo = await riotLcu.getCurrentGameModeInfo();
        if (modeInfo) {
          clientModeName = resolveGameModeName(modeInfo.queueId, modeInfo.gameMode, modeInfo.isCustom);
        }
      }

      const rankText = await getOrUpdateRank();
      const presence = buildLcuPresence(phase, summoner, config, rankText, clientModeName);
      const json = JSON.stringify(presence);

      const isPhaseChange = phase !== lastPhase;
      const shouldSend = json !== lastPresenceJson && (wasInGame || isPhaseChange || isNewAccount || (now - lastSentTime >= DISCORD_THROTTLE_MS));

      if (shouldSend) {
        discordIpc.setActivity(presence);
        lastPresenceJson = json;
        lastSentTime = now;
        if (isPhaseChange || wasInGame || isNewAccount) {
          console.log(`[Discord Update] ${presence.details} | ${presence.state}`);
          lastPhase = phase;
        }
      }
      return;
    }

    // 3. Ni partida ni cliente abierto: Limpiar actividad de Discord y destruir credenciales LCU
    if (clientLogged || lastPresenceJson || riotLcu.isConnected) {
      if (clientLogged || lastPresenceJson) {
        console.log('[LoL] Cliente cerrado. Limpiando presencia de Discord...');
        discordIpc.clearActivity();
      }
      riotLcu.clearCredentials();
      lastPresenceJson = '';
      lastPhase = '';
      clientLogged = false;
      lastSummonerPuuid = '';
      cachedRankText = '';
      cachedInGameMode = '';
      lastRankFetchTime = 0;
      lastSentTime = 0;
    }
  } catch (err) {
    // Si ocurre un error inesperado, registrarlo para diagnóstico
    console.error('[Error loop]', err?.message || err);
  }
}

// Inicio del programa con verificación de auto-instalación y bloqueo de instancia única
async function start() {
  await handleInstallerAndSingleInstance();
  discordIpc.connect();
  setInterval(updatePresence, 1000);
  updatePresence();
}

start().catch((err) => {
  console.error('[Startup Error]', err);
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.env.LOCALAPPDATA || '.', 'vslol-installer.log');
    fs.appendFileSync(logPath, `[Startup Error] ${err?.message}\n${err?.stack}\n`);
  } catch {}
});

process.on('uncaughtException', (err) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.env.LOCALAPPDATA || '.', 'vslol-installer.log');
    fs.appendFileSync(logPath, `[UncaughtException] ${err?.message}\n${err?.stack}\n`);
  } catch {}
});

// Cierre limpio (Graceful Shutdown) capturando SIGINT y SIGTERM
function handleGracefulShutdown(signal) {
  console.log(`\n[Shutdown] Señal ${signal} recibida. Cerrando aplicación, limpiando presencia y destruyendo credenciales...`);
  try {
    discordIpc.clearActivity();
    discordIpc.disconnect();
    riotLcu.clearCredentials();
  } catch (err) {
    console.error('[Shutdown] Error durante la desconexión:', err?.message || err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
