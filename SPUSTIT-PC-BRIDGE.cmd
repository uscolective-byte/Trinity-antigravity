@echo off
title Trinity Sovereign AI OS - PC Bridge
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Trinity-PC-Bridge.ps1"
echo.
pause
