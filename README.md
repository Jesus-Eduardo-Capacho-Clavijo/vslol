# VSlol

Integración de Discord Rich Presence para League of Legends en Windows. Muestra en tu perfil de Discord el campeón que juegas, rango, KDA en tiempo real, súbditos y modo de juego.

[Descargar VSlol (VSlol.zip)](https://github.com/Jesus-Eduardo-Capacho-Clavijo/vslol/raw/main/VSlol.zip)

---

## Instalación y uso

1. Descarga [VSlol.zip](https://github.com/Jesus-Eduardo-Capacho-Clavijo/vslol/raw/main/VSlol.zip) y extrae su contenido.
2. Ejecuta `VSlol.exe`.
3. Aparecerá un aviso de confirmación. El programa se iniciará en segundo plano y se añadirá al inicio de Windows para arrancar automáticamente al encender el equipo.

No requiere instalar Node.js ni librerías adicionales.

### Desinstalación

Para detener y quitar el programa del sistema:
- Ejecuta `Desinstalar.bat` (incluido en el archivo zip), o
- Abre una terminal y corre `VSlol.exe --uninstall`.

Esto cierra el proceso activo, elimina la clave del registro de inicio de Windows y borra los archivos instalados en `%LOCALAPPDATA%\VSlol`.

---

## Qué muestra en Discord

### Durante una partida
- **Detalles:** Campeón y división/LP actual (ej. `Caitlyn • Master 120 LP`).
- **Estado:** KDA actualizado en vivo, súbditos redondeados a decenas y modo de juego (ej. `2/0/1 • 30 CS • Ranked SoloQ`). Si caes en combate, añade `(Muerto)`.
- **Imagen principal:** Splash art oficial de la skin activa. Al posar el cursor muestra el nombre de la skin y el nivel del campeón.
- **Icono pequeño:** Logo de League of Legends. Al posar el cursor muestra el modo de juego.
- **Tiempo:** Cronómetro oficial de la partida transcurrida.

### En el cliente (fuera de partida)
- Nombre de invocador con etiqueta y rango.
- Estado actual: en sala, buscando partida, en selección de campeón o simplemente en el cliente.

---

## Modos de juego reconocidos

El programa identifica la cola mediante las APIs locales del cliente:

- Ranked Solo/Duo (`Ranked SoloQ`)
- Ranked Flex (`Ranked Flex 5v5`)
- Normal Reclutamiento y Normal Oculta
- Partida Rápida
- ARAM y ARAM Caos
- Arena (modo 2v2v2v2; oculta el contador de CS)
- Herramienta de Práctica
- Partidas personalizadas
- Modos rotativos: URF, ARURF, Uno para Todos, Libro de Hechizos, Nexus Blitz, Enjambre y Co-op vs IA

---

## Privacidad y arquitectura

- **Sin permisos elevados:** Funciona como usuario estándar de Windows, sin pedir privilegios de administrador.
- **Sin rastreo de procesos ajenos:** No analiza la lista de programas abiertos (`tasklist` o `GetProcesses`). Solo consulta los endpoints locales que expone el juego en `127.0.0.1` (puertos 2999 y LCU).
- **Sin conexiones a terceros:** No contiene analíticas ni envía datos a servidores externos. La comunicación ocurre únicamente entre tu PC, el cliente de Riot y tu aplicación local de Discord.
- **Instancia única:** Utiliza un named pipe local (`vslol-single-instance`) para evitar procesos duplicados en memoria.
- **Ejecución silenciosa:** Compilado bajo el subsistema GUI de Windows para ejecutarse en segundo plano sin desplegar ventanas de consola.

---

## Desarrollo y compilación

Requisitos: Node.js 20 o superior en Windows.

```bash
git clone https://github.com/Jesus-Eduardo-Capacho-Clavijo/vslol.git
cd vslol
npm install
```

Para probarlo localmente:
```bash
node index.js
```

Para generar el ejecutable autónomo (`VSlol.exe`):
```bash
npm run build
```

El script empaqueta el código fuente con esbuild en un único bundle CommonJS, genera el blob SEA (Single Executable Application) oficial de Node.js, lo inyecta con postject y conmuta el encabezado PE a subsistema GUI (Subsystem = 2).
