@echo off
chcp 65001 >nul 2>&1
title AI Body Analyzer Launcher
echo ===================================================
echo   Starting AI Body Analyzer Services
echo ===================================================
echo.

:: ── Check Python ──────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.11+ and add it to PATH.
    pause
    exit /b 1
)

:: ── Check Node.js ─────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js 18+ and add it to PATH.
    pause
    exit /b 1
)

:: ── Setup Backend venv if needed ──────────────────────────
if not exist "backend\.venv\Scripts\python.exe" (
    echo [SETUP] Creating Python virtual environment for backend...
    python -m venv backend\.venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [SETUP] Installing backend dependencies...
    backend\.venv\Scripts\pip.exe install -e backend
    backend\.venv\Scripts\pip.exe install bcrypt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo [SETUP] Backend setup complete!
    echo.
)

:: ── Setup Frontend node_modules if needed ─────────────────
if not exist "frontend\node_modules" (
    echo [SETUP] Installing frontend dependencies...
    cd frontend && npm install && cd ..
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies!
        pause
        exit /b 1
    )
    echo [SETUP] Frontend setup complete!
    echo.
)

echo [1/3] Starting Backend (FastAPI) on port 8000...
start "AI Body Analyzer - Backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [2/3] Starting Frontend (Next.js) on port 3000...
start "AI Body Analyzer - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- -p 3000"

echo [3/3] Waiting for servers to initialize...
timeout /t 5 /nobreak > nul

echo Opening application in the default browser...
start http://localhost:3000

echo ===================================================
echo   Services are running in separate windows.
echo   Close this window or press any key to exit.
echo ===================================================
pause > nul
