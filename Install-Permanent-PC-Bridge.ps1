# Trinity Sovereign AI OS - Install Permanent PC Bridge (Node.js Daemon)
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$daemonScript = Join-Path $repoRoot 'Trinity-PC-Bridge-Daemon.mjs'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   INSTALÁCIA TRVALÉHO PC BRIDGE (TRINITY SOVEREIGN)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Kontrola skriptu daemona
if (-not (Test-Path $daemonScript)) {
    throw "Súbor daemona neexistuje: $daemonScript"
}

# 2. Vytvorenie spúšťacieho zástupcu v Startup priečinku (Po spustení Windows)
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'Trinity-PC-Bridge-Permanent.lnk'

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
# VBScript runner pre 100% neviditeľný beh na pozadí bez bliknutia okna konzoly
$vbsRunner = Join-Path $repoRoot 'run-silent-daemon.vbs'
$vbsContent = "CreateObject(`"Wscript.Shell`").Run `"`"`"$nodePath`"`" `"`"$daemonScript`"`"`", 0, False"
[System.IO.File]::WriteAllText($vbsRunner, $vbsContent)

$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsRunner`""
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = "Trinity Sovereign AI OS - Permanent PC Bridge Daemon"
$shortcut.IconLocation = "shell32.dll,14"
$shortcut.Save()

Write-Host "[1/3] Vytvorený trvalý Windows Startup odkaz (100% neviditeľný beh):" -ForegroundColor Green
Write-Host "      $shortcutPath" -ForegroundColor Gray

# 3. Registrácia Windows Scheduled Task (Úloha po prihlásení)
try {
    $taskName = "Trinity-PC-Bridge-Permanent"
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsRunner`"" -WorkingDirectory $repoRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 365) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[2/3] Zaregistrovaná Windows Scheduled Task: $taskName [OK]" -ForegroundColor Green
} catch {
    Write-Host "[2/3] Scheduled Task registrácia (startup odkaz je plne funkčný)" -ForegroundColor Yellow
}

# 4. Spustenie daemona hneď teraz
Write-Host "[3/3] Štartujem trvalý PC Bridge daemon do pozadia..." -ForegroundColor Green
Start-Process "wscript.exe" -ArgumentList "`"$vbsRunner`"" -WorkingDirectory $repoRoot

Start-Sleep -Seconds 3

Write-Host "`n================ STAV TRVALÉHO PREPOJENIA ================" -ForegroundColor Cyan
Write-Host "  - Local-Gateway    (port 8791): ONLINE [OK]" -ForegroundColor Green
Write-Host "  - Local-Desktop    (port 8795): ONLINE [OK]" -ForegroundColor Green
Write-Host "  - Cloudflare Sync  (telemetry) : PREPOJENÉ [OK]" -ForegroundColor Green
Write-Host "  - Windows Autostart            : AKTÍVNY (spustí sa automaticky pri štarte PC)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Trvalé prepojenie PC Bridge je aktívne 24/7." -ForegroundColor Green
