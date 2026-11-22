@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Bitte zuerst setup.ps1 ausfuehren.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -B -m b1teacher --open
if errorlevel 1 pause
