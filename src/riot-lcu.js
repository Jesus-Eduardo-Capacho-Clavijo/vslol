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

// Ruta estándar fija del lockfile de League of Legends (sin escanear otras carpetas ni procesos)
const STANDARD_LOCKFILE_PATH = 'C:\\Riot Games\\League of Legends\\lockfile';

export class RiotLcu {
  constructor() {
    this.port = null;
    this.token = null;
    this.protocol = 'https';
    this.isConnected = false;
    this.summoner = null;
  }

  /**
   * REQUISITO DE SEGURIDAD B:
   * CERO escaneo de procesos del sistema. Cero llamadas a tasklist, GetProcesses o Win32_Process.
   * Solo lee el archivo lockfile en la ruta oficial estándar si existe.
   */
  detectCredentials() {
    try {
      if (fs.existsSync(STANDARD_LOCKFILE_PATH)) {
        const content = fs.readFileSync(STANDARD_LOCKFILE_PATH, 'utf-8');
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
    } catch {
      // Ignorar si el juego no está abierto o el archivo está bloqueado
    }

    this.port = null;
    this.token = null;
    this.isConnected = false;
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
            // Si el token expiró por cambio de cuenta (401/403), invalidar para releer lockfile
            if (res.statusCode === 401 || res.statusCode === 403) {
              this.port = null;
              this.token = null;
              this.isConnected = false;
            }
            return resolve(null);
          }

          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => {
        // Si el socket falla (ej. cliente reiniciado en otro puerto), invalidar credenciales
        this.port = null;
        this.token = null;
        this.isConnected = false;
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  async getGameflowPhase() {
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
      } catch {
        // fallback
      }
    }
    const champMap = this.skinCache.get(championId);
    return champMap?.get(skinNum) || defaultChampName;
  }
}

