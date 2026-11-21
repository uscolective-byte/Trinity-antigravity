[CmdletBinding()]
param(
  [switch]$PushToWorker,
  [ValidateSet('production','staging')][string]$Environment = 'production'
)
$ErrorActionPreference = 'Stop'

$secretsDir = Join-Path $PSScriptRoot '.secrets'
if (-not (Test-Path -LiteralPath $secretsDir)) {
  New-Item -ItemType Directory -Path $secretsDir -Force | Out-Null
}
$dpapiPath = Join-Path $secretsDir 'cloudflare-token.dpapi'

$secure = Read-Host 'Zadaj Cloudflare API Token (vstup je skryty)' -AsSecureString
if (-not $secure -or $secure.Length -eq 0) {
  throw 'Token nebol zadany.'
}

# Ulozi lokalne sifrovane cez Windows DPAPI (viazane na tvoj Windows ucet)
$encrypted = ConvertFrom-SecureString $secure
[IO.File]::WriteAllText($dpapiPath, $encrypted, [Text.Encoding]::UTF8)
Write-Host "Ulozene sifrovane (DPAPI): $dpapiPath"

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
  if (-not $plain) { throw 'Token je prazdny.' }

  # Overenie platnosti tokenu priamo proti Cloudflare API (token sa nevypisuje)
  $headers = @{ Authorization = "Bearer $plain" }
  $verify = Invoke-RestMethod -Uri 'https://api.cloudflare.com/client/v4/user/tokens/verify' -Headers $headers -TimeoutSec 10
  if ($verify.success -ne $true) {
    throw 'Cloudflare odmietol token pri overeni.'
  }
  Write-Host ("Cloudflare token overeny: status={0}, id={1}" -f $verify.result.status, $verify.result.id)

  if ($PushToWorker) {
    $trinityDir = Join-Path $PSScriptRoot 'Trinity'
    Push-Location $trinityDir
    try {
      if ($Environment -eq 'staging') {
        $plain | npx wrangler secret put CLOUDFLARE_API_TOKEN --env staging
      } else {
        $plain | npx wrangler secret put CLOUDFLARE_API_TOKEN
      }
      if ($LASTEXITCODE -ne 0) { throw "wrangler secret put skoncil s kodom $LASTEXITCODE" }
      Write-Host "CLOUDFLARE_API_TOKEN bol bezpecne nahrany do Trinity Worker ($Environment)."
    }
    finally {
      Pop-Location
    }
  }
}
finally {
  $plain = $null
  if ($ptr -and $ptr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}
