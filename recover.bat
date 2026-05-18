@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo   Adams Help Translation - Recovery
echo ========================================
echo.

echo [1/3] Recovering help files...
node recover.js
if errorlevel 1 (
    echo [ERROR] Recovery failed. Run as Administrator.
    pause
    exit /b 1
)

echo.
echo [2/3] Stopping service...
if exist server.pid (
    set /p PID=<server.pid
    tasklist /FI "PID eq !PID!" 2>NUL | find /I "!PID!" >NUL
    if !errorlevel! equ 0 (
        taskkill /F /PID !PID! >nul 2>&1
        echo Service PID=!PID! stopped
    ) else (
        echo PID=!PID! not running, skipped
    )
    del server.pid
) else (
    echo No server.pid found, checking port...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":8777" ^| findstr /c:"LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
        echo Port 8777 process %%a stopped
    )
)

echo.
echo [3/3] Removing auto-start...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\launch_server.lnk" (
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\launch_server.lnk"
    echo Auto-start removed
) else (
    echo No startup shortcut found, skipped
)

echo.
echo ========================================
echo   Recovery complete!
echo ========================================
pause
