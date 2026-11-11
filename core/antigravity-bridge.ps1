# Trinity -> Antigravity bridge using Antigravity's bundled agentapi.
# Does not read credentials or change Antigravity configuration.
param(
  [ValidateSet('status','new','send')][string]$Action = 'status',
  [string]$Message = '',
  [string]$RecipientId = ''
)
$ErrorActionPreference = 'Stop'
$agentApi = Join-Path $env:USERPROFILE '.gemini\antigravity\bin\agentapi.bat'
if (-not (Test-Path -LiteralPath $agentApi)) {
  Write-Error 'ANTIGRAVITY_AGENTAPI_NOT_FOUND'
  exit 2
}
if (-not $env:ANTIGRAVITY_LS_ADDRESS) {
  Write-Error 'ANTIGRAVITY_LS_ADDRESS_MISSING: run from an Antigravity terminal session with its supported agent API environment.'
  exit 3
}
if ($Action -eq 'status') {
  Write-Output ('ANTIGRAVITY_AGENTAPI_CONFIGURED at ' + $env:ANTIGRAVITY_LS_ADDRESS)
  & $agentApi --help
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
