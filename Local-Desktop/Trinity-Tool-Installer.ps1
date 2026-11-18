# Trinity local Windows tool installer. Never invoked by Cloudflare automatically.
# Dry-run by default; install requires an interactive operator and -Approve.
[CmdletBinding()]
param(
  [ValidateSet('List','Inspect','Install')][string]$Action = 'List',
  [ValidateSet('Git','NodeJS','Python','Ollama')][string]$Tool = 'Git',
  [switch]$Approve
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$catalog = @{
  Git    = @{ Id='Git.Git';          Command='git.exe';    Args=@('--version') }
  NodeJS = @{ Id='OpenJS.NodeJS.LTS'; Command='node.exe';  Args=@('--version') }
  Python = @{ Id='Python.Python.3.13';Command='python.exe';Args=@('--version') }
  Ollama = @{ Id='Ollama.Ollama';    Command='ollama.exe'; Args=@('--version') }
}
function Probe([string]$name) {
  $item = $catalog[$name]
  $cmd = Get-Command $item.Command -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) {
    return @{ tool=$name; package=$item.Id; status='not_detected'; verified=$false }
  }
  try {
    $output = (& $cmd.Source @($item.Args) 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($output)) {
      return @{ tool=$name; package=$item.Id; status='probe_failed'; verified=$false }
    }
    return @{ tool=$name; package=$item.Id; status='verified_local'; verified=$true; executable=$cmd.Source; versionOutput=$output.Substring(0,[Math]::Min(180,$output.Length)) }
  } catch {
    return @{ tool=$name; package=$item.Id; status='probe_failed'; verified=$false }
  }
}
if ($Action -eq 'List') {
  @('Git','NodeJS','Python','Ollama') | ForEach-Object { Probe $_ | ConvertTo-Json -Compress }
  exit 0
}
if ($Action -eq 'Inspect') {
  Probe $Tool | ConvertTo-Json -Compress
  exit 0
}
if (-not $Approve) {
  @{ tool=$Tool; package=$catalog[$Tool].Id; status='approval_required'; installed=$false; command='Re-run with -Action Install -Tool <name> -Approve in a local terminal' } | ConvertTo-Json -Compress
  exit 2
}
if (-not [Environment]::UserInteractive) { throw 'Interactive operator session required for installation' }
$existing = Probe $Tool
if ($existing.verified) {
  $existing.status = 'already_installed_verified'
  $existing | ConvertTo-Json -Compress
  exit 0
}
$winget = Get-Command winget.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $winget) { throw 'winget.exe not found; no installation attempted' }
$packageId = $catalog[$Tool].Id
Write-Host "Installing verified catalog entry $Tool ($packageId) with winget; system prompts may appear."
# Do not accept arbitrary package IDs, URLs, shell expressions or model-provided flags.
& $winget.Source install --id $packageId --exact --source winget --disable-interactivity --accept-package-agreements --accept-source-agreements
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  @{ tool=$Tool; package=$packageId; status='installer_failed'; installed='unknown'; exitCode=$exitCode } | ConvertTo-Json -Compress
  exit 1
}
# PATH may not refresh in this process. Do not report success without probing.
$observed = Probe $Tool
if (-not $observed.verified) {
  @{ tool=$Tool; package=$packageId; status='installer_returned_success_but_unverified'; installed='unknown'; next='Open a fresh terminal and run -Action Inspect' } | ConvertTo-Json -Compress
  exit 3
}
$observed.status = 'installed_and_verified'
$observed | ConvertTo-Json -Compress
