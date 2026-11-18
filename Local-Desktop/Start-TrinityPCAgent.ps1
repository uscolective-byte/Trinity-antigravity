# Start the existing local Trinity PC agent. Does not clone or download files.
[CmdletBinding()]
param(
  [ValidateRange(1024,65535)][int]$Port=8788,
  [switch]$CheckOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$base=Split-Path -Parent $MyInvocation.MyCommand.Path
$agent=Join-Path $base 'trinity_pc_agent.py'
$installer=Join-Path $base 'Trinity-Tool-Installer.ps1'
if (!(Test-Path -LiteralPath $agent -PathType Leaf)) { throw "Missing PC agent: $agent" }
if (!(Test-Path -LiteralPath $installer -PathType Leaf)) { throw "Missing installer: $installer" }
$python=Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$python) { throw "Python not found. Install Python first and reopen PowerShell." }
$version=& $python.Source --version 2>&1
if ($LASTEXITCODE -ne 0) { throw "Python version probe failed" }
Write-Host "Python: $version"
Write-Host "PC Agent: $agent"
Write-Host "Local endpoint: http://127.0.0.1:$Port"
Write-Host "Cloudflare connected: NO (local-only agent)"
if ($CheckOnly) {
  & $python.Source -m unittest discover -s $base -p test_trinity_pc_agent.py -v
  if ($LASTEXITCODE -ne 0) { throw "Local agent tests failed; not starting" }
  Write-Host "Local unit tests passed. No daemon started."
  exit 0
}
& $python.Source $agent serve --port $Port
if ($LASTEXITCODE -ne 0) { throw "PC Agent exited with code $LASTEXITCODE" }
