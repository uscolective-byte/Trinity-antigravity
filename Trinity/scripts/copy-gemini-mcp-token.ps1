$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credentialPath = Join-Path $root '.credentials\gemini-mcp.dpapi'
if (-not (Test-Path -LiteralPath $credentialPath)) { throw 'Gemini MCP credential is not provisioned.' }
$protected = (Get-Content -LiteralPath $credentialPath -Raw).Trim()
$secure = ConvertTo-SecureString $protected
$ptr = [IntPtr]::Zero
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  Set-Clipboard -Value $plain
  Write-Host 'Gemini MCP bearer token was copied to the clipboard. It was not printed.'
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $plain = $null
}
