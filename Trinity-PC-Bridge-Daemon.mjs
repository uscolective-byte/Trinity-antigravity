/**
 * @module TRINITY_OMNI_CORE
 * @subsystem PC_BRIDGE_PERMANENT_DAEMON
 * @description Trvalý démon na pozadí pre PC Bridge a Edge Sync.
 */
import os from 'node:os';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const EDGE_URLS = [
  'https://trinity.saboivan2008.workers.dev/api/pc-bridge/telemetry',
  'https://auru.space/api/pc-bridge/telemetry'
];

async function isHealthy(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServices() {
  // 1. Local Gateway (8791)
  const gwOk = await isHealthy('http://127.0.0.1:8791/health');
  if (!gwOk) {
    try {
      const gwStart = path.join(root, 'Local-Gateway', 'start.ps1');
      spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', gwStart], {
        cwd: path.join(root, 'Local-Gateway'),
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    } catch {}
  }

  // 2. Local Desktop (8795)
  const dtOk = await isHealthy('http://127.0.0.1:8795/health');
  if (!dtOk) {
    try {
      const dtServer = path.join(root, 'Local-Desktop', 'server.mjs');
      spawn(process.execPath, [dtServer], {
        cwd: path.join(root, 'Local-Desktop'),
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    } catch {}
  }
}

async function sendTelemetry() {
  const [gwOk, dtOk] = await Promise.all([
    isHealthy('http://127.0.0.1:8791/health'),
    isHealthy('http://127.0.0.1:8795/health')
  ]);

  const totalRamMb = Math.round(os.totalmem() / 1048576);
  const freeRamMb = Math.round(os.freemem() / 1048576);
  const usedRamMb = totalRamMb - freeRamMb;

  const payload = {
    gateway_id: process.env.TRINITY_GATEWAY_ID || 'gateway:saboivan-pc',
    user_email: process.env.TRINITY_USER_EMAIL || 'saboivan2008@gmail.com',
    hostname: os.hostname(),
    platform: os.platform(),
    uptime_seconds: Math.round(os.uptime()),
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Intel/AMD'
    },
    memory: {
      used_mb: usedRamMb,
      total_mb: totalRamMb
    },
    endpoints: {
      gateway: 8791,
      desktop: 8795,
      bridge_daemon: 7777
    },
    services: {
      gateway: gwOk,
      desktop: dtOk,
      daemon: true
    },
    prislub_verified: true,
    persistent: true,
    timestamp: Date.now()
  };

  const token = process.env.TRINITY_PC_TOKEN || 'trinity_pc_saboivan_3ff4c864fe003d08d3c352746a5977eeba7e1a68e2ed3057';

  for (const url of EDGE_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        break;
      }
    } catch {}
  }
}

// Spustenie
console.log(JSON.stringify({ event: 'pc_bridge_daemon_started', pid: process.pid, at: new Date().toISOString() }));
await ensureServices();
await sendTelemetry();

// Trvalá slučka každých 30 sekúnd
let cycle = 0;
setInterval(async () => {
  cycle++;
  if (cycle % 4 === 0) {
    await ensureServices();
  }
  await sendTelemetry();
}, 30000);
