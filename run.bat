@echo off
title League of Legends - Discord Rich Presence en Vivo
color 0b

echo =======================================================
echo   League of Legends - Discord Rich Presence en Vivo
echo =======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Iniciando presencia en tiempo real (sondeo rapido 1s)...
echo Presiona Ctrl+C en cualquier momento para detener la aplicacion.
echo =======================================================
echo.

node index.js

if %errorlevel% neq 0 (
    echo.
    echo La aplicacion se cerro con error.
    pause
)
