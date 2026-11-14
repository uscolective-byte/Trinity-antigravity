@echo off
title Trinity Sovereign AI OS - Zastavenie PC Bridge
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'Zastavujem PC Bridge procesy...' -ForegroundColor Yellow; Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%%Trinity-PC-Bridge-Daemon%%' OR CommandLine LIKE '%%start-powershell-bridge%%'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host 'PC Bridge procesy boli zastavene.' -ForegroundColor Green"
echo.
pause
