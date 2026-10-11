[CmdletBinding()]
param([switch]$Silent)

$ErrorActionPreference = 'Stop'
$BridgeScript = Join-Path $PSScriptRoot 'bridge.mjs'
$escaped = [regex]::Escape($BridgeScript)
$processes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match $escaped })

foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'logs\bridge.pid') -Force -ErrorAction SilentlyContinue

if (-not $Silent) {
  $message = if ($processes.Count) { 'Trinity bola odpojená od tohto PC.' } else { 'Trinity PC Bridge už nebol spustený.' }
  try {
    $shell = New-Object -ComObject WScript.Shell
    [void]$shell.Popup($message, 5, 'Trinity PC', 64)
  } catch { Write-Host $message }
}

