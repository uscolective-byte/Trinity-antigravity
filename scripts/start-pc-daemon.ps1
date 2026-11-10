[CmdletBinding()]
param(
  [string]$TrinityUrl = 'https://auru.space',
  [switch]$Staging,
  [switch]$Once,
  [int]$PollInterval = 4000
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

if ($Staging) {
  $TrinityUrl = 'https://auru.dev'
}

function Read-ProtectedToken([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $secure = ConvertTo-SecureString ((Get-Content -LiteralPath $path -Raw).Trim())
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { if ($ptr -and $ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) } }
}

# Hľadanie DPAPI kľúča (produkčný aj staging)
$dpapiCandidates = @(
  (Join-Path $root 'Local-Gateway\.credentials\gateway-key.dpapi'),
  (Join-Path $root 'Local-Gateway\.credentials\gateway-key-development.dpapi'),
  (Join-Path $root 'Local-Desktop\.credentials\gateway-key.dpapi')
)

$loadedKey = $false
foreach ($dpapiPath in $dpapiCandidates) {
  if (Test-Path -LiteralPath $dpapiPath) {
    $token = Read-ProtectedToken $dpapiPath
    if ($token) {
      $env:TRINITY_GATEWAY_KEY = $token
      Write-Host "[TRINITY PC DAEMON] Načítaný zabezpečený DPAPI kľúč z: $dpapiPath" -ForegroundColor Green
      $loadedKey = $true
      break
    }
  }
}

if (-not $loadedKey) {
  Write-Host "[TRINITY PC DAEMON] DPAPI kľúč nenájdený v .credentials, bežím v telemetrickom režime." -ForegroundColor Yellow
}

$env:TRINITY_URL = $TrinityUrl
$env:POLL_INTERVAL = [string]$PollInterval

Write-Host "[TRINITY PC DAEMON] Spúšťam daemona pre $TrinityUrl (Interval: ${PollInterval}ms)..." -ForegroundColor Cyan

$daemonScript = Join-Path $root 'scripts\trinity-pc-daemon.mjs'
if ($Once) {
  node $daemonScript --once
} else {
  node $daemonScript
}
