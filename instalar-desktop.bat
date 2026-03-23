@echo off
setlocal enabledelayedexpansion
title ScribIA Desktop - Instalador

echo ============================================
echo    ScribIA Desktop - Instalador e Launcher
echo ============================================
echo.

echo [1/7] Verificando Node.js...
where node >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale em: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo       Node.js %%i OK

echo [2/7] Verificando Rust...
set RUST_AVAILABLE=0
where rustc >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    set RUST_AVAILABLE=1
    for /f "tokens=*" %%i in ('rustc --version') do echo       %%i OK
) else (
    echo       Rust nao encontrado - modo navegador
)

echo [3/7] Dependencias do monorepo...
cd /d "%~dp0"
if not exist "node_modules" (
    echo       Executando npm install...
    call npm install
) else (
    echo       OK
)

echo [4/7] Dependencias do desktop...
cd /d "%~dp0apps\desktop"
if not exist "node_modules" (
    echo       Executando npm install...
    call npm install
) else (
    echo       OK
)

echo [5/7] Verificando .env...
cd /d "%~dp0apps\desktop"
if not exist ".env" (
    echo VITE_SUPABASE_URL=http://localhost:54321> .env
    echo VITE_SUPABASE_ANON_KEY=>> .env
    echo       .env criado - edite com suas credenciais Supabase
    echo       Arquivo: apps\desktop\.env
)
echo       OK

echo [6/7] Liberando porta 1420...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING"') do (
    echo       Matando PID %%a na porta 1420...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 2 /nobreak >nul
)
echo       Porta livre

echo [7/7] Iniciando app...
echo.
cd /d "%~dp0apps\desktop"

if "!RUST_AVAILABLE!"=="1" (
    echo Modo: Tauri Desktop
    echo Primeira vez pode demorar uns minutos...
    echo.
    call npx tauri dev
) else (
    echo Modo: Navegador - http://localhost:1420
    echo.
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:1420"
    call npx vite --port 1420
)

echo.
echo App encerrado.
pause
endlocal
