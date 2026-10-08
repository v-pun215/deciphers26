@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ███╗   ███╗ █████╗ ████████╗███████╗██████╗  ██████╗
echo ████╗ ████║██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██╔════╝
echo ██╔████╔██║███████║   ██║   ███████╗██║   ██║██║     
echo ██║╚██╔╝██║██╔══██║   ██║   ╚════██║██║   ██║██║     
echo ██║ ╚═╝ ██║██║  ██║   ██║   ███████║╚██████╔╝╚██████╗
echo ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚═════╝  ╚═════╝

:: Change working directory to current script directory
cd /d "%~dp0"

:: Set default environment variables if not already set
if "%BACKEND_BASE%"=="" set "BACKEND_BASE=http://127.0.0.1:8080"
if "%BOT_HOST%"=="" set "BOT_HOST=127.0.0.1"
if "%BOT_PORT%"=="" set "BOT_PORT=5555"
if "%BOT_SERVICE_URL%"=="" set "BOT_SERVICE_URL=http://127.0.0.1:%BOT_PORT%"



set "RUN_DIR=.run"
if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"
if exist "%RUN_DIR%\main.pid" (
    for /f %%I in (%RUN_DIR%\main.pid) do set "OLD_MAIN_PID=%%I"
    if defined OLD_MAIN_PID (
        tasklist /fi "PID eq !OLD_MAIN_PID!" /fi "IMAGENAME eq intrasudo26.exe" 2>NUL | find /I "!OLD_MAIN_PID!" >nul
        if not errorlevel 1 (
            echo Stopping previous main application process !OLD_MAIN_PID!
            taskkill /F /PID !OLD_MAIN_PID! >nul 2>&1
            timeout /t 1 >nul
        )
    )
)
if exist "%RUN_DIR%\main.pid" del /q "%RUN_DIR%\main.pid"
if exist "%RUN_DIR%\bot.pid" del /q "%RUN_DIR%\bot.pid"

:: Use the event schedule in .env instead of stale inherited shell values.
set "EVENT_START_UNIX="
set "EVENT_END_UNIX="
set "DEV_TEMPLATES=1"

echo Building main application
go build -o "intrasudo26.exe" .
if errorlevel 1 (
    echo [ERROR] Failed to build main application.
    exit /b 1
)

echo Starting main application
start /b "" "intrasudo26.exe"

:: Allow process time to initialize
timeout /t 1 >nul

:: Retrieve PID accurately using PowerShell
for /f %%I in ('powershell -NoProfile -Command "(Get-Process -Name 'intrasudo26' -ErrorAction SilentlyContinue | Select-Object -First 1).Id"') do set "MAIN_PID=%%I"

if "%MAIN_PID%"=="" (
    echo [ERROR] Main application process not found in task manager.
    echo Check log output in %RUN_DIR%\main.log:
    type "%RUN_DIR%\main.log"
    goto :cleanup
)

tasklist /fi "PID eq %MAIN_PID%" 2>NUL | find /I "%MAIN_PID%" >nul
if errorlevel 1 (
    echo [ERROR] Main application crashed on startup.
    echo Output log:
    type "%RUN_DIR%\main.log"
    goto :cleanup
)

echo %MAIN_PID% > "%RUN_DIR%\main.pid"

:: Check for python installation (python or python3)
where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
) else (
    where python3 >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=python3"
    ) else (
        set "PYTHON_CMD="
    )
)

if defined PYTHON_CMD (
    echo Starting discord bot
    set "PYTHONUNBUFFERED=1"
    start /b "" %PYTHON_CMD% bot.py > "%RUN_DIR%\bot.log" 2>&1
    
    timeout /t 1 >nul
    
    for /f %%I in ('powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"Name LIKE '%%python%%' AND CommandLine LIKE '%%bot.py%%'\" | Select-Object -First 1).ProcessId"') do set "BOT_PID=%%I"
    
    if defined BOT_PID (
        echo !BOT_PID! > "%RUN_DIR%\bot.pid"
    ) else (
        echo Discord bot failed to start or immediately exited.
        echo Output log:
        type "%RUN_DIR%\bot.log"
    )
) else (
    echo python not found; discord bot not started
    set "BOT_PID=not started"
)

echo All services started:
echo Main App PID: %MAIN_PID%
echo Discord Bot PID: %BOT_PID%
echo Website: http://127.0.0.1:8080/
echo running
echo Press Ctrl+C or close this window to stop all services.

:: Monitor running process and wait for user interruption
:loop
timeout /t 2 >nul
tasklist /fi "PID eq %MAIN_PID%" 2>NUL | find /I "%MAIN_PID%" >nul
if errorlevel 1 (
    echo Main application stopped unexpectedly.
    goto :cleanup
)
goto :loop

:cleanup
echo Stopping all services...
if defined MAIN_PID (
    taskkill /F /PID %MAIN_PID% >nul 2>&1
)
if defined BOT_PID (
    if not "%BOT_PID%"=="not started" (
        taskkill /F /PID %BOT_PID% >nul 2>&1
    )
)
if exist "%RUN_DIR%\main.pid" del /q "%RUN_DIR%\main.pid"
if exist "%RUN_DIR%\bot.pid" del /q "%RUN_DIR%\bot.pid"
echo All services stopped.
exit /b 0
