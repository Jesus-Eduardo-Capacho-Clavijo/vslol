# ⚡ VSlol • League of Legends Discord Rich Presence

<p align="center">
  <a href="https://github.com/Jesus-Eduardo-Capacho-Clavijo/vslol/raw/main/VSlol.zip">
    <img src="https://img.shields.io/badge/DESCARGAR_VSlol_(.ZIP)-00E59B?style=for-the-badge&logo=windows&logoColor=black" alt="Descargar VSlol" height="45">
  </a>
</p>

<p align="center">
  <b>Aplicación de escritorio 100% autónoma, silenciosa y en tiempo real para League of Legends en Discord.</b><br>
  <i>No requiere instalar Node.js ni configurar terminales. Solo descarga, descomprime y dale doble clic.</i>
</p>

---

## 📥 Instalación Rápida (1 solo clic)

1. **[Haz clic aquí para Descargar VSlol.zip](https://github.com/Jesus-Eduardo-Capacho-Clavijo/vslol/raw/main/VSlol.zip)**
2. Descomprime el archivo `.zip` en tu PC.
3. Haz **doble clic en `VSlol.exe`**.
4. ¡Listo! Aparecerá una ventana nativa confirmando que el programa quedó instalado y activo:
   - **Inicia automáticamente con Windows** en segundo plano (100% invisible, sin consolas ni ventanas negras).
   - Cuando no juegues, permanece en reposo consumiendo **0.0% de CPU**.
   - Apenas abras el cliente o juegues una partida, tu estado en Discord se actualizará de inmediato.

> 🗑️ **¿Cómo desinstalarlo?**  
> El archivo `Desinstalar.bat` viene incluido en el `.zip`. Solo dale **doble clic** y se encargará automáticamente de cerrar el proceso, quitarlo del inicio de Windows y limpiar los archivos.

---

## 🎮 ¿Cómo se ve en tu perfil de Discord?

```text
JUGANDO A UN JUEGO
League of Legends                   <-- Título oficial de la app en Discord
Morgana • Master 120 LP             <-- Campeón actual y tu Elo con LP (sin paréntesis)
0/0/0 • 0 CS • Ranked SoloQ         <-- KDA en vivo, CS por decenas y Modo de juego
12:35 transcurridos                 <-- Cronómetro oficial de la partida
```

### ✨ Detalles Visuales:
- **KDA en tiempo real:** Prioridad absoluta a tus kills, muertes y asistencias instantáneas. Si mueres, indica `(Muerto)`.
- **Farm (CS) optimizado:** Se actualiza por decenas (`0 CS`, `10 CS`, `20 CS`...) respetando los límites oficiales de Discord.
- **Tooltip de Skin:** Al pasar el cursor sobre la imagen del campeón, solo muestra `Nombre de la Skin • Nivel X`.
- **Tooltip del Logo LoL:** Al pasar el cursor sobre el pequeño logo oficial de LoL, muestra `Modo: Ranked SoloQ`.
- **En el Cliente (Lobby y Champ Select):**
  - En Sala: `En Sala • Ranked SoloQ` (o el modo elegido)
  - Buscando partida: `Buscando Partida • ARAM`
  - Selección de campeón: `Selección de Campeón • Normal Reclutamiento`

---

## 🕹️ Modos de Juego Soportados

Identificación precisa mediante la lectura de colas oficiales (`Queue IDs`) de Riot:

| Modo de Juego | Estado en Discord |
| :--- | :--- |
| **Clasificatoria Solo/Duo** | `Ranked SoloQ` |
| **Clasificatoria Flexible** | `Ranked Flex 5v5` |
| **Normal Reclutamiento** | `Normal Reclutamiento` |
| **Normal Oculta** | `Normal Oculta` |
| **Partida Rápida (Quickplay)** | `Partida Rápida` |
| **ARAM (Abismo de los Lamentos)** | `ARAM` |
| **ARAM Caos (Mayhem)** | `ARAM Caos` |
| **Arena (2v2v2v2 / Cherry)** | `Arena` *(CS oculto automáticamente)* |
| **Herramienta de Práctica** | `Herramienta de Práctica` |
| **Partida Personalizada** | `Personalizada` |
| **Modos Rotativos** | `URF`, `ARURF`, `Uno para Todos`, `Libro de Hechizos`, `Nexus Blitz`, `Enjambre`, `Co-op vs IA` |

---

## 🔒 Privacidad y Rendimiento

Diseñado bajo los más altos estándares de calidad de software:

1. **Cero permisos de administrador (UAC):** Corre exclusivamente en espacio de usuario estándar.
2. **Cero escaneo de procesos:** No revisa tu lista de programas abiertos, navegadores ni chats. Solo consulta los puertos locales oficiales del juego (`127.0.0.1`).
3. **Cero telemetría:** No envía métricas, no rastrea tu información ni hace llamadas a servidores de terceros.
4. **Instancia Única:** Protegido por un Named Pipe local para evitar que se ejecute dos veces en memoria.

---

## 💻 Para Desarrolladores (Código Fuente)

Si deseas clonar y revisar el código fuente o compilar tu propio `.exe`:

```bash
# 1. Clonar el repositorio
git clone https://github.com/Jesus-Eduardo-Capacho-Clavijo/vslol.git
cd vslol

# 2. Instalar dependencias
npm install

# 3. Ejecutar en desarrollo
node index.js

# 4. Compilar el ejecutable autónomo VSlol.exe
npm run build
```
