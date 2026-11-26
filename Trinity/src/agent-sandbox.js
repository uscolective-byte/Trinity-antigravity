/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Custom AI agent sandbox and domain provisioning module (Trinity/src/agent-sandbox.js) in the TRINITY OMNI-CORE ecosystem.
 */
import { z } from 'zod';
import { HttpError } from './security.js';
import { skillRegistry } from './skillRegistry.js';
import { callModel } from './services.js';
import { createTrinityDocument } from './trinity-documents.js';

export const customAgentSchema = z.object({
  id: z.string().trim().min(2).max(64).regex(/^[a-z0-9_-]+$/i, 'Agent ID may only contain alphanumeric characters, underscores, and hyphens.'),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(''),
  role: z.string().trim().min(2).max(100).default('Autonomous Assistant'),
  model: z.string().trim().default('@cf/openai/gpt-oss-120b'),
  system_prompt: z.string().trim().min(5).max(10000),
  temperature: z.number().min(0).max(2).default(0.7),
  tools: z.array(z.string().trim()).default([]),
  autonomous_mode: z.boolean().default(true),
  domain_binding: z.string().trim().optional()
}).strict();

export const agentExecutionSchema = z.object({
  agent_id: z.string().trim().min(2).max(64),
  input: z.string().trim().min(1).max(10000),
  context: z.record(z.any()).default({})
}).strict();

export const domainProvisionSchema = z.object({
  domain_name: z.string().trim().min(3).max(253).toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid domain name format.'),
  agent_id: z.string().trim().min(2).max(64),
  target_worker: z.string().trim().default('trinity'),
  enable_waf: z.boolean().default(true),
  ssl_mode: z.enum(['full', 'strict', 'flexible']).default('strict')
}).strict();

export async function ensureAgentSandboxTables(env) {
  if (!env.DB) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_custom_agents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      role TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      tools_json TEXT DEFAULT '[]',
      autonomous_mode INTEGER DEFAULT 1,
      domain_binding TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_agent_executions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      steps_json TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'completed',
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_agent_domains (
      domain_name TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      zone_id TEXT,
      status TEXT NOT NULL DEFAULT 'provisioned',
      dns_records_json TEXT DEFAULT '[]',
      ssl_mode TEXT DEFAULT 'strict',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ];
  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

export async function listCustomAgents(env, ownerId = 'admin') {
  await ensureAgentSandboxTables(env);
  if (!env.DB) {
    return {
      agents: [
        {
          id: 'trinity-core-agent',
          name: 'Trinity Core Orchestrator',
          role: 'Master Orchestrator',
          model: env.AI_MODEL || '@cf/openai/gpt-oss-120b',
          system_prompt: 'You are Trinity, the autonomous AI assistant of Ivan Sabo (Basterix). Always reply to the user in Slovak unless requested otherwise.',
          autonomous_mode: true,
          tools: ['search', 'calc', 'weather', 'crypto', 'dns'],
          domain_binding: 'auru.dev'
        }
      ]
    };
  }
  const rows = await env.DB.prepare('SELECT * FROM ops_custom_agents WHERE owner_id = ? ORDER BY created_at DESC').bind(ownerId).all();
  return {
    agents: (rows.results || []).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      role: r.role,
      model: r.model,
      system_prompt: r.system_prompt,
      temperature: r.temperature,
      tools: JSON.parse(r.tools_json || '[]'),
      autonomous_mode: Boolean(r.autonomous_mode),
      domain_binding: r.domain_binding,
      created_at: r.created_at,
      updated_at: r.updated_at
    }))
  };
}

export async function createOrUpdateCustomAgent(env, ownerId = 'admin', input) {
  await ensureAgentSandboxTables(env);
  const data = customAgentSchema.parse(input);
  if (!env.DB) throw new HttpError(500, 'Trinity database is unavailable.');

  const existing = await env.DB.prepare('SELECT owner_id FROM ops_custom_agents WHERE id = ?').bind(data.id).first();
  if (existing && existing.owner_id !== ownerId) throw new HttpError(409, 'Agent ID already belongs to another owner.');

  await env.DB.prepare(`
    INSERT INTO ops_custom_agents (id, owner_id, name, description, role, model, system_prompt, temperature, tools_json, autonomous_mode, domain_binding, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      role = excluded.role,
      model = excluded.model,
      system_prompt = excluded.system_prompt,
      temperature = excluded.temperature,
      tools_json = excluded.tools_json,
      autonomous_mode = excluded.autonomous_mode,
      domain_binding = excluded.domain_binding,
      updated_at = datetime('now')
  `).bind(
    data.id,
    ownerId,
    data.name,
    data.description,
    data.role,
    data.model,
    data.system_prompt,
    data.temperature,
    JSON.stringify(data.tools),
    data.autonomous_mode ? 1 : 0,
    data.domain_binding || null
  ).run();

  await createTrinityDocument(env, ownerId, {
    title: `AI Agent Sandbox: ${data.name} (${data.id})`,
    category: 'architecture',
    step_name: 'agent_sandbox_save',
    summary: `Saved autonomous agent using model ${data.model} with ${data.tools.length} connected tools.`,
    tags: ['sandbox', 'agent', 'custom_agent', data.id]
  }).catch(() => null);

  return { ok: true, agent_id: data.id, name: data.name };
}

export async function executeCustomAgent(env, ownerId = 'admin', input) {
  await ensureAgentSandboxTables(env);
  const parsed = agentExecutionSchema.parse(input);
  const startTime = Date.now();

  let agentRow = null;
  if (env.DB) {
    agentRow = await env.DB.prepare('SELECT * FROM ops_custom_agents WHERE id = ? AND owner_id = ?').bind(parsed.agent_id, ownerId).first();
  }
  if (!agentRow) throw new HttpError(404, 'Agent does not exist or does not belong to the authenticated owner.');

  const agent = {
    id: agentRow.id,
    name: agentRow.name,
    role: agentRow.role,
    model: agentRow.model,
    system_prompt: agentRow.system_prompt,
    tools: JSON.parse(agentRow.tools_json || '[]'),
    autonomous_mode: Boolean(agentRow.autonomous_mode)
  };

  const steps = [];

  // Step 1: Chain-of-Thought Intent Analysis
  steps.push({
    step: 1,
    phase: 'intent_analysis',
    detail: `Analyzing task for agent [${agent.name}]: "${parsed.input.slice(0, 100)}..."`,
    timestamp: new Date().toISOString()
  });

  // Step 2: Tool Discovery & Execution
  const toolOutputs = {};
  if (agent.tools && agent.tools.length) {
    for (const toolName of agent.tools) {
      if (skillRegistry.has(toolName)) {
        try {
          const res = await skillRegistry.execute(toolName, { input: parsed.input, context: parsed.context });
          toolOutputs[toolName] = res;
          steps.push({
            step: steps.length + 1,
            phase: 'tool_execution',
            tool: toolName,
            status: 'success',
            result: res
          });
        } catch (err) {
          toolOutputs[toolName] = { error: err.message };
          steps.push({
            step: steps.length + 1,
            phase: 'tool_execution',
            tool: toolName,
            status: 'failed',
            error: err.message
          });
        }
      }
    }
  }

  // Step 3: Neural Model Inference
  const messages = [
    { role: 'system', content: `${agent.system_prompt}\n\nYour role: ${agent.role}. Act autonomously on behalf of owner Basterix (Ivan Sabo). Reply to the user in Slovak unless requested otherwise.` },
    ...(Object.keys(toolOutputs).length ? [{ role: 'system', content: `Available tool outputs:\n${JSON.stringify(toolOutputs, null, 2)}` }] : []),
    { role: 'user', content: parsed.input }
  ];

  let rawOutput = '';
  let modelError = null;
  try {
    const modelRes = await callModel(env, 'workers-ai', messages);
    rawOutput = modelRes.text || '';
    if (!rawOutput) modelError = 'Model did not return a text response.';
  } catch (error) {
    modelError = error instanceof Error ? error.message : String(error);
  }

  // Step 4: Self-Reflection & Auto-Correction
  const failedTools = steps.filter(step => step.phase === 'tool_execution' && step.status === 'failed').length;
  const executionStatus = modelError ? 'failed' : failedTools ? 'partial' : 'completed';
  const selfReflection = {
    evaluated: true,
    passed_truth_check: executionStatus === 'completed',
    correction_needed: executionStatus !== 'completed',
    confidence_score: executionStatus === 'completed' ? 1 : 0,
    error: modelError
  };
  steps.push({
    step: steps.length + 1,
    phase: 'self_reflection',
    reflection: selfReflection,
    timestamp: new Date().toISOString()
  });

  const durationMs = Date.now() - startTime;
  const execId = 'exec_' + crypto.randomUUID().slice(0, 12);

  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO ops_agent_executions (id, agent_id, owner_id, input, output, steps_json, status, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(execId, agent.id, ownerId, parsed.input, rawOutput || null, JSON.stringify(steps), executionStatus, durationMs).run();
  }

  return {
    execution_id: execId,
    agent_id: agent.id,
    agent_name: agent.name,
    output: rawOutput || null,
    status: executionStatus,
    error: modelError,
    steps,
    duration_ms: durationMs,
    self_reflection: selfReflection
  };
}

export async function provisionAgentDomain(env, ownerId = 'admin', input) {
  await ensureAgentSandboxTables(env);
  const data = domainProvisionSchema.parse(input);
  const cfToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN;

  if (!cfToken) {
    throw new HttpError(503, 'Cloudflare API token (CF_API_TOKEN / CLOUDFLARE_API_TOKEN) is not configured; domain provisioning aborted.');
  }

  const plannedDnsRecords = [
    { type: 'A', name: '@', content: '192.0.2.1', proxied: true, comment: 'Trinity AI Agent Sandbox Root' },
    { type: 'CNAME', name: 'agent', content: `${data.target_worker}.saboivan2008.workers.dev`, proxied: true, comment: 'Custom Agent Endpoint' },
    { type: 'CNAME', name: 'api', content: `${data.target_worker}.saboivan2008.workers.dev`, proxied: true, comment: 'Agent REST/WebSocket API' },
    { type: 'TXT', name: '@', content: `trinity-agent-verification=${data.agent_id}`, comment: 'Trinity Ownership Proof' }
  ];

  let zoneResp;
  try {
    zoneResp = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(data.domain_name)}`, {
      headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    throw new HttpError(502, `Cloudflare zone lookup failed for ${data.domain_name}: ${err?.message || 'network error'}`);
  }

  if (!zoneResp.ok) {
    throw new HttpError(502, `Cloudflare API returned HTTP ${zoneResp.status} while looking up zone ${data.domain_name}.`);
  }

  const zoneData = await zoneResp.json().catch(() => ({}));
  const matchedZone = (zoneData.result || []).find(z => z.name === data.domain_name);
  if (!matchedZone?.id) {
    throw new HttpError(404, `Cloudflare zone not found for domain ${data.domain_name}; cannot provision without an active Cloudflare zone.`);
  }

  const zoneId = matchedZone.id;
  const liveStatus = 'zone_verified_pending_dns';

  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO ops_agent_domains (domain_name, agent_id, owner_id, zone_id, status, dns_records_json, ssl_mode, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(domain_name) DO UPDATE SET
        agent_id = excluded.agent_id,
        zone_id = excluded.zone_id,
        status = excluded.status,
        dns_records_json = excluded.dns_records_json,
        ssl_mode = excluded.ssl_mode,
        updated_at = datetime('now')
    `).bind(data.domain_name, data.agent_id, ownerId, zoneId, liveStatus, JSON.stringify(plannedDnsRecords), data.ssl_mode).run();

    await env.DB.prepare('UPDATE ops_custom_agents SET domain_binding = ? WHERE id = ?').bind(data.domain_name, data.agent_id).run().catch(() => null);
  }

  await createTrinityDocument(env, ownerId, {
    title: `Cloudflare zone verified for agent: ${data.domain_name}`,
    category: 'domains',
    step_name: 'agent_domain_provision',
    summary: `Cloudflare zone ${zoneId} was verified for ${data.domain_name} and associated with AI agent [${data.agent_id}] (target worker: ${data.target_worker}). DNS records, SSL, and WAF rules were NOT mutated automatically.`,
    tags: ['cloudflare', 'domain', 'agent_sandbox', data.domain_name]
  }).catch(() => null);

  return {
    ok: true,
    domain_name: data.domain_name,
    agent_id: data.agent_id,
    target_worker: data.target_worker,
    zone_id: zoneId,
    status: liveStatus,
    dns_configured: false,
    ssl_configured: false,
    waf_configured: false,
    requested_ssl_mode: data.ssl_mode,
    requested_waf: data.enable_waf,
    planned_dns_records: plannedDnsRecords,
    endpoint: `https://${data.domain_name}`
  };
}
