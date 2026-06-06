@echo off
cd /d "%~dp0"
title Nexus 服务端

echo ══════════════════════════════════════════════
echo  Nexus 服务端
echo ══════════════════════════════════════════════

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [安装] 依赖...
    call npm install
)

if not exist "upload" mkdir upload

set NODE_ENV=production
set UPLOAD_DIR=%~dp0upload

echo 模式: %NODE_ENV%
echo 端口: 18632
echo.

node server.js
echo.
echo 服务端已退出
pause
