@echo off
title Trinity PC Bridge 7777
cd /d "%~dp0"
echo ==========================================================
echo   TRINITY ANTIGRAVITY PC BRIDGE (PORT 7777)
echo ==========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Trinity\trinity-tools\start-powershell-bridge.ps1"
pause
