[CmdletBinding()]
param(
  [switch]$DisableAutoStart
)

$ErrorActionPreference = 'Stop'
$Desktop = [Environment]::GetFolderPath('Desktop')
$DesktopFolder = Join-Path $Desktop 'Trinity PC'
$Startup = [Environment]::GetFolderPath('Startup')
$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$Shell = New-Object -ComObject WScript.Shell

New-Item -ItemType Directory -Path $DesktopFolder -Force | Out-Null

# Odstráň staré odkazy vytvorené staršou inštaláciou s nesprávnym kódovaním.
$legacyNames = @(
  (Join-Path $Desktop 'PripojiĹĄ Trinity.lnk'),
  (Join-Path $DesktopFolder 'PripojiĹĄ Trinity.lnk'),
  (Join-Path $DesktopFolder 'OdpojiĹĄ Trinity.lnk'),
  (Join-Path $DesktopFolder 'ÄŚĂŤTAJ MA.txt')
)
foreach ($legacyPath in $legacyNames) {
  Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
}

function New-TrinityShortcut {
  param([string]$Path, [string]$Target, [string]$Arguments = '', [string]$Description = 'Trinity PC')
  $shortcut = $Shell.CreateShortcut($Path)
  $shortcut.TargetPath = $Target
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $PSScriptRoot
  $shortcut.Description = $Description
  $shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,15"
  $shortcut.Save()
}

$startArgs = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Start-TrinityBridge.ps1')`""
$stopArgs = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Stop-TrinityBridge.ps1')`""
$statusArgs = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Get-TrinityBridgeStatus.ps1')`""

New-TrinityShortcut -Path (Join-Path $Desktop 'Pripojiť Trinity.lnk') -Target $PowerShell -Arguments $startArgs -Description 'Pripojiť Trinity online a k tomuto PC'
New-TrinityShortcut -Path (Join-Path $DesktopFolder 'Pripojiť Trinity.lnk') -Target $PowerShell -Arguments $startArgs -Description 'Pripojiť Trinity online a k tomuto PC'
New-TrinityShortcut -Path (Join-Path $DesktopFolder 'Stav Trinity.lnk') -Target $PowerShell -Arguments $statusArgs -Description 'Zobraziť stav Trinity PC Bridge'
New-TrinityShortcut -Path (Join-Path $DesktopFolder 'Odpojiť Trinity.lnk') -Target $PowerShell -Arguments $stopArgs -Description 'Bezpečne odpojiť Trinity od tohto PC'
New-TrinityShortcut -Path (Join-Path $DesktopFolder 'Trinity Online.lnk') -Target "$env:SystemRoot\explorer.exe" -Arguments 'https://auru.space/' -Description 'Otvoriť Trinity Online'

$startupLink = Join-Path $Startup 'Trinity PC Bridge.lnk'
if ($DisableAutoStart) {
  Remove-Item -LiteralPath $startupLink -Force -ErrorAction SilentlyContinue
} else {
  New-TrinityShortcut -Path $startupLink -Target $PowerShell `
    -Arguments "$startArgs -NoDashboard -Silent" `
    -Description 'Automaticky pripojiť Trinity po prihlásení do Windows'
}

$readme = @'
TRINITY PC
==========

Pripojiť Trinity  – spustí zabezpečené spojenie s Trinity a otvorí online rozhranie.
Stav Trinity       – ukáže, či je PC Bridge online.
Odpojiť Trinity    – zastaví spojenie z tohto počítača.
Trinity Online     – otvorí webové rozhranie bez spustenia PC Bridge.

PC Bridge sa automaticky spustí po prihlásení do Windows. Pracuje iba v povolených
priečinkoch a rizikové zmeny zostávajú chránené schvaľovaním. Tajné kľúče nie sú
uložené na pracovnej ploche.
'@
Set-Content -LiteralPath (Join-Path $DesktopFolder 'ČÍTAJ MA.txt') -Value $readme -Encoding utf8

Write-Host "Trinity PC bola nainštalovaná na plochu: $DesktopFolder"

