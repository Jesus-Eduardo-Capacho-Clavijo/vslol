# 🎮 LoL Discord Rich Presence (Estilo Invade.lol)

Aplicación de escritorio en tiempo real para Windows que muestra tu actividad de **League of Legends** en tu perfil de **Discord**, utilizando **únicamente la API oficial de Riot Games** (`Live Client Data API`).

Inspirada en el estilo visual de [invade.lol](https://invade.lol/) y su motor de tarjetas dinámicas con KDA incrustado.

---

## 🔒 Cumplimiento de Principios de Seguridad y Privacidad

Esta aplicación ha sido diseñada y auditada siguiendo estrictamente los 5 principios de seguridad:

### A. Principio de Menor Privilegio (Sin permisos de Administrador)
- **Nunca solicita elevación UAC ni permisos de administrador**: Todas las peticiones se realizan como usuario estándar de Windows.
- La comunicación HTTP con `127.0.0.1:2999` y la conexión IPC con Discord se ejecutan en espacio de usuario sin privilegios elevados.

### B. Detección de Partida Limpia (Sin espiar procesos de la PC)
- **Cero escaneo de procesos**: La aplicación **no** utiliza `tasklist`, `Process.GetProcesses()`, `ps`, ni consultas `Win32_Process`.
- La detección se realiza **exclusivamente mediante sondeo heartbeat periódico** vía `GET https://127.0.0.1:2999/liveclientdata/allgamedata` cada 2 segundos.
- Si la conexión es rechazada (`ECONNREFUSED` / `ETIMEDOUT`), significa que no hay partida activa. Cuando responde `200 OK`, la partida inició.
- **Tu aplicación es completamente ciega al resto de programas, navegadores o chats que tengas abiertos en tu PC.**

### C. Aislamiento de Red (Sin telemetría ni llamadas externas)
- **Cero telemetría**: No se incluyen bibliotecas de métricas, rastreadores ni analíticas de terceros.
- El catálogo de campeones (`champions.json`) y las fuentes del panel están **100% integrados localmente de forma offline**.
- Si monitoreas el tráfico con Wireshark o Fiddler, el único tráfico de red IP generado por la aplicación es **tráfico local de loopback** (`127.0.0.1:2999` con LoL y `127.0.0.1:3456` para tu panel local).

### D. Delimitación Estricta del Sistema de Archivos
- La aplicación **no lee** carpetas personales como `Documents`, `Downloads`, historiales de navegadores o carpetas ajenas.
- Toda la configuración se guarda estrictamente en el archivo local `config.json` dentro del directorio propio de la aplicación.

### E. Manejo Seguro de la Excepción SSL
- **La omisión de verificación SSL NO es global**: Nunca se modifica `NODE_TLS_REJECT_UNAUTHORIZED`.
- El agente SSL con `rejectUnauthorized: false` está confinado a una instancia aislada y protegido para usarse **única y exclusivamente** con el endpoint local `127.0.0.1:2999`.

---

## ⚡ Características

- **Estadísticas al Segundo en Discord**:
  - Campeón actual y rol (Mid, Top, Jungla, Bot, Support).
  - KDA exacto en tiempo real (ej. `7 / 2 / 9`).
  - Súbditos (CS) y ratio KDA.
  - Modo de juego (Grieta del Invocador, ARAM, Arena, URF, etc.).
  - Temporizador de partida transcurrido (`12:34 transcurrido`).
- **Tarjeta de Presencia Estilo Invade.lol**:
  - Dibuja el arte del campeón con tu marcador y rol directamente sobre la imagen en alta definición.
  - Opcional: Arte oficial de Riot Data Dragon (Splash o Tile).
- **Panel de Control con Vista Previa en Vivo**:
  - Interfaz web oscura idéntica a Discord en `http://localhost:3456`.
  - Interruptor de **Modo Simulación** para probar en Discord de inmediato sin tener que entrar a una partida.

---

## 🚀 Inicio Rápido

1. Haz doble clic en el archivo **`run.bat`**.
2. Automáticamente se iniciará la aplicación y se abrirá el panel en tu navegador:
   ```
   http://localhost:3456
   ```
3. ¡Listo! Abre League of Legends y entra a cualquier partida (o activa el "Modo Prueba" en el panel para ver tu perfil de Discord cambiar al instante).
