@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Nexus Backend

if not exist "node_modules" (
    echo [Install] Backend dependencies...
    call npm install
)

echo ===============================================
echo   Nexus Server
echo ===============================================

REM This script is for local development only. Production uses start-server.bat.
set "NODE_ENV=development"
set "HOST=127.0.0.1"
set "USE_MYSQL=0"
set "DB_ENGINE=sqlite"
set "DATA_DIR=%~dp0..\.local-dev-data"
set "UPLOAD_DIR=%~dp0..\.local-dev-upload"
set "LOG_DIR=%~dp0..\.local-dev-logs"

node server.js
pause
