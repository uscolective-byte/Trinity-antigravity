[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('copilot','gemini','ollama')][string]$Client
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$slug = "$Client-mcp"
$credentialDir = Join-Path $root '.credentials'
$credentialPath = Join-Path $credentialDir "$slug.dpapi"
$displayName = (Get-Culture).TextInfo.ToTitleCase($Client) + ' MCP Bridge'
if (Test-Path -LiteralPath $credentialPath) { throw "$displayName credential already exists. Revoke it before intentional replacement." }

$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$material = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$secret = "trn_live_$material"
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($secret)) } finally { $sha.Dispose() }
$hash = -join ($digest | ForEach-Object { $_.ToString('x2') })
$id = [Guid]::NewGuid().ToString()
$prefix = $secret.Substring(0,17)
$owner = 'saboivan2008@gmail.com'
$expires = [DateTimeOffset]::UtcNow.AddDays(90).ToString('yyyy-MM-dd HH:mm:ss')
$safeName = $displayName.Replace("'","''")
$sql = "INSERT INTO ops_api_access_keys(id,owner_id,name,key_hash,key_prefix,scopes_json,rate_limit_per_minute,status,expires_at) VALUES('$id','$owner','$safeName','$hash','$prefix',json_array('mcp:read','mcp:write'),60,'active','$expires');"

Push-Location $root
try {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & npx.cmd wrangler d1 execute trinity-v03 --remote --command $sql 2>&1
  $wranglerExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($wranglerExitCode -ne 0) { throw "Cloudflare D1 refused the credential (exit $wranglerExitCode)." }
  New-Item -ItemType Directory -Path $credentialDir -Force | Out-Null
  $protected = ConvertFrom-SecureString (ConvertTo-SecureString $secret -AsPlainText -Force)
  Set-Content -LiteralPath $credentialPath -Value $protected -NoNewline
  Write-Host "$displayName is active in D1 and protected locally with Windows DPAPI. Its value was not printed."
} finally {
  Pop-Location
  $secret = $null
  [Array]::Clear($bytes,0,$bytes.Length)
}
