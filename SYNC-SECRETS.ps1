param(
    [string]$EnvFile = "",
    [switch]$DryRun = $false,
    [switch]$SyncSecretsStore = $true,
    [switch]$SyncGitHub = $true,
    [switch]$ResetFileAfterSync = $false
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$TrinityDir = Join-Path $RepoRoot "Trinity"
$StoreId = "5ba06ba934c343fa8c0dc5454ce67038"

function Test-HasFilledKeys {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    foreach ($raw in Get-Content -Path $Path -Encoding UTF8) {
        $l = $raw.Trim()
        if ($l -and -not $l.StartsWith("#") -and $l -match '^[A-Za-z0-9_]+=.+$') {
            $v = $l.Substring($l.IndexOf("=") + 1).Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrWhiteSpace($v)) { return $true }
        }
    }
    return $false
}

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $candidates = @(
        (Join-Path $RepoRoot "trinity_api.txt"),
        (Join-Path $RepoRoot ".secrets\trinity-keys.env")
    )
    $EnvFile = ($candidates | Where-Object { Test-HasFilledKeys $_ } | Select-Object -First 1)
    if (-not $EnvFile) {
        $EnvFile = ($candidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
    }
}

if (-not $EnvFile -or -not (Test-Path $EnvFile)) {
    Write-Error "Subor s klucmi neexistuje: $EnvFile"
    exit 1
}

# Mapovanie vybranych klucov aj do Cloudflare Secrets Store (ID overene cez wrangler)
$SecretsStoreMap = @{
    "OLLAMA_API_KEY"       = @{ Name = "ollama";     Id = "1f19187182414a87adc69c51bdf38d60" }
    "GEMINI_API_KEY"       = @{ Name = "apigoogle";  Id = "5538786c28a1419181d2ea465f7af89a" }
    "OPENAI_API_KEY"       = @{ Name = "APIopen";    Id = "8184485e9e0d4bd68decf3b589c9835b" }
    "TRINITY_GITHUB_TOKEN" = @{ Name = "GITHUBE";    Id = "10675616bc504e518e6b563b9cd959e5" }
}

# Aliasy nazvov pre Worker Secrets (podporovane v src/env-vault.js a wrangler secret list)
$WorkerSecretAliases = @{
    "FIRECRAWL_API_KEY" = "firecrawl"
}

$Entries = @{}
foreach ($rawLine in Get-Content -Path $EnvFile -Encoding UTF8) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($val.Length -ge 2 -and (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'")))) {
        $val = $val.Substring(1, $val.Length - 2)
    }
    if ([string]::IsNullOrWhiteSpace($val)) { continue }
    $Entries[$key] = $val
}

if ($Entries.Count -eq 0) {
    Write-Host "Ziadne vyplnene kluce v $EnvFile (vsetky riadky su prazdne). Nic nebolo odoslane." -ForegroundColor Yellow
    exit 0
}

Write-Host "Najdenych $($Entries.Count) vyplnenych klucov na synchronizaciu (hodnoty sa nikdy nevypisuju):" -ForegroundColor Cyan
foreach ($k in $Entries.Keys) {
    Write-Host "  * $k" -ForegroundColor Gray
}

if ($DryRun) {
    Write-Host "[DryRun] Simulacia uspesna. Ziadne zmeny neboli zapisane." -ForegroundColor Green
    exit 0
}

Push-Location $TrinityDir
try {
    foreach ($kv in $Entries.GetEnumerator()) {
        $workerKey = if ($WorkerSecretAliases.ContainsKey($kv.Key)) { $WorkerSecretAliases[$kv.Key] } else { $kv.Key }
        Write-Host "-> Nahravam Worker Secret: $workerKey ..." -NoNewline
        $kv.Value | npx wrangler secret put $workerKey --config wrangler.jsonc --env="" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Zlyhalo nahratie Worker Secret pre $workerKey" }
        Write-Host " OK" -ForegroundColor Green

        if ($SyncSecretsStore -and $SecretsStoreMap.ContainsKey($kv.Key)) {
            $meta = $SecretsStoreMap[$kv.Key]
            Write-Host "   -> Aktualizujem Secrets Store ($($meta.Name)) ..." -NoNewline
            $kv.Value | npx wrangler secrets-store secret update $StoreId --secret-id $meta.Id --remote | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host " OK" -ForegroundColor Green
            } else {
                Write-Host " PRESKOCENE (overte opravenia store)" -ForegroundColor Yellow
            }
        }
    }
}
finally {
    Pop-Location
}

if ($SyncGitHub -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    $ghAuthOk = $false
    try { gh auth status 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $ghAuthOk = $true } } catch {}
    if ($ghAuthOk -and $Entries.ContainsKey("CLOUDFLARE_API_TOKEN")) {
        Write-Host "-> Nahravam GitHub Repo Secret: CLOUDFLARE_API_TOKEN ..." -NoNewline
        $Entries["CLOUDFLARE_API_TOKEN"] | gh secret set CLOUDFLARE_API_TOKEN -R uscolective-byte/Trinity-antigravity | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green } else { Write-Host " CHYBA" -ForegroundColor Yellow }
    }
}

if ($ResetFileAfterSync) {
    $cleaned = Get-Content -Path $EnvFile -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^([A-Za-z0-9_]+)=') { "$($Matches[1])=" } else { $_ }
    }
    Set-Content -Path $EnvFile -Value $cleaned -Encoding UTF8
    Write-Host "Hodnoty v $EnvFile boli po synchronizacii bezpecne vymazane (zostala cista sablona)." -ForegroundColor Cyan
}

Write-Host "Hotovo! Vsetky zadane kluce boli bezpecne synchronizovane." -ForegroundColor Green
