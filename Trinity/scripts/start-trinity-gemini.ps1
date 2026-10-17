[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $root
if(-not (Get-Command gemini -ErrorAction SilentlyContinue)){throw 'Gemini CLI is not installed.'}
# Use the Google account subscription selected in Gemini, rather than inherited API keys.
Remove-Item Env:\GEMINI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\GOOGLE_API_KEY -ErrorAction SilentlyContinue
gemini --allowed-mcp-server-names trinity --prompt-interactive 'Pracujeme na Trinity. Najprv precitaj GEMINI.md a zisti skutocny stav cez trinity_status. Rozlisuj vykonane akcie od navrhov a nevypisuj pristupove kluce.'
