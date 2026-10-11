$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credentialPath = Join-Path $root '.credentials\gemini-mcp.dpapi'
if (-not (Test-Path -LiteralPath $credentialPath)) { throw 'Gemini MCP credential is not provisioned.' }
$secure = ConvertTo-SecureString ((Get-Content -LiteralPath $credentialPath -Raw).Trim())
$ptr = [IntPtr]::Zero
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $headers = @{ Authorization = "Bearer $token"; Accept = 'application/json, text/event-stream' }
  $body = @{ jsonrpc='2.0'; id=1; method='initialize'; params=@{ protocolVersion='2025-03-26'; capabilities=@{}; clientInfo=@{ name='gemini-bridge-check'; version='1' } } } | ConvertTo-Json -Depth 8
  $response = Invoke-WebRequest -Uri 'https://auru.space/mcp' -Method Post -Headers $headers -ContentType 'application/json' -Body $body -UseBasicParsing
  if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'serverInfo') { throw 'Gemini MCP handshake did not return a valid server response.' }
  $listBody = @{ jsonrpc='2.0'; id=2; method='tools/list'; params=@{} } | ConvertTo-Json -Depth 4
  $list = Invoke-WebRequest -Uri 'https://auru.space/mcp' -Method Post -Headers $headers -ContentType 'application/json' -Body $listBody -UseBasicParsing
  if ($list.StatusCode -ne 200 -or $list.Content -notmatch 'request_project_action') { throw 'Gemini MCP tool catalog is incomplete.' }
  Write-Host 'Gemini MCP authentication, handshake, and project tool catalog are working.'
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $token = $null
}
