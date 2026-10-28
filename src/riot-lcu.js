import fs from 'fs';
import https from 'https';

/**
 * REQUISITO DE SEGURIDAD E:
 * Agente SSL aislado exclusivamente para llamadas a localhost loopback.
 */
const loopbackLcuAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false,
});

// Rutas estándar fijas del lockfile de League of Legends en unidades de disco frecuentes (sin escanear procesos)
const CANDIDATE_LOCKFILE_PATHS = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  'E:\\Riot Games\\League of Legends\\lockfile',
];

export class RiotLcu {
  constructor() {
    this.port = null;
    this.token = null;
    this.protocol = 'https';
    this.isConnected = false;
    this.summoner = null;
    this.skinCache = new Map();
  }

  /**
   * Destrucción inmediata y volátil de credenciales y datos de sesión en memoria
   */
  clearCredentials() {
    this.port = null;
    this.token = null;
    this.protocol = 'https';
    this.isConnected = false;
    this.summoner = null;
    if (this.skinCache) {
      this.skinCache.clear();
    }
  }

  /**
   * REQUISITO DE SEGURIDAD B:
   * CERO escaneo de procesos del sistema. Cero llamadas a tasklist, GetProcesses o Win32_Process.
   * Solo lee el archivo lockfile en rutas oficiales estándar si existe.
   */
  detectCredentials() {
    try {
      for (const lockfilePath of CANDIDATE_LOCKFILE_PATHS) {
        if (fs.existsSync(lockfilePath)) {
          const content = fs.readFileSync(lockfilePath, 'utf-8');
          const parts = content.split(':');
          // Formato: ProcessName:PID:Port:Password:Protocol
          if (parts.length >= 5) {
            const newPort = parts[2];
            const newToken = parts[3];
            const newProtocol = parts[4] || 'https';
            if (newPort !== this.port || newToken !== this.token) {
              this.port = newPort;
              this.token = newToken;
              this.protocol = newProtocol;
              this.summoner = null;
              if (this.skinCache) this.skinCache.clear();
            }
            this.isConnected = true;
            return true;
          }
        }
      }
    } catch (err) {
      // Ignorar exclusivamente errores esperados de I/O (bloqueo transitorio por escritura de Riot Client)
      if (err.code !== 'EBUSY' && err.code !== 'EPERM' && err.code !== 'ENOENT') {
        console.error('[RiotLcu] Error inesperado al leer lockfile:', err);
      }
    }

    this.clearCredentials();
    return false;
  }

  async request(endpoint) {
    if (!this.isConnected || !this.port || !this.token) {
      const detected = this.detectCredentials();
      if (!detected) return null;
    }

    const auth = Buffer.from(`riot:${this.token}`).toString('base64');
    const url = `https://127.0.0.1:${this.port}${endpoint}`;

    return new Promise((resolve) => {
      const req = https.get(
        url,
        {
          agent: loopbackLcuAgent,
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
          timeout: 1000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            // Si el token expiró por cambio de cuenta (401/403), invalidar inmediatamente
            if (res.statusCode === 401 || res.statusCode === 403) {
              this.clearCredentials();
            }
            return resolve(null);
          }

          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              if (err instanceof SyntaxError) {
                resolve(null);
              } else {
                console.error('[RiotLcu] Error inesperado parseando respuesta:', err);
                resolve(null);
              }
            }
          });
        }
      );

      req.on('error', (err) => {
        // Si el socket falla (ej. cliente cerrado o reiniciado en otro puerto), destruir credenciales
        if (err.code !== 'ECONNREFUSED' && err.code !== 'ECONNRESET') {
          console.debug?.('[RiotLcu] Socket error:', err.code || err.message);
        }
        this.clearCredentials();
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        this.clearCredentials();
        resolve(null);
      });
    });
  }

  async getGameflowPhase() {
    this.detectCredentials();
    return await this.request('/lol-gameflow/v1/gameflow-phase');
  }

  async getCurrentSummoner() {
    const data = await this.request('/lol-summoner/v1/current-summoner');
    if (data) {
      this.summoner = data;
    }
    return data;
  }

  async getRankedStats() {
    return await this.request('/lol-ranked/v1/current-ranked-stats');
  }

  async getSkinName(championId, skinNum, defaultChampName) {
    if (!skinNum || skinNum === 0) return defaultChampName;
    if (!this.skinCache) {
      this.skinCache = new Map();
    }
    if (!this.skinCache.has(championId)) {
      try {
        const data = await this.request(`/lol-game-data/assets/v1/champions/${championId}.json`);
        if (data && Array.isArray(data.skins)) {
          const map = new Map();
          for (const s of data.skins) {
            const num = s.id >= 1000 ? (s.id % 1000) : s.id;
            const name = (s.name && s.name.toLowerCase() !== 'default') ? s.name : defaultChampName;
            map.set(num, name);
          }
          this.skinCache.set(championId, map);
        }
      } catch (err) {
        console.warn(`[RiotLcu] Error obteniendo skins para campeón ${championId}:`, err?.message || err);
      }
    }
    const champMap = this.skinCache.get(championId);
    return champMap?.get(skinNum) || defaultChampName;
  }

  async getGameflowSession() {
    return await this.request('/lol-gameflow/v1/session');
  }

  async getLobby() {
    return await this.request('/lol-lobby/v2/lobby');
  }

  async getCurrentGameModeInfo() {
    try {
      // 1. Prioridad: Sesión activa de partida / champ select / matchmaking / lobby
      const session = await this.getGameflowSession();
      if (session?.gameData) {
        const qId = session.gameData.queue?.id;
        const isCustom = Boolean(session.gameData.isCustom);
        const mode = session.gameData.queue?.gameMode || session.gameData.gameMode;
        if (qId !== undefined || mode) {
          return { queueId: qId, gameMode: mode, isCustom };
        }
      }
    } catch {}

    try {
      // 2. Si no hay sesión o sólo está en sala (Lobby)
      const lobby = await this.getLobby();
      if (lobby?.gameConfig) {
        const qId = lobby.gameConfig.queueId;
        const isCustom = Boolean(lobby.gameConfig.isCustom);
        const mode = lobby.gameConfig.gameMode;
        if (qId !== undefined || mode) {
          return { queueId: qId, gameMode: mode, isCustom };
        }
      }
    } catch {}

    return null;
  }
}

