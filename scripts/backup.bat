@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
::  Nexus 数据库备份脚本
::  双击运行即可完成 MySQL + SQLite 双备份
::  备份目标: D:\Nexus_BOX\backups\
::  保留策略: 每种备份各保留最近 10 个
:: ============================================================

:: ---- 配置区（按需修改） ----
set BACKUP_DIR=D:\Nexus_BOX\backups
set RETAIN_COUNT=10
set MYSQL_USER=d_design
set MYSQL_PASSWORD=Nexus@2026!Prod#MyDB
set MYSQL_DATABASE=d_design_art
set MYSQL_SERVICE=mysql
set APP_SERVICE=nexus-server
set SQLITE_CONTAINER_PATH=/app/data/design.db

:: ---- 初始化 ----
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOG_FILE=%BACKUP_DIR%\backup.log

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ============================================================
echo   Nexus 数据库备份
echo   %date% %time%
echo ============================================================
echo.

:: ---- 检查 Docker 是否运行 ----
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

:: ---- 检查 docker-compose 项目是否在运行 ----
docker compose ps >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 docker compose 项目
    echo   请在此脚本所在目录或项目根目录下运行
    pause
    exit /b 1
)

:: ============================================================
::  第 1 步：备份 MySQL
:: ============================================================
echo [1/2] 备份 MySQL 数据库...

set MYSQL_FILE=%BACKUP_DIR%\mysql_%TIMESTAMP%.sql

:: --single-transaction: 不锁表，适合 InnoDB
:: --routines: 导出存储过程和函数
:: --triggers: 导出触发器
:: --default-character-set: 使用 utf8mb4 防止中文乱码
docker compose exec -T %MYSQL_SERVICE% mysqldump ^
    -u %MYSQL_USER% ^
    -p%MYSQL_PASSWORD% ^
    --single-transaction ^
    --routines ^
    --triggers ^
    --default-character-set=utf8mb4 ^
    %MYSQL_DATABASE% > "%MYSQL_FILE%" 2>nul

if exist "%MYSQL_FILE%" (
    for %%F in ("%MYSQL_FILE%") do set MYSQL_SIZE=%%~zF
    echo   [成功] MySQL 备份完成: mysql_%TIMESTAMP%.sql (!MYSQL_SIZE! bytes)
    echo [%date% %time%] MySQL OK: mysql_%TIMESTAMP%.sql (!MYSQL_SIZE! bytes) >> "%LOG_FILE%"
) else (
    echo   [警告] MySQL 备份失败，请检查容器是否运行
    echo [%date% %time%] MySQL FAILED >> "%LOG_FILE%"
)

:: ============================================================
::  第 2 步：备份 SQLite（如果存在）
:: ============================================================
echo.
echo [2/2] 备份 SQLite 数据库...

set SQLITE_FILE=%BACKUP_DIR%\sqlite_%TIMESTAMP%.db

:: 检查容器内 SQLite 文件是否存在
docker compose exec -T %APP_SERVICE% test -f %SQLITE_CONTAINER_PATH% >nul 2>&1
if not errorlevel 1 (
    docker compose cp "%APP_SERVICE%:%SQLITE_CONTAINER_PATH%" "%SQLITE_FILE%" >nul 2>&1
    if exist "%SQLITE_FILE%" (
        for %%F in ("%SQLITE_FILE%") do set SQLITE_SIZE=%%~zF
        echo   [成功] SQLite 备份完成: sqlite_%TIMESTAMP%.db (!SQLITE_SIZE! bytes)
        echo [%date% %time%] SQLite OK: sqlite_%TIMESTAMP%.db (!SQLITE_SIZE! bytes) >> "%LOG_FILE%"
    ) else (
        echo   [警告] SQLite 复制失败
        echo [%date% %time%] SQLite FAILED >> "%LOG_FILE%"
    )
) else (
    echo   [跳过] SQLite 文件不存在，仅使用 MySQL
)

:: ============================================================
::  第 3 步：清理旧备份（保留最近 N 个）
:: ============================================================
echo.
echo [清理] 保留最近 %RETAIN_COUNT% 个备份...

:: 清理 MySQL 旧备份
set MYSQL_COUNT=0
for /f "delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\mysql_*.sql" 2^>nul') do (
    set /a MYSQL_COUNT+=1
    if !MYSQL_COUNT! gtr %RETAIN_COUNT% (
        del "%BACKUP_DIR%\%%F" 2>nul
        echo   已删除旧备份: %%F
    )
)

:: 清理 SQLite 旧备份
set SQLITE_COUNT=0
for /f "delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\sqlite_*.db" 2^>nul') do (
    set /a SQLITE_COUNT+=1
    if !SQLITE_COUNT! gtr %RETAIN_COUNT% (
        del "%BACKUP_DIR%\%%F" 2>nul
        echo   已删除旧备份: %%F
    )
)

:: ============================================================
::  完成
:: ============================================================
echo.
echo ============================================================
echo   备份完成！
echo   备份目录: %BACKUP_DIR%
echo   MySQL:  mysql_%TIMESTAMP%.sql
echo   SQLite: sqlite_%TIMESTAMP%.db
echo ============================================================
echo.
echo 按任意键关闭此窗口...
pause >nul
