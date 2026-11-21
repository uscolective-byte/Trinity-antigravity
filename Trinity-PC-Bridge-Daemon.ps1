# Trinity Sovereign AI OS - Permanent PC Bridge Background Daemon
# ─────────────────────────────────────────────────────────────
# Zabezpečuje nepretržité (24/7) prepojenie medzi lokálnym PC a Cloudflare Trinity Edge.
# Automaticky monitoruje a udržiava v chode:
#   1. Local-Gateway (port 8791)
#   2. Local-Desktop (port 8795)
#   3. PC-Bridge Daemon (port 7777)
# Každých 30 sekúnd odosiela telemetriu do Cloudflare Edge KV a D1.

$ErrorActionPreference = 'SilentlyContinue'
$repoRoot = $PSScriptRoot

function Test-Endpoint([string]$url) {
    try {
        $res = Invoke-RestMethod -Uri $url -TimeoutSec 2 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Ensure-LocalServices() {
    # 1. Local-Gateway (port 8791)
    if (-not (Test-Endpoint "http://127.0.0.1:8791/health")) {
        $gwScript = Join-Path $repoRoot 'Local-Gateway\start.ps1'
        if (Test-Path $gwScript) {
            Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$gwScript`"" -WorkingDirectory (Join-Path $repoRoot 'Local-Gateway') -WindowStyle Hidden | Out-Null
        }
    }

    # 2. Local-Desktop (port 8795)
    if (-not (Test-Endpoint "http://127.0.0.1:8795/health")) {
        $dtServer = Join-Path $repoRoot 'Local-Desktop\server.mjs'
        if (Test-Path $dtServer) {
            Start-Process node -ArgumentList "`"$dtServer`"" -WorkingDirectory (Join-Path $repoRoot 'Local-Desktop') -WindowStyle Hidden | Out-Null
        }
    }

    # 3. PC-Bridge Daemon (port 7777)
    $pbListening = $false
    try {
        $tcp = Get-NetTCPConnection -LocalPort 7777 -State Listen -ErrorAction SilentlyContinue
        if ($tcp) { $pbListening = $true }
    } catch {}

    if (-not $pbListening) {
        $pbScript = Join-Path $repoRoot 'Trinity\trinity-tools\start-powershell-bridge.ps1'
        if (Test-Path $pbScript) {
            Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$pbScript`" -Port 7777" -WindowStyle Hidden | Out-Null
        }
    }
}

function Send-EdgeTelemetry() {
    try {
        $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $cpuInfo = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue
        if (-not $osInfo) { return }

        $totalRamMb = [math]::Round([double]($osInfo.TotalVisibleMemorySize / 1024))
        $freeRamMb = [math]::Round([double]($osInfo.FreePhysicalMemory / 1024))
        $usedRamMb = $totalRamMb - $freeRamMb
        $uptimeSec = [math]::Round([double]((Get-Date) - $osInfo.LastBootUpTime).TotalSeconds)

        $gwOnline = Test-Endpoint "http://127.0.0.1:8791/health"
        $dtOnline = Test-Endpoint "http://127.0.0.1:8795/health"

        $payload = @{
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
            services = @{
                gateway = $gwOnline
                desktop = $dtOnline
                daemon = $true
            }
            prislub_verified = $true
            persistent = $true
            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Depth 4

        $endpoints = @(
            "https://trinity.saboivan2008.workers.dev/api/pc-bridge/telemetry",
            "https://auru.space/api/pc-bridge/telemetry"
        )

        foreach ($url in $endpoints) {
            try {
                $res = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 5 -ErrorAction Stop
                if ($res.ok) { break }
            } catch {}
        }
    } catch {}
}

# Inicializačný štart
Ensure-LocalServices
Start-Sleep -Seconds 3
Send-EdgeTelemetry

# Hlavná trvalá slučka (každých 30 sekúnd)
$iteration = 0
while ($true) {
    Start-Sleep -Seconds 30
    $iteration++

    # Každé 2 minúty over zdravie lokálnych procesov a prípadne ich reštartuj
    if ($iteration % 4 -eq 0) {
        Ensure-LocalServices
    }

    # Pravidelná telemetria do cloudu
    Send-EdgeTelemetry
}
