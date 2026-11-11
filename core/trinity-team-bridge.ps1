# trinity-team-bridge.ps1
# Zjednoteny komunikacny a diagnosticky nastroj pre Codex, Antigravity a Basterixa.
# Dodrziava bezpecnostny protokol CODEX-ANTIGRAVITY-PROTOCOL.md (ziadne vypisovanie klucov).

param(
  [ValidateSet('status', 'read-handoff', 'test-local-mcp', 'test-remote-mcp', 'sync')][string]$Action = 'status',
  [string]$RepoPath = 'C:\Users\saboi\Trinity-antigravity'
)

$ErrorActionPreference = 'Stop'

function Get-SharedEnvStatus {
  $envScript = Join-Path $RepoPath 'scripts\shared-env.ps1'
  if (Test-Path -LiteralPath $envScript) {
    & powershell -NoProfile -File $envScript -Check
  } else {
    Write-Output "shared-env.ps1 NOT FOUND"
  }
}

function Show-LatestHandoff {
  $handoffFile = Join-Path $RepoPath 'TEAM-HANDOFF.md'
  if (Test-Path -LiteralPath $handoffFile) {
    Write-Output "=== POSLEDNE ZAZNAMY V TEAM-HANDOFF.MD ==="
    Get-Content -LiteralPath $handoffFile -Tail 35
  } else {
    Write-Output "TEAM-HANDOFF.md NOT FOUND"
  }
}

function Test-LocalBridge {
  Write-Output "=== TEST LOKALNEHO TRINITY-LOCAL MCP MOSTA ==="
  $bridgeScript = Join-Path $RepoPath 'trinity-mcp-bridge\server.mjs'
  if (-not (Test-Path -LiteralPath $bridgeScript)) {
    Write-Output "Bridge server.mjs nenajdeny."
    return
  }
  
  try {
    $procInfo = New-Object System.Diagnostics.ProcessStartInfo
    $procInfo.FileName = "node"
    $procInfo.Arguments = "$bridgeScript"
    $procInfo.EnvironmentVariables["MCP_STDIO"] = "true"
    $procInfo.EnvironmentVariables["TRINITY_WORKSPACE"] = $RepoPath
    $procInfo.RedirectStandardInput = $true
    $procInfo.RedirectStandardOutput = $true
    $procInfo.RedirectStandardError = $true
    $procInfo.UseShellExecute = $false
    $procInfo.CreateNoWindow = $true

    $p = [System.Diagnostics.Process]::Start($procInfo)
    $initJson = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"bridge-verifier","version":"1.0"}}}' + "`n"
    $p.StandardInput.WriteLine($initJson)
    
    $out = $p.StandardOutput.ReadLine()
    $p.Kill()
    if ($out -match 'serverInfo') {
      Write-Output "Lokalny stdio MCP most: FUNGUJE (serverInfo prijaté)"
    } else {
      Write-Output "Lokalny stdio MCP most: $out"
    }
  } catch {
    Write-Output "Chyba pri teste lokalneho mosta: $($_.Exception.Message)"
  }
}

function Test-RemoteGateway {
  Write-Output "=== TEST VZDIALENEJ TRINITY MCP BRANY (auru.space) ==="
  $token = [Environment]::GetEnvironmentVariable('TRINITY_MCP_API_KEY', 'User')
  if (-not $token) {
    $envFile = Join-Path $HOME '.env'
    if (Test-Path $envFile) {
      $match = (Get-Content $envFile | Select-String 'TRINITY_MCP_API_KEY=(.*)').Matches
      if ($match) { $token = $match.Groups[1].Value.Trim() }
    }
  }

  if (-not $token) {
    Write-Output "TRINITY_MCP_API_KEY nie je dostupny."
    return
  }

  try {
    $headers = @{
      Authorization = "Bearer $token"
      Accept = "application/json, text/event-stream"
      "Content-Type" = "application/json"
    }
    $body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"remote-check","version":"1.0"}}}'
    $res = Invoke-WebRequest -Uri "https://auru.space/mcp" -Method Post -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
    Write-Output "Vzdialena brana HTTP Status: $($res.StatusCode)"
  } catch {
    Write-Output "Vzdialeny endpoint: $($_.Exception.Message)"
  }
}

switch ($Action) {
  'status' {
    Write-Output "--- TRINITY TEAM BRIDGE STATUS ---"
    Write-Output "Kanonicka cesta: $RepoPath (Platna: $(Test-Path $RepoPath))"
    Write-Output "`n--- KLUCE (BEZPECNE OVERENIE) ---"
    Get-SharedEnvStatus
    Write-Output "`n"
    Test-LocalBridge
    Write-Output "`n"
    Show-LatestHandoff
  }
  'read-handoff' { Show-LatestHandoff }
  'test-local-mcp' { Test-LocalBridge }
  'test-remote-mcp' { Test-RemoteGateway }
  'sync' {
    $syncScript = Join-Path $RepoPath 'scripts\codex-antigravity-sync.ps1'
    if (Test-Path $syncScript) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $syncScript
    } else {
      Write-Output "Sync script nenajdeny."
    }
  }
}
