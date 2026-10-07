@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo   Adams Help Translation - Setup
echo ========================================
echo.

echo [1/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
echo Node.js:
node --version

rem Resolve the absolute node path, so the logon launcher does not depend on PATH
set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE set "NODE_EXE=node"

echo.
echo [2/6] Removing legacy python auto-start...
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
        echo Legacy python task removed - no console window at boot.
    )
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*AdamsHelpTranslator*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo [3/6] Injecting redirect script...
node "%~dp0inject.js"
if errorlevel 1 (
    echo [ERROR] Injection failed. Run as Administrator.
    pause
    exit /b 1
)

echo.
echo [4/6] Creating launcher...
(
echo Set ws = CreateObject^("WScript.Shell"^)
echo ws.CurrentDirectory = "%~dp0"
echo ws.Run """!NODE_EXE!"" ""%~dp0server.js""", 0, False
) > "%~dp0launch_server.vbs"
echo launch_server.vbs created

echo.
echo [5/6] Setting up auto-start...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$lnk=[Environment]::GetFolderPath('Startup')+'\launch_server.lnk';$ws=New-Object -ComObject WScript.Shell;$s=$ws.CreateShortcut($lnk);$s.TargetPath='%~dp0launch_server.vbs';$s.WorkingDirectory='%~dp0';$s.Save()"
if errorlevel 1 (
    echo [ERROR] Failed to create startup shortcut.
    pause
    exit /b 1
)
echo Auto-start configured

echo.
echo [6/6] Starting service...
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
echo Verifying service on port 8777...
powershell -NoProfile -Command "$ok=$false; for($i=1;$i -le 6;$i++){ try{ $r=Invoke-WebRequest 'http://127.0.0.1:8777/__health' -UseBasicParsing -TimeoutSec 5; if($r.StatusCode -eq 200){ $ok=$true; break } }catch{ Start-Sleep -Seconds 2 } }; if($ok){ Write-Host '[OK] Service is responding at http://localhost:8777' -ForegroundColor Green } else { Write-Host '[ERROR] Service is NOT responding on port 8777.' -ForegroundColor Red; Write-Host '        Run recover.bat as Administrator, then run setup.bat again.' -ForegroundColor Red; Write-Host '        Also make sure nothing else is listening on port 8777.' -ForegroundColor Red }"
set "VERIFY_FAILED=0"
if errorlevel 1 set "VERIFY_FAILED=1"

echo.
echo ========================================
if "!VERIFY_FAILED!"=="1" (
    echo   Setup finished, but the service check FAILED - see above
) else (
    echo   Setup complete!
)
echo   Press F1 in Adams, help pages will
echo   auto-redirect. Click the Edge translate
echo   icon to translate to Chinese.
echo ========================================
pause
