# Trinity Sovereign AI OS - Unified PC Bridge Launcher & Cloud Link
[CmdletBinding()]
param([switch]$Foreground)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   TRINITY SOVEREIGN AI OS - PC BRIDGE UNIFIED DAEMON    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Test-Endpoint([string]$url) {
    try {
        $res = Invoke-RestMethod -Uri $url -TimeoutSec 2 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# 1. Setup credentials for Local Gateway if missing
$gwCreds = Join-Path $repoRoot 'Local-Gateway\.credentials\local-token.dpapi'
if (-not (Test-Path $gwCreds)) {
    Write-Host "[1/4] Inicializujem bezpečný DPAPI token pre Local-Gateway..." -ForegroundColor Yellow
    & (Join-Path $repoRoot 'Local-Gateway\setup.ps1')
}

# 2. Check / Start Local Gateway (port 8791)
$gwHealth = Test-Endpoint "http://127.0.0.1:8791/health"
if (-not $gwHealth) {
    Write-Host "[2/4] Štartujem Trinity Local-Gateway (port 8791)..." -ForegroundColor Green
    $gwScript = Join-Path $repoRoot 'Local-Gateway\start.ps1'
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$gwScript`"" -WorkingDirectory (Join-Path $repoRoot 'Local-Gateway') -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 15 -and -not $gwHealth; $i++) {
        Start-Sleep -Seconds 1
        $gwHealth = Test-Endpoint "http://127.0.0.1:8791/health"
    }
} else {
    Write-Host "[2/4] Local-Gateway beží na porte 8791 [ONLINE]" -ForegroundColor Green
}

# 3. Check / Start Local Desktop (port 8795)
$dtHealth = Test-Endpoint "http://127.0.0.1:8795/health"
if (-not $dtHealth) {
    Write-Host "[3/4] Štartujem Trinity Local-Desktop (port 8795)..." -ForegroundColor Green
    $dtServer = Join-Path $repoRoot 'Local-Desktop\server.mjs'
    Start-Process node -ArgumentList "`"$dtServer`"" -WorkingDirectory (Join-Path $repoRoot 'Local-Desktop') -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 15 -and -not $dtHealth; $i++) {
        Start-Sleep -Seconds 1
        $dtHealth = Test-Endpoint "http://127.0.0.1:8795/health"
    }
} else {
    Write-Host "[3/4] Local-Desktop beží na porte 8795 [ONLINE]" -ForegroundColor Green
}

# 4. Check / Start PC Bridge Daemon (port 7777)
$pbHealth = $false
try {
    $tcp = Get-NetTCPConnection -LocalPort 7777 -State Listen -ErrorAction SilentlyContinue
    if ($tcp) { $pbHealth = $true }
} catch {}

if (-not $pbHealth) {
    Write-Host "[4/4] Štartujem Trinity PC Bridge Daemon (port 7777)..." -ForegroundColor Green
    $pbScript = Join-Path $repoRoot 'Trinity\trinity-tools\start-powershell-bridge.ps1'
    if (Test-Path $pbScript) {
        Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$pbScript`" -Port 7777" -WindowStyle Hidden | Out-Null
        Start-Sleep -Seconds 2
        try {
            $tcp = Get-NetTCPConnection -LocalPort 7777 -State Listen -ErrorAction SilentlyContinue
            if ($tcp) { $pbHealth = $true }
        } catch {}
    }
} else {
    Write-Host "[4/4] PC Bridge Daemon beží na porte 7777 [ONLINE]" -ForegroundColor Green
}

# 5. Odoslanie telemetrie do Cloudflare Workeru (Edge Sync)
Write-Host "`nSynchronizujem PC Bridge s Cloudflare Trinity Edge..." -ForegroundColor Cyan
$cloudEndpoints = @(
    "https://trinity.saboivan2008.workers.dev/api/pc-bridge/telemetry",
    "https://auru.space/api/pc-bridge/telemetry"
)

$osInfo = Get-CimInstance Win32_OperatingSystem
$cpuInfo = Get-CimInstance Win32_Processor
$totalRamMb = [math]::Round([double]($osInfo.TotalVisibleMemorySize / 1024))
$freeRamMb = [math]::Round([double]($osInfo.FreePhysicalMemory / 1024))
$usedRamMb = $totalRamMb - $freeRamMb
$uptimeSec = [math]::Round([double]((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalSeconds)

$telemetryPayload = @{
    gateway_id = "gateway:morhfeus-windows"
    hostname = $env:COMPUTERNAME
    platform = "win32"
    uptime_seconds = $uptimeSec
    cpu = @{
        cores = $cpuInfo.NumberOfLogicalProcessors
        name = $cpuInfo.Name
    }
    memory = @{
        used_mb = $usedRamMb
        total_mb = $totalRamMb
    }
    endpoints = @{
        gateway = 8791
        desktop = 8795
        bridge_daemon = 7777
    }
    prislub_verified = $true
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Depth 4

$syncedCloud = $false
foreach ($cloudUrl in $cloudEndpoints) {
    try {
        $cfRes = Invoke-RestMethod -Uri $cloudUrl -Method Post -ContentType "application/json" -Body $telemetryPayload -TimeoutSec 5 -ErrorAction Stop
        if ($cfRes.ok) {
            $syncedCloud = $true
            Write-Host "  -> Cloudflare Edge synchronizovaný ($cloudUrl)" -ForegroundColor Green
            break
        }
    } catch {
        # Pokračuj na ďalší endpoint ak je prvý chránený Access bránou
    }
}

Write-Host "`n================ STAV TRINITY PC BRIDGE ================" -ForegroundColor Cyan
Write-Host "  - Local-Gateway    (port 8791): $(if ($gwHealth) { 'ONLINE [OK]' } else { 'OFFLINE' })" -ForegroundColor $(if ($gwHealth) { 'Green' } else { 'Red' })
Write-Host "  - Local-Desktop    (port 8795): $(if ($dtHealth) { 'ONLINE [OK]' } else { 'OFFLINE' })" -ForegroundColor $(if ($dtHealth) { 'Green' } else { 'Red' })
Write-Host "  - PC Bridge Daemon (port 7777): $(if ($pbHealth) { 'ONLINE [OK]' } else { 'OFFLINE' })" -ForegroundColor $(if ($pbHealth) { 'Green' } else { 'Red' })
Write-Host "  - Cloudflare Edge Sync         : $(if ($syncedCloud) { 'PREPOJENÉ [OK]' } else { 'ČAKÁ NA SPOJENIE' })" -ForegroundColor $(if ($syncedCloud) { 'Green' } else { 'Yellow' })
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "PC Bridge je plne pripravený a aktívny pre obojsmerné riadenie (Read & Write)." -ForegroundColor Green
