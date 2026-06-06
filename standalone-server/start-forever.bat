@echo off
chcp 65001 >nul
title Nexus 服务端（后台常驻版）

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js
    pause
    exit /b 1
)

:: 安装依赖（如需要）
if not exist "node_modules" call npm install

:: 创建上传目录
if not exist "upload" mkdir upload

:: 设置上传目录环境变量
set UPLOAD_DIR=%~dp0upload

:: 循环启动——崩溃自动重启
:loop
echo [%date% %time%] Nexus 服务端启动...
node server.js
echo [%date% %time%] 服务端退出（退出码: %ERRORLEVEL%），5秒后重启...
timeout /t 5 /nobreak >nul
goto loop
