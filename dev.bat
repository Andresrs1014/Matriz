@echo off
title Matriz - Entorno LOCAL
echo ============================================
echo   MATRIZ - Entorno de desarrollo local
echo   Backend  → http://127.0.0.1:8000
echo   Frontend → http://localhost:5199
echo   DB local → backend/data/matrix_local.db
echo ============================================
echo.

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

:: ── Backend ──────────────────────────────────────────────────────────────────
echo [1/2] Iniciando backend (FastAPI + uvicorn)...
start "MATRIZ Backend :8000" cmd /k "cd /d %BACKEND% && venv\Scripts\activate && python run.py"

:: Esperar 3 segundos para que el backend arranque antes del frontend
timeout /t 3 /nobreak >nul

:: ── Frontend ─────────────────────────────────────────────────────────────────
echo [2/2] Iniciando frontend (Vite :5199)...
start "MATRIZ Frontend :5199" cmd /k "cd /d %FRONTEND% && npm run dev"

echo.
echo Listo. Se abrieron dos ventanas de terminal.
echo Cuando termines, cierra esas dos ventanas para detener los servidores.
echo.
pause
