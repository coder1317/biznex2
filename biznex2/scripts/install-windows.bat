@echo off
REM Biznex2 Installation Script for Windows
REM Run as Administrator

echo ================================================
echo   Biznex2 - Multi-Store POS System
echo   Windows Installation
echo ================================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator
    pause
    exit /b 1
)

set INSTALL_DIR=C:\Biznex2
set NODE_VERSION=18

echo [INFO] Installing Biznex2 to %INSTALL_DIR%...
echo.

REM Check if Node.js is installed
echo [*] Checking Node.js installation...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Node.js not found. Downloading...
    echo [*] Please download Node.js 18 LTS from https://nodejs.org/
    echo [*] Run this script again after installing Node.js
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
    echo [OK] Node.js found: %NODE_VER%
)

REM Create installation directory
if not exist "%INSTALL_DIR%" (
    echo [*] Creating directory: %INSTALL_DIR%
    mkdir "%INSTALL_DIR%"
) else (
    echo [OK] Directory already exists: %INSTALL_DIR%
)

REM Copy files
echo [*] Copying application files...
xcopy /E /I /Y "." "%INSTALL_DIR%" /EXCLUDE:install-exclude.txt

REM Install dependencies
echo [*] Installing npm dependencies (this may take a while)...
cd /d "%INSTALL_DIR%"
call npm install --production

if %errorLevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist "%INSTALL_DIR%\.env" (
    echo [*] Creating .env file...
    (
        echo NODE_ENV=production
        echo PORT=3000
        echo DB_PATH=%INSTALL_DIR%\data\biznex2.db
        echo LOG_DIR=%INSTALL_DIR%\logs
        echo API_BASE_URL=http://localhost:3000
        echo JWT_SECRET=
        echo JWT_REFRESH_SECRET=
    ) > "%INSTALL_DIR%\.env"
)

REM Create data directories
if not exist "%INSTALL_DIR%\data" mkdir "%INSTALL_DIR%\data"
if not exist "%INSTALL_DIR%\logs" mkdir "%INSTALL_DIR%\logs"

REM Create desktop shortcut
echo [*] Creating desktop shortcut...
powershell -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell;" ^
  "$Shortcut = $WshShell.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\Biznex2.lnk');" ^
  "$Shortcut.TargetPath = '%INSTALL_DIR%\electron-shell\Biznex2.exe';" ^
  "$Shortcut.WorkingDirectory = '%INSTALL_DIR%';" ^
  "$Shortcut.Save();"

REM Create batch file to run the app
echo [*] Creating startup script...
(
    echo @echo off
    echo node "%%~dp0server\server.js"
    echo timeout /t 2
) > "%INSTALL_DIR%\start-server.bat"

REM Create batch file for Electron app
(
    echo @echo off
    echo cd /d "%%~dp0"
    echo npm start
) > "%INSTALL_DIR%\start-app.bat"

echo.
echo ================================================
echo   [OK] Installation Complete!
echo ================================================
echo.
echo [*] Application Directory: %INSTALL_DIR%
echo [*] To start the app, run: %INSTALL_DIR%\start-app.bat
echo [*] Or click the Biznex2 shortcut on your Desktop
echo.
echo [*] First Run Instructions:
echo     1. Double-click Biznex2 from your Desktop or Start Menu
echo     2. You will see the Setup Wizard
echo     3. Create your Admin account
echo     4. Start using Biznex2!
echo.
echo [*] Access the app at: http://localhost:3000
echo.
pause
