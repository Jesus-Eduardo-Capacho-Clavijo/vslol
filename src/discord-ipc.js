import net from 'net';
import EventEmitter from 'events';

const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

export class DiscordIPC extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.lastActivity = null;
    this.buffer = Buffer.alloc(0);
  }

  setClientId(clientId) {
    if (this.clientId !== clientId) {
      this.clientId = clientId;
      if (this.isConnected) {
        console.log(`[DiscordIPC] Cambiando Client ID a ${clientId}...`);
        this.disconnect();
        this.connect();
      }
    }
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    // Buscar pipes disponibles de discord-ipc-0 a discord-ipc-9
    const tryPipe = (index) => {
      if (index > 9) {
        this.isConnecting = false;
        this.scheduleReconnect();
        return;
      }

      const pipePath = `\\\\.\\pipe\\discord-ipc-${index}`;
      const socket = net.createConnection(pipePath);

      socket.once('connect', () => {
        socket.removeAllListeners('error');
        this.socket = socket;
        this.isConnected = true;
        this.isConnecting = false;
        this.buffer = Buffer.alloc(0);
        console.log(`[DiscordIPC] Conectado exitosamente a ${pipePath}`);

        this.setupSocketHandlers();
        this.sendHandshake();
        this.emit('connected');

        // Si había una actividad previa guardada, reestablecerla
        if (this.lastActivity) {
          this.setActivity(this.lastActivity);
        }
      });

      socket.once('error', () => {
        socket.destroy();
        tryPipe(index + 1);
      });
    };

    tryPipe(0);
  }

  setupSocketHandlers() {
    this.socket.on('data', (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.processIncoming();
    });

    this.socket.on('close', () => {
      const wasConnected = this.isConnected;
      this.isConnected = false;
      this.isConnecting = false;
      this.socket = null;
      if (wasConnected) {
        console.warn('[DiscordIPC] Desconectado de Discord.');
        this.emit('disconnected');
      }
      this.scheduleReconnect();
    });

    this.socket.on('error', (err) => {
      // Los errores normales de pipe se manejan en 'close'
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
    });
  }

  processIncoming() {
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readInt32LE(0);
      const length = this.buffer.readInt32LE(4);

      if (this.buffer.length < 8 + length) {
        // Paquete incompleto, esperar más bytes
        break;
      }

      const payloadBuf = this.buffer.subarray(8, 8 + length);
      this.buffer = this.buffer.subarray(8 + length);

      try {
        const payload = JSON.parse(payloadBuf.toString('utf-8'));
        this.handleMessage(opcode, payload);
      } catch (err) {
        console.error('[DiscordIPC] Error al decodificar mensaje de Discord:', err.message);
      }
    }
  }

  handleMessage(opcode, payload) {
    if (opcode === OPCODES.FRAME) {
      if (payload.cmd === 'DISPATCH' && payload.evt === 'READY') {
        console.log(`[DiscordIPC] Discord listo. Usuario: ${payload.data?.user?.username || 'desconocido'}`);
      }
    } else if (opcode === OPCODES.PING) {
      this.send(OPCODES.PONG, payload);
    }
  }

  sendHandshake() {
    this.send(OPCODES.HANDSHAKE, {
      v: 1,
      client_id: this.clientId,
    });
  }

  send(opcode, data) {
    if (!this.socket || !this.isConnected) return;
    try {
      const json = JSON.stringify(data);
      const payload = Buffer.from(json, 'utf-8');
      const packet = Buffer.alloc(8 + payload.length);
      packet.writeInt32LE(opcode, 0);
      packet.writeInt32LE(payload.length, 4);
      payload.copy(packet, 8);
      this.socket.write(packet, (err) => {
        if (err) {
          // Socket write error manejado de forma segura
        }
      });
    } catch (err) {
      console.error('[DiscordIPC] Error al enviar paquete:', err.message);
    }
  }

  setActivity(activity) {
    this.lastActivity = activity;
    if (!this.isConnected) return;

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: activity || null,
      },
      nonce: Math.random().toString(36).substring(2),
    };

    this.send(OPCODES.FRAME, payload);
    this.emit('activity_set', activity);
  }

  clearActivity() {
    this.lastActivity = null;
    this.setActivity(null);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}
