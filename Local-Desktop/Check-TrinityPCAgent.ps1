# Checks the real local agent. Never reports a Cloudflare connection.
[CmdletBinding()]
param([ValidateRange(1024,65535)][int]$Port=8788)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$tokenFile=Join-Path $HOME '.trinity-pc-agent\local-token'
if (!(Test-Path -LiteralPath $tokenFile -PathType Leaf)) {
  throw "Local agent token missing. Start the agent first."
}
$token=(Get-Content -LiteralPath $tokenFile -Raw).Trim()
if ($token.Length -lt 40) { throw 'Invalid local token' }
$uri="http://127.0.0.1:$Port/v1/status"
try {
  $result=Invoke-RestMethod -Uri $uri -Method Get -Headers @{
    Authorization="Bearer $token"
  } -TimeoutSec 5
} catch {
  throw "Agent not reachable/authenticated at 127.0.0.1:$Port : $($_.Exception.Message)"
}
if ($result.ok -ne $true -or $result.agent -ne 'local' -or
    $result.remoteExecutionEnabled -ne $false -or
    $result.connectedToCloudflare -ne $false) {
  throw 'Unexpected agent response; no success asserted'
}
[pscustomobject]@{
  LocalAgentVerified=$true
  Endpoint=$uri
  InstallerPresent=$result.installerExists
  CloudflareConnected=$false
  RemoteExecutionEnabled=$false
  VerifiedAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 4
