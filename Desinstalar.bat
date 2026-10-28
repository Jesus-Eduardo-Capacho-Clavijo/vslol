@echo off
chcp 65001 >nul
echo =======================================================
echo          Desinstalador de VSlol
echo =======================================================
echo.
echo [1/3] Deteniendo proceso VSlol...
taskkill /f /im VSlol.exe >nul 2>&1
echo.
echo [2/3] Eliminando VSlol del inicio automatico de Windows...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "VSlol" /f >nul 2>&1
echo.
echo [3/3] Eliminando archivos instalados...
if exist "%LOCALAPPDATA%\VSlol" (
  rmdir /s /q "%LOCALAPPDATA%\VSlol" >nul 2>&1
)
echo.
echo =======================================================
echo   VSlol ha sido desinstalado completamente de tu PC.
echo   Ya no se iniciara automaticamente con Windows.
echo =======================================================
echo.
pause
