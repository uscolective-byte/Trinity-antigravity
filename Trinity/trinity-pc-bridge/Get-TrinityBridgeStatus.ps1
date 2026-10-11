$ErrorActionPreference = 'Stop'
$BridgeScript = Join-Path $PSScriptRoot 'bridge.mjs'
$escaped = [regex]::Escape($BridgeScript)
$process = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match $escaped } |
  Select-Object -First 1
$outLog = Join-Path $PSScriptRoot 'logs\bridge.out.log'
$errLog = Join-Path $PSScriptRoot 'logs\bridge.err.log'

if ($process) {
  $connected = (Test-Path $outLog) -and ((Get-Content -LiteralPath $outLog -Raw -ErrorAction SilentlyContinue) -match 'Bridge pripojen')
  $message = if ($connected) {
    "ONLINE – Trinity je pripojená z tohto PC.`nProces: $($process.ProcessId)"
  } else {
    "SPÚŠŤA SA – PC Bridge beží, ale ešte nemá potvrdené spojenie.`nProces: $($process.ProcessId)"
  }
  $icon = 64
} else {
  $lastError = if (Test-Path $errLog) { (Get-Content -LiteralPath $errLog -Tail 2 -ErrorAction SilentlyContinue) -join "`n" } else { '' }
  $message = 'OFFLINE – Trinity nie je pripojená z tohto PC.'
  if ($lastError) { $message += "`n`nPosledná správa:`n$lastError" }
  $icon = 48
}

try {
  $shell = New-Object -ComObject WScript.Shell
  [void]$shell.Popup($message, 8, 'Stav Trinity PC', $icon)
} catch { Write-Host $message }

