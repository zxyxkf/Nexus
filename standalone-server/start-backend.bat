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

node server.js
pause
