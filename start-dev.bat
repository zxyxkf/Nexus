@echo off
cd /d "%~dp0"

echo Starting Design...
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:18632
echo.

REM Backend in new window
start "Design-Backend" "%~dp0standalone-server\start-backend.bat"

REM Frontend in current window
if not exist "node_modules" npm install
npm run dev
