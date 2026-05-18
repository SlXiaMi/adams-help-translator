@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo   Adams Help Translation - Setup
echo ========================================
echo.

echo [1/5] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
echo Node.js:
node --version

echo.
echo [2/5] Injecting redirect script...
node "%~dp0inject.js"
if errorlevel 1 (
    echo [ERROR] Injection failed. Run as Administrator.
    pause
    exit /b 1
)

echo.
echo [3/5] Creating launcher...
(
echo Set ws = CreateObject^("WScript.Shell"^)
echo ws.CurrentDirectory = "%~dp0"
echo ws.Run "cmd /c node ""%~dp0server.js"" ^>^> ""%~dp0server.log"" 2^>^&1", 0, False
) > "%~dp0launch_server.vbs"
echo launch_server.vbs created

echo.
echo [4/5] Setting up auto-start...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$lnk=[Environment]::GetFolderPath('Startup')+'\launch_server.lnk';$ws=New-Object -ComObject WScript.Shell;$s=$ws.CreateShortcut($lnk);$s.TargetPath='%~dp0launch_server.vbs';$s.WorkingDirectory='%~dp0';$s.Save()"
if errorlevel 1 (
    echo [ERROR] Failed to create startup shortcut.
    pause
    exit /b 1
)
echo Auto-start configured

echo.
echo [5/5] Starting service...
cscript //Nologo "%~dp0launch_server.vbs"
timeout /t 2 /nobreak >nul

echo.
if exist "%~dp0server.log" (
    echo Server log:
    type "%~dp0server.log"
) else (
    echo [WARN] No log file. Service may not have started.
)

echo.
echo ========================================
echo   Setup complete!
echo   Press F1 in Adams, help pages will
echo   auto-redirect. Click the Edge translate
echo   icon to translate to Chinese.
echo ========================================
pause
