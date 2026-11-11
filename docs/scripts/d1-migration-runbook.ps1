[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Database,

    [ValidateSet('staging', 'production')]
    [string]$Environment = 'staging',

    [string]$Config = 'Trinity/wrangler.jsonc',

    [switch]$Apply,

    [string]$InvariantCheck,

    [switch]$ConfirmProduction
)

$ErrorActionPreference = 'Stop'

function Stop-Runbook([int]$Code, [string]$Message) {
    Write-Error $Message
    exit $Code
}

try {
    $root = (Resolve-Path '.').Path
    $node = Get-Command 'node' -ErrorAction SilentlyContinue
    if (-not $node) { Stop-Runbook 10 'DEPENDENCY_MISSING:node' }

    $configPath = Join-Path $root $Config
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        Stop-Runbook 10 ('WRANGLER_CONFIG_MISSING:' + $Config)
    }

    $wrangler = Join-Path $root 'node_modules/wrangler/bin/wrangler.js'
    if (-not (Test-Path -LiteralPath $wrangler -PathType Leaf)) {
        $wrangler = Join-Path $root 'Trinity/node_modules/wrangler/bin/wrangler.js'
    }
    if (-not (Test-Path -LiteralPath $wrangler -PathType Leaf)) {
        Stop-Runbook 10 'WRANGLER_CLI_NOT_FOUND'
    }

    # The root Wrangler profile is production/default; only staging uses --env staging.
    $environmentArgs = @()
    if ($Environment -eq 'staging') { $environmentArgs = @('--env', 'staging') }
    Write-Output ('WRANGLER_ENV=' + $(if ($Environment -eq 'staging') { 'staging' } else { 'default-production' }))

    & $node.Source $wrangler 'd1' 'list' '--config' $configPath @environmentArgs
    if ($LASTEXITCODE -ne 0) { Stop-Runbook 20 ('D1_LIST_FAILED:' + $LASTEXITCODE) }

    & $node.Source $wrangler 'd1' 'migrations' 'list' $Database '--remote' '--config' $configPath @environmentArgs
    if ($LASTEXITCODE -ne 0) { Stop-Runbook 30 ('D1_MIGRATION_STATUS_FAILED:' + $LASTEXITCODE) }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupDir = Join-Path $env:TEMP ('trinity-d1-' + $Environment + '-' + $stamp)
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    $backupFile = Join-Path $backupDir ($Database + '.sql')

    & $node.Source $wrangler 'd1' 'export' $Database '--remote' '--output' $backupFile '--config' $configPath @environmentArgs
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backupFile) -or (Get-Item -LiteralPath $backupFile).Length -eq 0) {
        Stop-Runbook 40 ('D1_BACKUP_FAILED; recovery folder: ' + $backupDir)
    }

    $backupHash = (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
    Write-Output ('BACKUP_FILE=' + $backupFile)
    Write-Output ('BACKUP_SHA256=' + $backupHash)

    if (-not $Apply) {
        Write-Output 'PREFLIGHT_ONLY=1; no migration was applied.'
        exit 0
    }

    if (-not $InvariantCheck -or -not (Test-Path -LiteralPath $InvariantCheck -PathType Leaf)) {
        Stop-Runbook 10 'INVARIANT_CHECK_SCRIPT_REQUIRED_FOR_APPLY'
    }
    if ($Environment -eq 'production' -and -not $ConfirmProduction) {
        Stop-Runbook 10 'PRODUCTION_REQUIRES_-ConfirmProduction'
    }

    $target = 'D1 database ' + $Database + ' in ' + $Environment
    if (-not $PSCmdlet.ShouldProcess($target, 'Apply pending Wrangler migrations')) {
        Write-Output 'APPLY_SKIPPED_BY_SHOULD_PROCESS'
        exit 0
    }

    & $node.Source $wrangler 'd1' 'migrations' 'apply' $Database '--remote' '--config' $configPath @environmentArgs
    if ($LASTEXITCODE -ne 0) {
        Stop-Runbook 50 ('D1_MIGRATION_APPLY_FAILED:' + $LASTEXITCODE + '; backup=' + $backupFile)
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Resolve-Path $InvariantCheck).Path -Database $Database -Environment $Environment
    if ($LASTEXITCODE -ne 0) {
        Stop-Runbook 60 ('POST_MIGRATION_INVARIANTS_FAILED; stop writes and recover from verified backup=' + $backupFile)
    }

    Write-Output 'D1_MIGRATION_AND_INVARIANTS_PASS'
    Write-Output ('BACKUP_SHA256=' + $backupHash)
    exit 0
}
catch {
    Write-Error ('RUNBOOK_UNEXPECTED_FAILURE: ' + $_.Exception.Message)
    exit 70
}
