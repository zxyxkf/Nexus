@echo off
cd /d "%~dp0"

echo Starting Design...
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:18632
echo.

REM Keep local development isolated from MySQL and production storage.
set "NODE_ENV=development"
set "HOST=127.0.0.1"
set "USE_MYSQL=0"
set "DB_ENGINE=sqlite"
set "DATA_DIR=%~dp0.local-dev-data"
set "UPLOAD_DIR=%~dp0.local-dev-upload"
set "LOG_DIR=%~dp0.local-dev-logs"

REM Backend in new window
start "Design-Backend" "%~dp0standalone-server\start-backend.bat"

REM Frontend in current window
if not exist "node_modules" npm install
npm run dev
