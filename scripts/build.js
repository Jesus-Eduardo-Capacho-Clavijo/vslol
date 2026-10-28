import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = path.resolve('.');
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

console.log('=======================================================');
console.log('       Compilando y Empaquetando VSlol.exe             ');
console.log('=======================================================');

// 1. Bundle con esbuild en CommonJS
console.log('[1/5] Empaquetando código fuente con esbuild...');
execSync('npx esbuild index.js --bundle --platform=node --target=node20 --outfile=dist/bundle.cjs', {
  stdio: 'inherit',
  cwd: rootDir
});

// 2. Generar sea-config.json y blob SEA
console.log('[2/5] Generando blob SEA de Node.js...');
const seaConfig = {
  main: path.join(distDir, 'bundle.cjs'),
  output: path.join(distDir, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true
};
fs.writeFileSync(path.join(distDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));
execSync('node --experimental-sea-config dist/sea-config.json', {
  stdio: 'inherit',
  cwd: rootDir
});

// 3. Copiar base node.exe hacia dist/VSlol.exe
console.log('[3/5] Creando binario base VSlol.exe...');
const targetExe = path.join(distDir, 'VSlol.exe');
fs.copyFileSync(process.execPath, targetExe);

// 4. Inyectar blob con postject
console.log('[4/5] Inyectando blob SEA en VSlol.exe...');
execSync(`npx postject "${targetExe}" NODE_SEA_BLOB "${path.join(distDir, 'sea-prep.blob')}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
  stdio: 'inherit',
  cwd: rootDir
});

// 5. Modificar encabezado PE32+ a Windows GUI (Subsystem = 2) para ejecución silenciosa
console.log('[5/5] Modificando encabezado PE para ejecución 100% silenciosa (sin ventana de consola)...');
const buf = fs.readFileSync(targetExe);
const peOffset = buf.readUInt32LE(0x3C);
const subsystemOffset = peOffset + 24 + 68; // PE32+ Subsystem field
buf.writeUInt16LE(2, subsystemOffset); // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI
fs.writeFileSync(targetExe, buf);

// Copiar también a la raíz del proyecto como VSlol.exe para acceso directo
const rootExe = path.join(rootDir, 'VSlol.exe');
fs.copyFileSync(targetExe, rootExe);

console.log('\n=======================================================');
console.log('  ¡Compilación Exitosa!');
console.log('  Ejecutable listo en: VSlol.exe');
console.log('  Cualquier persona puede descargarlo y darle doble clic.');
console.log('=======================================================');
