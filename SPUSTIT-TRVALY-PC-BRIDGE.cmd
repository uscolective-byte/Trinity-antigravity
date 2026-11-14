@echo off
title Trinity Sovereign AI OS - Instalacia Trvaleho PC Bridge
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Permanent-PC-Bridge.ps1"
echo.
pause
