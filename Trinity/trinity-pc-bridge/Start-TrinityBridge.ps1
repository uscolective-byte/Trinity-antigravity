[CmdletBinding()]
param(
  [switch]$NoDashboard,
  [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$BridgeRoot = $PSScriptRoot
$BridgeScript = Join-Path $BridgeRoot 'bridge.mjs'
$EnvFile = Join-Path $BridgeRoot '.env'
$LogDir = Join-Path $BridgeRoot 'logs'
$OutLog = Join-Path $LogDir 'bridge.out.log'
$ErrLog = Join-Path $LogDir 'bridge.err.log'
$PidFile = Join-Path $LogDir 'bridge.pid'
$Dashboard = 'https://auru.space/'

function Show-Result([string]$Message, [string]$Title = 'Trinity PC') {
  if ($Silent) { return }
  try {
    $shell = New-Object -ComObject WScript.Shell
    [void]$shell.Popup($Message, 6, $Title, 64)
  } catch {
    Write-Host $Message
  }
}

function Get-BridgeProcess {
  $escaped = [regex]::Escape($BridgeScript)
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match $escaped } |
    Select-Object -First 1
}

if (-not (Test-Path -LiteralPath $BridgeScript)) {
  throw "Chýba PC Bridge: $BridgeScript"
}
if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw 'Chýba lokálna konfigurácia .env. Tajné hodnoty sa nesmú ukladať do odkazu na ploche.'
}
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  throw 'Node.js nie je nainštalovaný alebo nie je dostupný v PATH.'
}

$existing = Get-BridgeProcess
if ($existing) {
  Set-Content -LiteralPath $PidFile -Value $existing.ProcessId -Encoding ascii
  Show-Result "Trinity je už pripojená z tohto PC.`nProces: $($existing.ProcessId)"
  if (-not $NoDashboard) { Start-Process $Dashboard }
  exit 0
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
Set-Content -LiteralPath $OutLog -Value '' -Encoding utf8
Set-Content -LiteralPath $ErrLog -Value '' -Encoding utf8

$process = Start-Process -FilePath $NodePath `
  -ArgumentList @($BridgeScript) `
  -WorkingDirectory $BridgeRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -PassThru
Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ascii

$connected = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) { break }
  if ((Test-Path $OutLog) -and (Get-Content -LiteralPath $OutLog -Raw -ErrorAction SilentlyContinue) -match 'Bridge pripojen') {
    $connected = $true
    break
  }
}

if ($connected) {
  Show-Result "Trinity je pripojená online aj k tomuto PC.`nProces: $($process.Id)"
} elseif ($process.HasExited) {
  $detail = (Get-Content -LiteralPath $ErrLog -Tail 3 -ErrorAction SilentlyContinue) -join "`n"
  if (-not $detail) { $detail = 'PC Bridge sa neočakávane ukončil.' }
  Show-Result $detail 'Trinity PC – pripojenie zlyhalo'
  exit 1
} else {
  Show-Result "PC Bridge beží, ale server zatiaľ nepotvrdil spojenie.`nSkontroluj stav o chvíľu."
}

if (-not $NoDashboard) { Start-Process $Dashboard }

