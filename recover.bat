@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo   Adams Help Translation - Recovery
echo ========================================
echo.

echo [1/4] Recovering help files...
node recover.js
if errorlevel 1 (
    echo [ERROR] Recovery failed. Run as Administrator.
    pause
    exit /b 1
)

echo.
echo [2/4] Stopping service...
if exist server.pid (
    set /p PID=<server.pid
    tasklist /FI "PID eq !PID!" /FI "IMAGENAME eq node.exe" 2>NUL | find /I "node.exe" >NUL
    if !errorlevel! equ 0 (
        taskkill /F /PID !PID! >nul 2>&1
        echo Service PID=!PID! stopped
    ) else (
        echo PID=!PID! is not a running node.exe, skipped
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
echo [3/4] Removing auto-start...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\launch_server.lnk" (
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\launch_server.lnk"
    echo Auto-start removed
) else (
    echo No startup shortcut found, skipped
)

echo.
echo [4/4] Removing legacy python auto-start...
schtasks /Query /TN "AdamsHelpTranslator" >nul 2>&1
if errorlevel 1 (
    echo No legacy python task found, skipped.
) else (
    schtasks /End /TN "AdamsHelpTranslator" >nul 2>&1
    schtasks /Delete /TN "AdamsHelpTranslator" /F >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Could not remove the legacy task automatically.
        echo        Please delete "AdamsHelpTranslator" in Task Scheduler.
    ) else (
        echo Legacy python task removed.
    )
)

echo.
echo ========================================
echo   Recovery complete!
echo ========================================
pause
