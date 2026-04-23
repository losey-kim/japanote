@echo off
echo.
echo ==========================================
echo  Japanote - Setup (Windows)
echo ==========================================
echo.

:: Admin check
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Please run as Administrator.
    echo     Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

:: Node.js check
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Please install LTS version from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% found

:: Save current folder path
set WORK_DIR=%~dp0
set WORK_DIR=%WORK_DIR:~0,-1%
echo [OK] Install path: %WORK_DIR%

:: npm install
echo.
echo [1/3] Installing dependencies...
cd /d "%WORK_DIR%"
call npm.cmd install --silent
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)
echo [OK] Dependencies installed

:: pm2 install
echo.
echo [2/3] Installing PM2...
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    call npm.cmd install -g pm2
    where pm2 >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] PM2 install failed
        pause
        exit /b 1
    )
    echo [OK] PM2 installed
) else (
    echo [OK] PM2 already installed
)

:: Clean up existing process
call pm2.cmd delete japanote >nul 2>&1

:: Start server with PM2
echo.
echo [3/3] Starting server...
cd /d "%WORK_DIR%"
call pm2.cmd start ecosystem.config.cjs
call pm2.cmd save
echo [OK] Server started

:: Register auto-start on boot via Task Scheduler
echo.
echo [Registering auto-start...]

for /f "tokens=*" %%i in ('where pm2.cmd') do set PM2_PATH=%%i

schtasks /delete /tn "Japanote" /f >nul 2>&1
schtasks /create /tn "Japanote" /tr "\"%PM2_PATH%\" resurrect" /sc onlogon /ru "%USERNAME%" /f >nul 2>&1

if %errorlevel% equ 0 (
    echo [OK] Auto-start registered
) else (
    echo [!] Auto-start registration failed - manual start required
)

echo.
echo ==========================================
echo  Setup Complete!
echo.
echo  Open browser and go to:
echo  http://localhost:8080/japanote/
echo.
echo  Server will auto-start after PC reboot.
echo ==========================================
echo.
pause
