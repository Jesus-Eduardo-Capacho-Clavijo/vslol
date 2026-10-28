import fs from 'fs';
import path from 'path';
import net from 'net';
import { execSync, spawn } from 'child_process';

const PIPE_NAME = '\\\\.\\pipe\\vslol-single-instance';
let instanceServer = null;

function toVbsString(text) {
  const parts = [];
  let currentAscii = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126 && text[i] !== '"') {
      currentAscii += text[i];
    } else if (text[i] === '"') {
      currentAscii += '""';
    } else if (text[i] === '\n') {
      if (currentAscii) {
        parts.push(`"${currentAscii}"`);
        currentAscii = '';
      }
      parts.push('vbCrLf');
    } else if (text[i] === '\r') {
      // Ignorar retorno de carro
    } else {
      if (currentAscii) {
        parts.push(`"${currentAscii}"`);
        currentAscii = '';
      }
      parts.push(`ChrW(${code})`);
    }
  }
  if (currentAscii) {
    parts.push(`"${currentAscii}"`);
  }
  return parts.length > 0 ? parts.join(' & ') : '""';
}

function showMessageBox(message, title = 'VSlol - Discord Rich Presence') {
  try {
    const vbsPath = path.join(process.env.TEMP || '.', 'vslol-msg.vbs');
    const msgExpr = toVbsString(message);
    const titleExpr = toVbsString(title);
    fs.writeFileSync(vbsPath, `MsgBox ${msgExpr}, 64, ${titleExpr}\n`, 'ascii');
    spawn('wscript.exe', [vbsPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {
    // Fallback silencioso si no está disponible
  }
}

const LOG_FILE = path.join(process.env.LOCALAPPDATA || '.', 'vslol-installer.log');
function log(msg) {
  try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}

export function handleInstallerAndSingleInstance() {
  const isDevMode = path.basename(process.execPath).toLowerCase().includes('node');
  const args = process.argv.slice(1);
  log(`Start: execPath=${process.execPath}, isDevMode=${isDevMode}, args=${JSON.stringify(args)}`);

  // Manejar desinstalación
  if (args.includes('--uninstall')) {
    try {
      execSync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "VSlol" /f', { stdio: 'ignore', windowsHide: true });
    } catch {
      // Ignorar si no existía la clave
    }
    showMessageBox('VSlol ha sido desinstalado del inicio automático de Windows.');
    process.exit(0);
  }

  // Si estamos en modo ejecutable (.exe) y no en node.exe
  if (!isDevMode) {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local');
    const targetDir = path.join(localAppData, 'VSlol');
    const targetExe = path.join(targetDir, 'VSlol.exe');

    const currentExe = path.resolve(process.execPath);
    const installedExe = path.resolve(targetExe);
    log(`currentExe=${currentExe}, installedExe=${installedExe}`);

    // Si se ejecutó desde otra ubicación (ej. Descargas o Escritorio), auto-instalar
    if (currentExe.toLowerCase() !== installedExe.toLowerCase()) {
      try {
        log(`Creating targetDir=${targetDir}`);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Copiar el ejecutable al directorio permanente de la app
        log(`Copying ${currentExe} -> ${targetExe}`);
        try {
          fs.copyFileSync(currentExe, targetExe);
        } catch (copyErr) {
          log(`First copy failed: ${copyErr.message}, attempting taskkill`);
          try {
            execSync(`taskkill /F /FI "PID ne ${process.pid}" /IM VSlol.exe`, { stdio: 'ignore', windowsHide: true });
            fs.copyFileSync(currentExe, targetExe);
          } catch (e) {
            log(`Copy error after taskkill: ${e.message}`);
          }
        }

        // Registrar en el inicio de Windows (HKCU sin requerir privilegios de Administrador)
        log(`Registering startup key in HKCU`);
        execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "VSlol" /t REG_SZ /d "${targetExe}" /f`, { stdio: 'ignore', windowsHide: true });

        // Crear script de desinstalación amigable
        const uninstallBat = path.join(targetDir, 'Desinstalar VSlol.bat');
        const batContent = `@echo off\r\nchcp 65001 >nul\r\necho Deteniendo VSlol...\r\ntaskkill /f /im VSlol.exe >nul 2>&1\r\necho Eliminando del inicio de Windows...\r\nreg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "VSlol" /f >nul 2>&1\r\necho VSlol ha sido desinstalado del inicio de Windows correctamente.\r\npause\r\n`;
        fs.writeFileSync(uninstallBat, batContent, 'utf-8');

        // Notificar al usuario con un diálogo amigable
        log(`Showing notification dialog`);
        showMessageBox(
          '¡VSlol se ha instalado con éxito!\n\n' +
          'El programa ya está activo en segundo plano e iniciará automáticamente cada vez que enciendas tu PC.\n\n' +
          'Detectará tus partidas y cliente de League of Legends de forma automática.'
        );

        // Lanzar la versión instalada en segundo plano
        log(`Spawning targetExe directly without cmd: ${targetExe}`);
        spawn(targetExe, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        log(`Installer exiting (0)`);
        process.exit(0);
      } catch (err) {
        log(`Installation failed: ${err.message}\n${err.stack}`);
        // Si falla la auto-instalación por alguna razón, continuar ejecutando localmente
      }
    }
  }

  // Control de instancia única (Single Instance Lock)
  return new Promise((resolve) => {
    log(`Attempting single instance lock on ${PIPE_NAME}`);
    instanceServer = net.createServer();

    instanceServer.once('error', (err) => {
      log(`instanceServer error: ${err.code} - ${err.message}`);
      if (err.code === 'EADDRINUSE') {
        log('Another instance already running. Exiting cleanly.');
        if (!process.argv.includes('--silent') && !isDevMode) {
          showMessageBox('VSlol ya se encuentra en ejecución en segundo plano.');
        }
        process.exit(0);
      }
      resolve();
    });

    instanceServer.listen(PIPE_NAME, () => {
      log('Single instance lock acquired successfully.');
      resolve();
    });
  });
}
