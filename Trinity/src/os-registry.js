/**
 * TRINITY 12.0 SOVEREIGN AI OPERATING SYSTEM REGISTRY & SCHEDULER
 * Riadiaca vrstva pre Agent Registry, Capability-First Scheduler, Policy Engine a Knowledge Graph.
 */

export function sanitizeD1(val) {
  return val === undefined ? null : val;
}

/**
 * Policy Engine: Validácia deklaratívnych invariantov
 */
export async function isPolicyEnabled(env, policyName) {
  if (!env?.DB?.prepare) return true; // Fail-safe pre in-memory prostredie
  try {
    const row = await env.DB.prepare('SELECT enabled FROM sovereign_policies WHERE name=?').bind(sanitizeD1(policyName)).first();
    return row ? Boolean(row.enabled) : true;
  } catch {
    return true;
  }
}

export function enforceCompletedEvidence(status, result) {
  if (status === 'completed') {
    const hasEvidence = Boolean(result?.receipt_id || result?._evidence?.receipt_id || result?.evidence?.receipt_id);
    if (hasEvidence) return 'completed';
    if (['pending','queued','running','partial','failed'].includes(result?.status)) return result.status;
    return 'failed';
  }
  return status;
}

/**
 * Agent Registry: Registrácia a správa stavov
 */
export async function registerAgent(env, {
  agent_id,
  name,
  type = 'core',
  version = '12.0.0',
  status = 'available',
  endpoint = null,
  owner = 'system',
  capabilities = []
}) {
  const now = Date.now();
  if (env?.DB?.prepare) {
    await env.DB.prepare(`
      INSERT INTO agents (agent_id, name, type, version, status, endpoint, owner, heartbeat_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
      ON CONFLICT(agent_id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        version = excluded.version,
        status = excluded.status,
        endpoint = excluded.endpoint,
        heartbeat_at = excluded.heartbeat_at,
        updated_at = excluded.updated_at
    `).bind(
      sanitizeD1(agent_id),
      sanitizeD1(name),
      sanitizeD1(type),
      sanitizeD1(version),
      sanitizeD1(status),
      sanitizeD1(endpoint),
      sanitizeD1(owner),
      now
    ).run();

    // Mapovanie schopností
    for (const capName of capabilities) {
      const cap = await env.DB.prepare('SELECT capability_id FROM capabilities WHERE name=?').bind(capName).first();
      if (cap?.capability_id) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO agent_capabilities (agent_id, capability_id, confidence, priority)
          VALUES (?1, ?2, 1.0, 100)
        `).bind(sanitizeD1(agent_id), cap.capability_id).run();
      }
    }
  }
  return { agent_id, name, status, registered_at: now };
}

/**
 * Heartbeat telemetria a stráženie dostupnosti
 */
export async function recordHeartbeat(env, {
  agent_id,
  status = 'available',
  active_jobs = 0,
  latency_ms = 0,
  cpu_load = 0.0,
  memory_load = 0.0
}) {
  const now = Date.now();
  const id = `hb_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const load_score = Math.min(1.0, Math.max(0.0, active_jobs / 10));

  if (env?.DB?.prepare) {
    await env.DB.prepare(`
      INSERT INTO agent_heartbeats (id, agent_id, status, active_jobs, cpu_load, memory_load, latency_ms, timestamp)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(
      id,
      sanitizeD1(agent_id),
      sanitizeD1(status),
      active_jobs,
      cpu_load,
      memory_load,
      latency_ms,
      now
    ).run();

    await env.DB.prepare(`
      UPDATE agents
      SET status = ?1, heartbeat_at = ?2, load_score = ?3, updated_at = ?2
      WHERE agent_id = ?4
    `).bind(sanitizeD1(status), now, load_score, sanitizeD1(agent_id)).run();
  }

  return { agent_id, status, load_score, heartbeat_at: now };
}

/**
 * Agent Leasing: Zámky úloh s expiračným oknom
 */
export async function acquireLease(env, { agent_id, job_id, lease_seconds = 300 }) {
  const now = Date.now();
  const expires_at = now + (lease_seconds * 1000);
  const lease_id = `lease_${now}_${Math.random().toString(36).slice(2, 8)}`;

  if (env?.DB?.prepare) {
    // Overenie existujúceho aktívneho lease
    const existing = await env.DB.prepare('SELECT lease_id, agent_id, expires_at FROM agent_leases WHERE job_id=?').bind(sanitizeD1(job_id)).first();
    if (existing && existing.expires_at > now && existing.agent_id !== agent_id) {
      throw new Error(`Úloha ${job_id} je už zamknutá agentom ${existing.agent_id} do ${new Date(existing.expires_at).toISOString()}`);
    }

    await env.DB.prepare(`
      INSERT INTO agent_leases (lease_id, agent_id, job_id, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(job_id) DO UPDATE SET
        agent_id = excluded.agent_id,
        expires_at = excluded.expires_at
    `).bind(
      lease_id,
      sanitizeD1(agent_id),
      sanitizeD1(job_id),
      expires_at,
      now
    ).run();
  }

  return { lease_id, agent_id, job_id, expires_at };
}

export async function releaseLease(env, job_id) {
  if (env?.DB?.prepare) {
    await env.DB.prepare('DELETE FROM agent_leases WHERE job_id=?').bind(sanitizeD1(job_id)).run();
  }
  return { released: true, job_id };
}

/**
 * Capability-First Scheduler: Vyhľadanie najvhodnejšieho agenta
 */
export async function findBestAgentForCapabilities(env, requiredCapabilities = []) {
  if (!Array.isArray(requiredCapabilities) || requiredCapabilities.length === 0) {
    return { agent_id: 'TRINITY_CORE', endpoint: 'CORE', rank: 1.0, strategy: 'default_core' };
  }

  if (!env?.DB?.prepare) {
    return { agent_id: 'TRINITY_CORE', endpoint: 'CORE', rank: 1.0, strategy: 'fallback_mock' };
  }

  const now = Date.now();
  const staleThreshold = now - 60000; // Agent musí mať heartbeat za posledných 60s

  const placeholders = requiredCapabilities.map(() => '?').join(',');
  const query = `
    SELECT a.agent_id, a.name, a.endpoint, a.trust_score, a.load_score,
           (a.trust_score * 0.6 + (1.0 - a.load_score) * 0.4) AS rank
    FROM agents a
    JOIN agent_capabilities ac ON a.agent_id = ac.agent_id
    JOIN capabilities c ON ac.capability_id = c.capability_id
    WHERE c.name IN (${placeholders})
      AND a.status IN ('available', 'busy')
      AND (a.heartbeat_at >= ? OR a.heartbeat_at IS NULL)
    GROUP BY a.agent_id
    HAVING COUNT(DISTINCT c.name) = ?
    ORDER BY rank DESC, ac.priority ASC
    LIMIT 1
  `;

  const bindParams = [...requiredCapabilities, staleThreshold, requiredCapabilities.length];
  const candidate = await env.DB.prepare(query).bind(...bindParams).first();

  if (!candidate) {
    // Fallback: Ak žiadny agent nemá všetky schopnosti, zvoľ TRINITY_CORE
    return {
      agent_id: 'TRINITY_CORE',
      endpoint: 'CORE',
      rank: 0.5,
      strategy: 'degraded_fallback',
      warning: `Žiadny živý agent nepokrýva všetky požadované schopnosti: ${requiredCapabilities.join(', ')}`
    };
  }

  // Kontrola závislostí: Sú zdravé uzly, od ktorých kandidát závisí?
  const deps = (await env.DB.prepare(`
    SELECT ad.depends_on_agent_id, a.status, a.heartbeat_at
    FROM agent_dependencies ad
    JOIN agents a ON ad.depends_on_agent_id = a.agent_id
    WHERE ad.agent_id = ? AND ad.critical = 1
  `).bind(candidate.agent_id).all())?.results || [];

  const unhealthyDep = deps.find(d => d.status === 'offline' || (d.heartbeat_at && d.heartbeat_at < staleThreshold));
  if (unhealthyDep) {
    return {
      agent_id: 'TRINITY_CORE',
      endpoint: 'CORE',
      rank: 0.4,
      strategy: 'dependency_bypass',
      warning: `Agent ${candidate.agent_id} bol preskočený, pretože kritická závislosť ${unhealthyDep.depends_on_agent_id} je nezdravá.`
    };
  }

  return {
    agent_id: candidate.agent_id,
    name: candidate.name,
    endpoint: candidate.endpoint,
    rank: candidate.rank,
    strategy: 'capability_matched'
  };
}

/**
 * Reputation Engine: Výpočet metrík dôvery
 */
export async function updateAgentReputation(env, {
  agent_id,
  success = true,
  latency_ms = 100,
  audit_score = 1.0
}) {
  const now = Date.now();
  if (!env?.DB?.prepare) return { trust_score: 1.0 };

  const rep = await env.DB.prepare(`
    SELECT completed_jobs, failed_jobs, avg_latency_ms, trust_score
    FROM agent_reputation
    WHERE agent_id=?
  `).bind(sanitizeD1(agent_id)).first() || { completed_jobs: 0, failed_jobs: 0, avg_latency_ms: 100, trust_score: 1.0 };

  const completed = rep.completed_jobs + (success ? 1 : 0);
  const failed = rep.failed_jobs + (success ? 0 : 1);
  const total = completed + failed;
  const success_rate = total > 0 ? completed / total : 1.0;
  const avg_latency = ((rep.avg_latency_ms * (total - 1)) + latency_ms) / total;
  const latency_factor = Math.max(0.0, Math.min(1.0, 1.0 - (avg_latency / 10000)));

  // Dôveryhodnosť vážená úspešnosťou, latenciou a auditným hodnotením
  const trust_score = Math.max(0.1, Math.min(1.0, (success_rate * 0.5) + (latency_factor * 0.25) + (audit_score * 0.25)));

  await env.DB.prepare(`
    INSERT INTO agent_reputation (agent_id, completed_jobs, failed_jobs, avg_latency_ms, audit_score, trust_score, last_evaluated)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(agent_id) DO UPDATE SET
      completed_jobs = excluded.completed_jobs,
      failed_jobs = excluded.failed_jobs,
      avg_latency_ms = excluded.avg_latency_ms,
      audit_score = excluded.audit_score,
      trust_score = excluded.trust_score,
      last_evaluated = excluded.last_evaluated
  `).bind(
    sanitizeD1(agent_id),
    completed,
    failed,
    avg_latency,
    audit_score,
    trust_score,
    now
  ).run();

  // Zápis nového trust_score priamo k agentovi
  await env.DB.prepare('UPDATE agents SET trust_score=?1, updated_at=?2 WHERE agent_id=?3')
    .bind(trust_score, now, sanitizeD1(agent_id)).run();

  return { agent_id, trust_score, completed_jobs: completed, failed_jobs: failed };
}

/**
 * Multi-Level Knowledge Graph: Zápis a previazanie poznatkov
 */
export async function recordKnowledgeGraphNode(env, {
  entityType,
  entityName,
  observation,
  receiptId,
  source = 'system'
}) {
  const now = Date.now();
  const entityId = `ent_${entityType}_${entityName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
  const obsId = `obs_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const evId = `ev_${now}_${Math.random().toString(36).slice(2, 8)}`;

  if (env?.DB?.prepare) {
    // 1. Entita
    await env.DB.prepare(`
      INSERT OR IGNORE INTO kg_entities (id, type, name, created_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(entityId, sanitizeD1(entityType), sanitizeD1(entityName), now).run();

    // 2. Pozorovanie
    await env.DB.prepare(`
      INSERT INTO kg_observations (id, entity_id, observation, source, confidence, timestamp)
      VALUES (?1, ?2, ?3, ?4, 1.0, ?5)
    `).bind(obsId, entityId, sanitizeD1(observation), sanitizeD1(source), now).run();

    // 3. Dôkaz (Evidence)
    if (receiptId) {
      await env.DB.prepare(`
        INSERT INTO kg_evidence (id, observation_id, receipt_id, verified, timestamp)
        VALUES (?1, ?2, ?3, 1, ?4)
      `).bind(evId, obsId, sanitizeD1(receiptId), now).run();
    }
  }

  return { entityId, obsId, receiptId, recorded_at: now };
}
