@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
::  Nexus 一键更新脚本
::  用法: 将最新代码放入源文件夹，双击此脚本即可自动更新
::
::  前置条件:
::    1. Docker Desktop 已安装并运行
::    2. 源文件夹中包含完整项目代码（docker-compose.yml 等）
::    3. 当前服务器已部署过 Nexus（容器存在）
::
::  更新流程:
;;    备份数据库 → 停止容器 → 同步新代码 → 重建镜像 →
::    启动容器 → 健康检查（60s）→ 成功/自动回滚
:: ============================================================

:: ---- 配置区（按需修改） ----
:: 源代码所在文件夹（把新版本代码放在这个路径下）
set SOURCE_DIR=D:\NexusUpdates\latest
:: 项目部署目录（当前 Nexus 运行目录）
set PROJECT_DIR=%~dp0..
:: 备份目录
set BACKUP_DIR=D:\Nexus_BOX\backups
:: 数据库配置（与 .env.production 一致）
set MYSQL_USER=d_design
set MYSQL_PASSWORD=Nexus@2026!Prod#MyDB
set MYSQL_DATABASE=d_design_art
set MYSQL_SERVICE=mysql
set APP_SERVICE=nexus-server
:: 健康检查最大等待秒数
set HEALTH_TIMEOUT=60
:: 更新后是否运行冒烟测试（1=是, 0=否）
set RUN_SMOKE_TEST=0

:: ---- 初始化 ----
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo ============================================================
echo   Nexus 一键更新
echo   %date% %time%
echo ============================================================
echo.
echo   源代码目录: %SOURCE_DIR%
echo   部署目录:   %PROJECT_DIR%
echo   备份目录:   %BACKUP_DIR%
echo.

:: ============================================================
::  第 1 步：前置校验
;;  检查 Docker 是否运行、源文件夹是否存在、磁盘空间
:: ============================================================
echo [1/6] 前置校验...

:: 1.1 检查 Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo   [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

:: 1.2 检查源文件夹
if not exist "%SOURCE_DIR%" (
    echo   [错误] 源文件夹不存在: %SOURCE_DIR%
    echo   请将最新代码放入此文件夹后重试
    pause
    exit /b 1
)
if not exist "%SOURCE_DIR%\docker-compose.yml" (
    echo   [错误] 源文件夹中未找到 docker-compose.yml
    echo   请确认 %SOURCE_DIR% 是项目的根目录
    pause
    exit /b 1
)

:: 1.3 检查当前项目是否在运行
cd /d "%PROJECT_DIR%"
set CONTAINER_RUNNING=0
docker compose ps --format "table {{.Service}}" 2>nul | findstr /c:"%MYSQL_SERVICE%" >nul 2>&1
if not errorlevel 1 set CONTAINER_RUNNING=1

if %CONTAINER_RUNNING%==0 (
    echo   [警告] 当前 Nexus 容器未运行，将直接部署
)

:: 1.4 检查磁盘空间（D 盘至少 2GB 可用）
for /f "tokens=3" %%a in ('dir /-c D:\ 2^>nul ^| findstr /c:"可用字节"') do set FREE_SPACE=%%a 2>nul
if defined FREE_SPACE (
    if !FREE_SPACE! lss 2000000000 (
        echo   [错误] D 盘可用空间不足 2GB，请清理磁盘后重试
        pause
        exit /b 1
    )
)

echo   [通过] 前置校验完成

:: ============================================================
::  第 2 步：备份数据库
;;  同步新代码前先备份，防止更新失败数据丢失
:: ============================================================
echo.
echo [2/6] 备份数据库...

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set MYSQL_FILE=%BACKUP_DIR%\mysql_%TIMESTAMP%.sql

if %CONTAINER_RUNNING%==1 (
    :: MySQL 备份（--single-transaction 不锁表，--routines 导出存储过程）
    docker compose exec -T %MYSQL_SERVICE% mysqldump ^
        -u %MYSQL_USER% ^
        -p%MYSQL_PASSWORD% ^
        --single-transaction ^
        --routines ^
        --triggers ^
        --default-character-set=utf8mb4 ^
        %MYSQL_DATABASE% > "%MYSQL_FILE%" 2>nul

    if exist "%MYSQL_FILE%" (
        for %%F in ("%MYSQL_FILE%") do echo   [成功] MySQL 备份: mysql_%TIMESTAMP%.sql (%%~zF bytes)
    ) else (
        echo   [警告] MySQL 备份失败，是否继续？[Y/N]
        choice /c YN /n /m "  "
        if errorlevel 2 exit /b 1
    )

    :: SQLite 备份（如果存在）
    docker compose exec -T %APP_SERVICE% test -f /app/data/design.db >nul 2>&1
    if not errorlevel 1 (
        set SQLITE_FILE=%BACKUP_DIR%\sqlite_%TIMESTAMP%.db
        docker compose cp "%APP_SERVICE%:/app/data/design.db" "!SQLITE_FILE!" >nul 2>&1
        if exist "!SQLITE_FILE!" echo   [成功] SQLite 备份: sqlite_%TIMESTAMP%.db
    )
) else (
    echo   [跳过] 容器未运行，跳过数据库备份
)

:: ============================================================
::  第 3 步：同步新代码
;;  使用 robocopy 增量同步，排除 node_modules/.git 等大文件夹
;;  /MIR: 镜像模式（目标与源一致，删除多余文件）
;;  /XD: 排除的文件夹列表
;;  /NJH /NJS /NP: 减少输出噪音
;;  注意: upload 和 data 目录也排除，这些在 Docker volume 中
:: ============================================================
echo.
echo [3/6] 同步新代码...

:: 保留原代码的 .env.production（生产环境密钥不同）
if exist "%PROJECT_DIR%\standalone-server\.env.production" (
    copy /y "%PROJECT_DIR%\standalone-server\.env.production" "%BACKUP_DIR%\.env.production.bak" >nul 2>&1
)

:: robocopy 排除列表（每个文件夹一行，清晰易维护）
set EXCLUDE_DIRS=node_modules .git dist release release-v2 release-new
set EXCLUDE_DIRS=%EXCLUDE_DIRS% logs upload data backups test-results

:: 构建 /XD 参数
set XD_ARGS=
for %%d in (%EXCLUDE_DIRS%) do set XD_ARGS=!XD_ARGS! /XD "%%d"

robocopy "%SOURCE_DIR%" "%PROJECT_DIR%" /MIR /NJH /NJS /NP /NS /NDL %XD_ARGS% /XF *.log

:: robocopy 返回码处理: 0-7 都算正常（0=无变更,1=有复制,2=多余文件,3=1+2,...）
set RC=%errorlevel%
if %RC% geq 8 (
    echo   [错误] 代码同步失败，robocopy 返回码: %RC%
    echo   请检查源文件夹权限和磁盘空间
    pause
    exit /b 1
)

:: 恢复 .env.production（确保生产密钥不丢失）
if exist "%BACKUP_DIR%\.env.production.bak" (
    move /y "%BACKUP_DIR%\.env.production.bak" "%PROJECT_DIR%\standalone-server\.env.production" >nul 2>&1
)

echo   [成功] 代码同步完成

:: ============================================================
;;  第 3.5 步：数据库迁移（如果新版本包含迁移脚本）
;;  如果源文件夹中有 database/migrations/ 目录，
;;  会在容器启动后自动执行（database.js 的 CREATE TABLE IF NOT EXISTS）
;;  如果有手动 SQL 需要执行，请放到 SOURCE_DIR\migrate.sql
:: ============================================================
if exist "%SOURCE_DIR%\migrate.sql" (
    echo.
    echo [迁移] 检测到 migrate.sql，将在容器启动后执行...
    set HAS_MIGRATION=1
) else (
    set HAS_MIGRATION=0
)

:: ============================================================
::  第 4 步：停止旧容器
:: ============================================================
echo.
echo [4/6] 停止旧容器...

if %CONTAINER_RUNNING%==1 (
    docker compose down
    echo   [成功] 容器已停止
) else (
    echo   [跳过] 容器未在运行
)

:: ============================================================
::  第 5 步：重建镜像并启动
;;  --pull: 拉取最新基础镜像（node:20-slim 等）
;;  build: 重新构建 Vite 前端 + Node 后端镜像
:: ============================================================
echo.
echo [5/6] 重建 Docker 镜像并启动...

docker compose build --pull
if errorlevel 1 (
    echo   [错误] 镜像构建失败，正在回滚...
    goto :ROLLBACK
)

docker compose up -d
if errorlevel 1 (
    echo   [错误] 容器启动失败，正在回滚...
    goto :ROLLBACK
)

echo   [成功] 容器已启动，等待服务就绪...

:: ============================================================
::  第 6 步：健康检查（轮询 /api/health，最多等 60 秒）
:: ============================================================
echo.
echo [6/6] 健康检查（最多等待 %HEALTH_TIMEOUT% 秒）...

set COUNT=0
:HEALTH_LOOP
set /a COUNT+=1
if %COUNT% gtr %HEALTH_TIMEOUT% goto :HEALTH_FAIL

:: 使用 PowerShell 做 HTTP 请求（Windows 内置，无需额外工具）
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:18632/api/health' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :HEALTH_OK

:: 显示等待进度（每 3 秒一个点）
<nul set /p ="."
timeout /t 1 >nul
goto :HEALTH_LOOP

:HEALTH_OK
echo.
echo   [成功] 健康检查通过！
goto :POST_DEPLOY

:HEALTH_FAIL
echo.
echo   [失败] 健康检查超时（%HEALTH_TIMEOUT% 秒）
goto :ROLLBACK

:: ============================================================
::  部署后操作
:: ============================================================
:POST_DEPLOY

:: 执行手动迁移（如果有 migrate.sql）
if %HAS_MIGRATION%==1 (
    echo.
    echo [迁移] 执行 migrate.sql...
    docker compose exec -T %MYSQL_SERVICE% mysql -u %MYSQL_USER% -p%MYSQL_PASSWORD% %MYSQL_DATABASE% < "%SOURCE_DIR%\migrate.sql" 2>nul
    if errorlevel 1 (
        echo   [警告] 迁移脚本执行失败，请检查 migrate.sql
    ) else (
        echo   [成功] 迁移完成
        del "%SOURCE_DIR%\migrate.sql" 2>nul
    )
)

:: 可选：运行冒烟测试
if %RUN_SMOKE_TEST%==1 (
    echo.
    echo [测试] 运行冒烟测试...
    if exist "%PROJECT_DIR%\node_modules\.bin\playwright" (
        cd /d "%PROJECT_DIR%"
        npx playwright test --config=playwright.config.js 2>&1
        if errorlevel 1 (
            echo   [警告] 冒烟测试未全部通过，请检查测试报告
        ) else (
            echo   [成功] 冒烟测试全部通过！
        )
    ) else (
        echo   [跳过] 未安装 Playwright，跳过测试
    )
)

:: 清理旧备份（保留最近 10 个）
echo.
echo [清理] 保留最近 10 个备份...
call :CLEAN_OLD_BACKUPS

:: ============================================================
::  更新成功！
:: ============================================================
echo.
echo ============================================================
echo   Nexus 更新完成！
echo   访问地址: http://localhost:18632
echo   备份文件: %MYSQL_FILE%
echo ============================================================
goto :END

:: ============================================================
;;  自动回滚
;;  恢复数据库备份并重启旧版本容器
;;  注意：代码文件通过 robocopy /MIR 已覆盖，回滚需要从备份目录恢复代码
:: ============================================================
:ROLLBACK
echo.
echo ============================================================
echo   正在自动回滚...
echo ============================================================

:: 恢复 MySQL 备份（如果存在）
if exist "%MYSQL_FILE%" (
    echo   [回滚] 恢复 MySQL 数据库...
    docker compose up -d %MYSQL_SERVICE% >nul 2>&1
    timeout /t 5 >nul
    docker compose exec -T %MYSQL_SERVICE% mysql -u %MYSQL_USER% -p%MYSQL_PASSWORD% %MYSQL_DATABASE% < "%MYSQL_FILE%" 2>nul
    echo   [回滚] 数据库已恢复
)

:: 重启容器（Docker 镜像有 layer cache，rebuild 很快）
docker compose down >nul 2>&1
docker compose build --pull >nul 2>&1
docker compose up -d >nul 2>&1

echo   [回滚] 容器已重启，请手动检查服务状态
echo   docker compose logs nexus-server

echo.
echo ============================================================
echo   更新失败，已执行回滚
echo   请检查日志排查问题
echo ============================================================
pause
exit /b 1

:: ============================================================
;;  工具函数：清理旧备份（MySQL 和 SQLite 各保留最近 10 个）
:: ============================================================
:CLEAN_OLD_BACKUPS
set MYSQL_COUNT=0
for /f "delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\mysql_*.sql" 2^>nul') do (
    set /a MYSQL_COUNT+=1
    if !MYSQL_COUNT! gtr 10 (
        del "%BACKUP_DIR%\%%F" 2>nul
    )
)
set SQLITE_COUNT=0
for /f "delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\sqlite_*.db" 2^>nul') do (
    set /a SQLITE_COUNT+=1
    if !SQLITE_COUNT! gtr 10 (
        del "%BACKUP_DIR%\%%F" 2>nul
    )
)
exit /b

:END
echo.
echo 按任意键关闭此窗口...
pause >nul
