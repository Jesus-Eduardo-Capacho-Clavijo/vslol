import https from 'https';

/**
 * REQUISITO DE SEGURIDAD E:
 * La omisión de comprobación de certificado SSL autofirmado está ESTRICTAMENTE
 * delimitada a esta instancia aislada de https.Agent y ÚNICAMENTE para 127.0.0.1:2999.
 * La validación SSL global de Node.js permanece intacta y activa en toda la app.
 */
const loopbackRiotAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false,
});

const LIVE_ENDPOINT = 'https://127.0.0.1:2999/liveclientdata/allgamedata';

const GAME_MODE_NAMES = {
  'CLASSIC': 'Grieta del Invocador',
  'ARAM': 'ARAM',
  'CHERRY': 'Arena (2v2v2v2)',
  'URF': 'Ultra Rapid Fire (URF)',
  'PRACTICETOOL': 'Modo Práctica',
  'TUTORIAL': 'Tutorial',
  'NEXUSBLITZ': 'Nexus Blitz',
  'ULTBOOK': 'Libro de Hechizos',
  'SWIFTPLAY': 'Partida Rápida',
  'STRAWBERRY': 'Enjambre',
  'BRAWL': 'Pelea',
};

const POSITION_NAMES = {
  'TOP': 'Top',
  'JUNGLE': 'Jungla',
  'MIDDLE': 'Mid',
  'BOTTOM': 'Bot',
  'UTILITY': 'Support',
};

export class RiotLiveApi {
  constructor() {
    this.endpoint = LIVE_ENDPOINT;
  }

  async fetchLiveGame() {
    return new Promise((resolve) => {
      if (!this.endpoint.startsWith('https://127.0.0.1:2999/')) {
        return resolve({ inGame: false, error: 'Destino no permitido por política de seguridad' });
      }

      const req = https.get(
        this.endpoint,
        {
          agent: loopbackRiotAgent,
          timeout: 1500,
        },
        (res) => {
          if (res.statusCode !== 200) {
            resolve({ inGame: false, reason: `HTTP ${res.statusCode}` });
            res.resume();
            return;
          }

          let rawData = '';
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(rawData);
              const parsed = this.parseAllGameData(data);
              resolve(parsed);
            } catch (err) {
              resolve({ inGame: false, error: err.message });
            }
          });
        }
      );

      req.on('error', () => {
        resolve({ inGame: false });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ inGame: false, timeout: true });
      });
    });
  }

  parseAllGameData(data) {
    if (!data || !data.activePlayer || !data.gameData) {
      return { inGame: false };
    }

    const { activePlayer, allPlayers, gameData } = data;
    const gameTime = Number(gameData.gameTime) || 0;
    const gameModeRaw = gameData.gameMode || 'CLASSIC';
    const gameModeName = GAME_MODE_NAMES[gameModeRaw] || gameModeRaw;

    // Localizar al jugador activo dentro de allPlayers
    let myPlayer = null;
    if (Array.isArray(allPlayers)) {
      myPlayer = allPlayers.find((p) => {
        if (activePlayer.riotId && p.riotId === activePlayer.riotId) return true;
        if (activePlayer.summonerName && p.summonerName === activePlayer.summonerName) return true;
        return false;
      });

      if (!myPlayer && allPlayers.length > 0) {
        myPlayer = allPlayers[0];
      }
    }

    const championName = myPlayer?.championName || activePlayer.championName || 'Desconocido';
    const scores = myPlayer?.scores || { kills: 0, deaths: 0, assists: 0, creepScore: 0 };
    const kills = Number(scores.kills) || 0;
    const deaths = Number(scores.deaths) || 0;
    const assists = Number(scores.assists) || 0;
    const cs = Number(scores.creepScore) || 0;
    const level = Number(activePlayer.level) || Number(myPlayer?.level) || 1;

    // Extracción limpia de la posición (evitando el texto "NONE")
    const rawPos = (myPlayer?.position || '').toUpperCase();
    const cleanPosition = (rawPos && rawPos !== 'NONE') ? rawPos : '';
    const positionName = POSITION_NAMES[cleanPosition] || cleanPosition;

    // Extracción automática de la Skin activa
    let skinNum = 0;
    const rawSkinId = myPlayer?.skinID;
    if (typeof rawSkinId === 'number' && rawSkinId > 0) {
      skinNum = rawSkinId >= 1000 ? (rawSkinId % 1000) : rawSkinId;
    } else if (myPlayer?.rawSkinName) {
      const match = myPlayer.rawSkinName.match(/(\d+)$/);
      if (match) skinNum = parseInt(match[1], 10);
    }

    const kdaRatio = deaths === 0 ? (kills + assists).toFixed(1) : ((kills + assists) / deaths).toFixed(2);
    const minutes = Math.max(0.1, gameTime / 60);
    const csPerMin = (cs / minutes).toFixed(1);

    const gameStartTime = Date.now() - Math.floor(gameTime * 1000);

    return {
      inGame: true,
      championName,
      rawChampionName: myPlayer?.rawChampionName || championName,
      skinId: rawSkinId || 0,
      skinNum,
      kills,
      deaths,
      assists,
      kdaRatio,
      cs,
      csPerMin,
      level,
      position: cleanPosition.toLowerCase(),
      positionName,
      gameMode: gameModeRaw,
      gameModeName,
      gameTime,
      gameStartTime,
      isDead: Boolean(myPlayer?.isDead),
      respawnTimer: Math.ceil(Number(myPlayer?.respawnTimer) || 0),
      summonerName: activePlayer.riotId || activePlayer.summonerName || 'Invocador',
    };
  }
}
