$ErrorActionPreference = 'Stop'
$desktop = $PSScriptRoot
$repo = Split-Path -Parent $desktop
$data = Join-Path $desktop 'Data'
$gateway = Join-Path $repo 'Local-Gateway'
New-Item -ItemType Directory -Path $data -Force | Out-Null

function Get-Health([string]$url) {
  try { return Invoke-RestMethod -Uri $url -TimeoutSec 2 } catch { return $null }
}

$ollama = Get-Health 'http://127.0.0.1:11434/api/tags'
if (-not $ollama) {
  $ollamaExe = (Get-Command ollama.exe -ErrorAction SilentlyContinue).Source
  if (-not $ollamaExe) { $ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
  if (Test-Path -LiteralPath $ollamaExe) {
    Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 30 -and -not $ollama; $i++) { Start-Sleep -Seconds 1; $ollama = Get-Health 'http://127.0.0.1:11434/api/tags' }
  }
}
$ollamaModels = @($ollama.models | ForEach-Object { $_.name })
$modelReady = $ollamaModels -contains 'qwen3.5:4b'

$gatewayHealth = Get-Health 'http://127.0.0.1:8791/health'
if (-not $gatewayHealth) {
  $gatewayStart = Join-Path $gateway 'start.ps1'
  if (Test-Path -LiteralPath $gatewayStart) {
    $ps = Join-Path $PSHOME 'powershell.exe'
    Start-Process -FilePath $ps -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $gatewayStart + '"')) -WorkingDirectory $gateway -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'gateway-start.log') -RedirectStandardError (Join-Path $data 'gateway-error.log') | Out-Null
    for ($i = 0; $i -lt 30 -and -not $gatewayHealth; $i++) { Start-Sleep -Seconds 1; $gatewayHealth = Get-Health 'http://127.0.0.1:8791/health' }
  }
}

$launchFile = Join-Path $data 'launch.json'
$state = $null
if (Test-Path -LiteralPath $launchFile) {
  try {
    $candidate = Get-Content -LiteralPath $launchFile -Raw | ConvertFrom-Json
    $health = Get-Health ('http://127.0.0.1:' + [int]$candidate.port + '/health')
    if ($health.service -eq 'Trinity Local Desktop') { $state = $candidate }
  } catch { }
}
if (-not $state) {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $port = $null
  foreach ($candidatePort in 8795..8805) {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidatePort)
    try { $probe.Start(); $port = $candidatePort; break } catch { } finally { $probe.Stop() }
  }
  if (-not $port) { throw 'Nie je voľný port pre Trinity Local Desktop.' }
  $env:TRINITY_DESKTOP_PORT = [string]$port
  try {
    $process = Start-Process -FilePath $node -ArgumentList @('server.mjs') -WorkingDirectory $desktop -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'error.log')
  } finally { Remove-Item Env:\TRINITY_DESKTOP_PORT -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250; $process.Refresh()
    if ($process.HasExited) { throw 'Miestny panel sa nespustil. Pozri Local-Desktop\Data\error.log.' }
    try {
      $candidate = Get-Content -LiteralPath $launchFile -Raw | ConvertFrom-Json
      if ($candidate.pid -eq $process.Id -and (Get-Health ('http://127.0.0.1:' + [int]$candidate.port + '/health'))) { $state = $candidate; break }
    } catch { }
  }
}
if (-not $state) { throw 'Miestny panel nepotvrdil spustenie.' }

$gatewayText = if ($gatewayHealth) { 'spustená; cloud=' + $gatewayHealth.cloud + '; PC Bridge=' + $gatewayHealth.pc_bridge } else { 'nedostupná' }
$modelText = if ($modelReady) { 'Ollama qwen3.5:4b pripravený' } elseif ($ollama) { 'Ollama beží; qwen3.5:4b chýba' } else { 'Ollama nedostupná' }
Write-Host 'Trinity Local' -ForegroundColor Cyan
Write-Host ('Model: ' + $modelText)
Write-Host ('Lokálna brána: ' + $gatewayText)
Write-Host 'Súbory z Workspace a tebou vybrané prílohy môže Trinity spracovať.'
Write-Host 'Stav práce sa zobrazuje priebežne pod odpoveďou v chate.'
Write-Host 'Externé účty a ich oprávnenia sa zobrazujú v sekcii Prepojenia.'
Start-Process $state.url
