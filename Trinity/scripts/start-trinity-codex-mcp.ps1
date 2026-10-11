[CmdletBinding()]
param([ValidatePattern('^[a-z0-9-]+$')][string]$CredentialName = 'gemini-mcp')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credentialPath = Join-Path $root ".credentials\$CredentialName.dpapi"
if (-not (Test-Path -LiteralPath $credentialPath)) { throw "Trinity MCP credential '$CredentialName' is not provisioned." }
$protected = (Get-Content -LiteralPath $credentialPath -Raw).Trim()
$secure = ConvertTo-SecureString $protected
$ptr = [IntPtr]::Zero
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:TRINITY_MCP_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:TRINITY_MCP_URL = 'https://auru.space'
  Set-Location $root
  node scripts/trinity-codex-mcp.mjs
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Remove-Item Env:\TRINITY_MCP_TOKEN -ErrorAction SilentlyContinue
}
