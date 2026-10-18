/**
 * Trinity Autonomous Brain v1.0
 * Autonómny plánovač, monitor stavu a diagnostický koordinátor.
 */
import {readControl, assertRunning} from './control.js';
import {getPCBridgeStatus} from './system-actions.js';

export async function runBrainCycle(env) {
  if (!env || !env.DB) return {status: 'db_not_available'};

  const control = await readControl(env);
  assertRunning(control);

  // 1) Kontrola aktívnych a čakajúcich úloh
  const jobStats = await env.DB.prepare(
    "SELECT status, COUNT(*) AS count FROM ops_jobs WHERE status IN ('queued', 'running', 'pending') GROUP BY status"
  ).all();

  const activeJobs = (jobStats.results || []).reduce((acc, r) => {
    acc[r.status] = r.count;
    return acc;
  }, {});

  // 2) Stav spojenia s PC bránou
  const pcBridge = await getPCBridgeStatus(env);

  // 3) Diagnostické vyhodnotenie
  const timestamp = new Date().toISOString();
  const summary = {
    brain_status: 'operational',
    active_jobs: activeJobs,
    pc_bridge_connected: pcBridge.connected === true,
    emergency_stop: control.emergency_stop === true,
    timestamp
  };

  // Uloženie záznamu do udalostí ops_events
  await env.DB.prepare(
    "INSERT INTO ops_events(action, details) VALUES(?, ?)"
  ).bind('brain_cycle_heartbeat', JSON.stringify(summary)).run();

  return summary;
}
