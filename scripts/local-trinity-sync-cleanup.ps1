# Local Trinity sync and guarded cleanup of obsolete Git clones.
# Default is dry-run. -Apply required for updates/removals.
[CmdletBinding()]
param(
    [string]$CanonicalPath = 'C:\Users\saboi\Trinity-antigravity',
    [string]$BackupRoot = 'C:\Users\saboi\Trinity-Repo-Backups',
    [string[]]$RemoveClonePaths = @(),
    [switch]$Apply
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$canonicalRemote = 'https://github.com/uscolective-byte/Trinity-antigravity.git'
$allowedRemotes = @(
    'https://github.com/uscolective-byte/Trinity-antigravity.git',
    'https://github.com/uscolective-byte/trinity-morhfeus.git'
)

function CanonicalGitUrl([string]$url) {
    $value = $url.Trim() -replace '^git@github\.com:', 'https://github.com/'
    if ($value -notmatch '^https://github\.com/uscolective-byte/[-a-zA-Z0-9_.]+(?:\.git)?$') {
        throw "Unrecognized GitHub remote; never delete this checkout."
    }
    if (-not $value.EndsWith('.git')) { $value += '.git' }
    return $value
}
function GitText([string]$folder, [string[]]$gitArgs) {
    $lines = & git -C $folder @gitArgs 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Git command failed; no cleanup permitted." }
    return ($lines -join [Environment]::NewLine).Trim()
}
function AssertGitRoot([string]$folder) {
    if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
        throw "Checkout folder does not exist: $folder"
    }
    $root = [IO.Path]::GetFullPath((GitText $folder @('rev-parse','--show-toplevel')))
    $expected = [IO.Path]::GetFullPath($folder)
    if (-not $root.Equals($expected, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Not a Git root: $folder"
    }
}
function AssertClean([string]$folder) {
    if ((GitText $folder @('status','--porcelain=v1','--untracked-files=all')).Length -gt 0) {
        throw "Dirty checkout or untracked content: $folder. Preserve changes manually."
    }
}
function AssertSafeCandidate([string]$folder, [string]$primary, [string]$backup) {
    $p = [IO.Path]::GetFullPath($folder).TrimEnd('\')
    $c = [IO.Path]::GetFullPath($primary).TrimEnd('\')
    $b = [IO.Path]::GetFullPath($backup).TrimEnd('\')
    if ($p.Equals($c,[StringComparison]::OrdinalIgnoreCase) -or
        $p.StartsWith($c+'\', [StringComparison]::OrdinalIgnoreCase) -or
        $c.StartsWith($p+'\', [StringComparison]::OrdinalIgnoreCase) -or
        $p.Equals($b,[StringComparison]::OrdinalIgnoreCase) -or
        $p.StartsWith($b+'\', [StringComparison]::OrdinalIgnoreCase) -or
        $b.StartsWith($p+'\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Protected path cannot be removed: $folder"
    }
    AssertGitRoot $p
    if (-not (Test-Path -LiteralPath (Join-Path $p '.git') -PathType Container)) {
        throw "Linked worktree or nonstandard repository: refuse deletion."
    }
    $origin = CanonicalGitUrl (GitText $p @('remote','get-url','origin'))
    if ($origin -notin $allowedRemotes) {
        throw "Remote not on approved Trinity clone allowlist: $folder"
    }
    AssertClean $p
    # Ignored files may include credentials or valuable local data.
    if ((GitText $p @('ls-files','--others','-i','--exclude-standard')).Length -gt 0) {
        throw "Ignored local files exist: $folder. Inspect before removal."
    }
    if ($Apply) {
        [void](GitText $p @('fetch','--all'))
        $branchRefs = GitText $p @('for-each-ref','--format=%(objectname)','refs/heads')
        foreach ($sha in ($branchRefs -split [Environment]::NewLine | Where-Object { $_ })) {
            $contained = GitText $p @('branch','-r','--contains',$sha)
            if (-not $contained) {
                throw "Local branch tip not found on a fetched remote: $folder"
            }
        }
    }
    return $origin
}

$main = [IO.Path]::GetFullPath($CanonicalPath)
$backupDir = [IO.Path]::GetFullPath($BackupRoot)
AssertGitRoot $main
AssertClean $main
$origin = CanonicalGitUrl (GitText $main @('remote','get-url','origin'))
if ($origin -ne $canonicalRemote) { throw "Main repo remote is not canonical." }
$branch = GitText $main @('branch','--show-current')
if ($branch -ne 'main') { throw "Main checkout must be on main; current branch: $branch" }
$upstream = GitText $main @('rev-parse','--abbrev-ref','@{upstream}')
if ($upstream -ne 'origin/main') { throw "Main checkout must track origin/main." }
Write-Host "Canonical checkout: $main"
Write-Host "Current HEAD: $(GitText $main @('rev-parse','HEAD'))"
if (-not $Apply) {
    Write-Host "[DRY RUN] Would fetch origin/main and fast-forward only if possible."
} else {
    [void](GitText $main @('fetch','origin','main'))
    [void](GitText $main @('merge','--ff-only','origin/main'))
    Write-Host "Updated canonical main: $(GitText $main @('rev-parse','HEAD'))"
}
foreach ($candidate in ($RemoveClonePaths | Where-Object { $_ } | Select-Object -Unique)) {
    $folder = [IO.Path]::GetFullPath($candidate)
    $remote = AssertSafeCandidate $folder $main $backupDir
    if (-not $Apply) {
        Write-Host "[DRY RUN] Verified clean clone, candidate: $folder ($remote)"
        continue
    }
    [void](New-Item -ItemType Directory -Force -Path $backupDir)
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $slug = [IO.Path]::GetFileName($folder)
    $bundle = Join-Path $backupDir ($slug + '-' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.bundle')
    [void](GitText $folder @('bundle','create',$bundle,'--all'))
    [void](GitText $folder @('bundle','verify',$bundle))
    if (-not (Test-Path -LiteralPath $bundle -PathType Leaf) -or (Get-Item -LiteralPath $bundle).Length -le 0) {
        throw "Backup is missing or empty. Checkout retained."
    }
    AssertSafeCandidate $folder $main $backupDir | Out-Null
    Remove-Item -LiteralPath $folder -Recurse -Force
    Write-Host "Removed verified clone: $folder"
    Write-Host "Recoverable Git bundle: $bundle"
}
Write-Host "Complete. No other paths were modified or deleted."
