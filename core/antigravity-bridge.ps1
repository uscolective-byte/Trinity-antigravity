# Trinity -> Antigravity bridge using Antigravity's bundled agentapi.
# Does not read credentials or change Antigravity configuration.
param(
  [ValidateSet('status','verify','new','send')][string]$Action = 'status',
  [string]$Message = '',
  [string]$RecipientId = ''
)
$ErrorActionPreference = 'Stop'
$agentApi = Join-Path $env:USERPROFILE '.gemini\antigravity\bin\agentapi.bat'
$apiPresent = Test-Path -LiteralPath $agentApi -PathType Leaf
$sessionConfigured = -not [string]::IsNullOrWhiteSpace($env:ANTIGRAVITY_LS_ADDRESS)
if ($Action -eq 'status') {
  $status = if (!$apiPresent) {'agentapi_missing'} elseif (!$sessionConfigured) {'session_missing'} else {'configured_not_verified'}
  [pscustomobject]@{
    tool = 'antigravity'
    status = $status
    agent_api_present = $apiPresent
    session_configured = $sessionConfigured
    connection_verified = $false
  } | ConvertTo-Json -Compress
  exit 0
}
if (!$apiPresent) { Write-Error 'ANTIGRAVITY_AGENTAPI_NOT_FOUND'; exit 2 }
if (!$sessionConfigured) {
  Write-Error 'ANTIGRAVITY_LS_ADDRESS_MISSING: run from an Antigravity terminal session with its supported agent API environment.'
  exit 3
}
if ($Action -eq 'verify') {
  if (!$RecipientId.Trim()) { Write-Error 'RECIPIENT_ID_REQUIRED'; exit 5 }
  & $agentApi get-conversation-metadata $RecipientId
  exit $LASTEXITCODE
}
if (-not $Message.Trim()) { Write-Error 'MESSAGE_REQUIRED'; exit 4 }
if ($Action -eq 'new') {
  & $agentApi new-conversation --title=Trinity-ChatGPT-Bridge $Message
  exit $LASTEXITCODE
}
if (-not $RecipientId.Trim()) { Write-Error 'RECIPIENT_ID_REQUIRED'; exit 5 }
& $agentApi send-message $RecipientId $Message
exit $LASTEXITCODE
