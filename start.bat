@echo off
echo Starting AI Learning App...
echo.

start "Backend" cmd /k "cd /d D:\ai-learning-app\backend && npm run dev"
timeout /t 3 /nobreak > nul

start "Frontend" cmd /k "cd /d D:\ai-learning-app\frontend && npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo Both servers are starting...
echo Backend:  http://localhost:4000
echo Frontend: http://localhost:3000
echo.
start http://localhost:3000
