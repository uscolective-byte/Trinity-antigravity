/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module orchestrator.js (Trinity/src/orchestrator.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity Active Orchestration Layer (src/orchestrator.js)
 * 
 * Provides unified, real-time coordination across all 23 specialized workers in the Trinity ecosystem
 * (plus auxiliary bindings JERICHO_SERVICE, PC_BRIDGE_V2, CHAT_INFERENCE_SERVICE):
 * - 10 AURA workers: aura_analyzer, aura_architect, aura_codegen, aura_deployer, aura_evolver,
 *                   aura_memory, aura_optimizer, aura_planner, aura_sentinel, aura_tester
 * - 8 Core Trinity workers: trinity-core, trinity-builder, trinity-dispatcher, trinity-connectors,
 *                           trinity-guardian, trinity-memory, trinity-sentinel, trinity-skills
 * - 5 Specialized workers: trinity-knowledge, trinity-capacity, trinity-integrations,
 *                          trinity-pc-bridge, trinity-audit
 */

import { boundedText } from './services.js';

export const WORKER_CATALOG = {
  // ── AURA SPECIALISTS ──
  AURA_ANALYZER: {
    service: 'aura_analyzer',
    name: 'AURA Analyzer',
    domain: 'analysis',
    probeAction: 'aura.status',
    role: 'Deep static and dynamic code analysis, data flow inspection, and system health diagnostics',
    actions: ['analyze.code', 'analyze.data', 'analyze.system', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_ARCHITECT: {
    service: 'aura_architect',
    name: 'AURA Architect',
    domain: 'architecture',
    probeAction: 'aura.status',
    role: 'System architecture, interface diagrams, microservice topology, and design evaluation',
    actions: ['architect.design', 'architect.review', 'architect.evaluate', 'architect.diagram', 'architect.edge.add', 'architect.graph', 'architect.node.add', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_CODEGEN: {
    service: 'aura_codegen',
    name: 'AURA Codegen',
    domain: 'coding',
    probeAction: 'aura.status',
    role: 'Production code generation, refactoring, scaffolding, SQL migrations, and technical documentation',
    actions: ['codegen.generate', 'codegen.refactor', 'codegen.scaffold', 'codegen.docs', 'codegen.migration', 'codegen.sql', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_DEPLOYER: {
    service: 'aura_deployer',
    name: 'AURA Deployer',
    domain: 'deployment',
    probeAction: 'aura.status',
    role: 'Verification and guarded release deployment to Cloudflare Edge',
    actions: ['deploy.stage', 'deploy.list', 'deploy.complete', 'deploy.rollback', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_EVOLVER: {
    service: 'aura_evolver',
    name: 'AURA Evolver',
    domain: 'evolution',
    probeAction: 'aura.status',
    role: 'Self-improvement, reflective cycles, evolutionary proposals, and quality evaluation',
    actions: ['evolve.propose', 'evolve.history', 'evolve.reflections', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_MEMORY: {
    service: 'aura_memory',
    name: 'AURA Memory Specialist',
    domain: 'memory',
    probeAction: 'aura.status',
    role: 'Long-term memory consolidation, semantic synthesis, and neural knowledge linking',
    actions: ['memory.synthesize', 'memory.consolidate', 'memory.semantic.search', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_OPTIMIZER: {
    service: 'aura_optimizer',
    name: 'AURA Optimizer',
    domain: 'optimization',
    probeAction: 'aura.status',
    role: 'Token optimization, SQL query tuning, compute performance, and latency reduction',
    actions: ['optimize.system', 'optimize.query', 'optimize.tokens', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_PLANNER: {
    service: 'aura_planner',
    name: 'AURA Planner',
    domain: 'planning',
    probeAction: 'aura.status',
    role: 'Hierarchical task decomposer, project planner, milestones, and timelines',
    actions: ['plan.task', 'plan.project', 'plan.sprint', 'plan.timeline', 'plan.create', 'plan.decompose', 'plan.goals', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_SENTINEL: {
    service: 'aura_sentinel',
    name: 'AURA Sentinel',
    domain: 'security',
    probeAction: 'aura.status',
    role: 'Active security monitor, anomaly detection, vulnerability scanning, and alerts',
    actions: ['sentinel.alert', 'sentinel.monitor', 'sentinel.scan', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_TESTER: {
    service: 'aura_tester',
    name: 'AURA Tester',
    domain: 'testing',
    probeAction: 'aura.status',
    role: 'Automated test generation and execution, endpoint validation, and regression checks',
    actions: ['test.endpoint', 'test.generate', 'test.system', 'test.validate', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },

  // ── CORE WORKERS ──
  CORE: {
    service: 'trinity-core',
    name: 'Trinity Core',
    domain: 'reasoning',
    probeAction: 'core.state.get',
    role: 'Core reasoning engine, cognitive deliberation, Trinity state, and decision matrix',
    actions: ['core.run', 'core.reason', 'core.reflect', 'core.state.get', 'core.state.set', 'core.personality.get', 'core.personality.set', 'core.brain.state', 'core.decide']
  },
  BUILDER: {
    service: 'trinity-builder',
    name: 'Trinity Builder',
    domain: 'coding',
    probeAction: 'build.list',
    role: 'Storage and compilation of verified code blocks and scripts',
    actions: ['build.store', 'build.list', 'build.get', 'build.code']
  },
  DISPATCHER: {
    service: 'trinity-dispatcher',
    name: 'Trinity Dispatcher',
    domain: 'dispatch',
    probeAction: 'job.list',
    role: 'Task queuing, agent assignment, and compute capacity routing',
    actions: ['task.create', 'task.list', 'job.create', 'job.list', 'route_aura', 'dispatch']
  },
  CONNECTORS: {
    service: 'trinity-connectors',
    name: 'Trinity Connectors',
    domain: 'connectors',
    probeAction: 'connect.list',
    role: 'Management of external connectors and authorized integration bridges',
    actions: ['connect.list', 'connect.register', 'connect.test', 'browser.render', 'browser.scrape', 'connect.browser.run']
  },
  GUARDIAN: {
    service: 'trinity-guardian',
    name: 'Trinity Guardian',
    domain: 'security',
    probeAction: 'audit.list',
    role: 'System supervision, infrastructure health integrity, and audit records',
    actions: ['audit.list', 'guardian.check']
  },
  MEMORY: {
    service: 'trinity-memory',
    name: 'Trinity Memory Store',
    domain: 'memory',
    probeAction: 'health',
    acceptStatuses: [200],
    role: 'Key-value store for persistent notes and system states',
    actions: ['memory.get', 'memory.set', 'memory.list']
  },
  SENTINEL: {
    service: 'trinity-sentinel',
    name: 'Trinity Sentinel Monitor',
    domain: 'monitoring',
    probeAction: 'monitor.health',
    role: 'Monitoring of tokens, system errors, health statuses, and autonomous processes',
    actions: ['monitor.health', 'monitor.scan', 'monitor.tokens', 'monitor.events', 'monitor.autonomous.list']
  },
  SKILLS: {
    service: 'trinity-skills',
    name: 'Trinity Skills Engine',
    domain: 'skills',
    probeAction: 'skill.list',
    role: 'Catalog, registration, and remote execution of Trinity skills',
    actions: ['skill.list', 'skill.register', 'skill.execute', 'skill.enable', 'skill.disable', 'plugin.list']
  },

  // ── SPECIALIZED STANDALONE WORKERS ──
  KNOWLEDGE_SERVICE: {
    service: 'trinity-knowledge',
    name: 'Trinity Knowledge Base',
    domain: 'knowledge',
    probeAction: 'status',
    role: 'Semantic search and management of verified documents in the knowledge base',
    rpc: true
  },
  CAPACITY_SERVICE: {
    service: 'trinity-capacity',
    name: 'Trinity Capacity Ledger',
    domain: 'capacity',
    probeAction: 'status',
    role: 'Daily quota management, work unit reservation, and overload protection',
    rpc: true,
    rest: true
  },
  INTEGRATIONS_SERVICE: {
    service: 'trinity-integrations',
    name: 'Trinity Integrations',
    domain: 'integrations',
    probeAction: 'status',
    role: 'Firecrawl web scraping, Firebase synchronization, and external cloud integrations',
    rpc: true,
    rest: true
  },
  PC_BRIDGE_SERVICE: {
    service: 'trinity-pc-bridge',
    name: 'Trinity PC Bridge',
    domain: 'bridge',
    probeAction: 'status',
    role: 'Bidirectional bridge to the local PC (scripts, applications, files, screenshots)',
    rpc: true,
    rest: true
  },
  AUDIT_SERVICE: {
    service: 'trinity-audit',
    name: 'Trinity Audit Worker',
    domain: 'audit',
    probeAction: 'openapi.json',
    role: 'Cryptographically verified CI/CD audit records and commit tracking',
    rest: true
  }
};

export const AUXILIARY_WORKER_CATALOG = {
  JERICHO_SERVICE: {
    service: 'jericho123',
    name: 'Jericho123 Crypto Super-Agent',
    domain: 'crypto',
    probeAction: 'api/status',
    role: 'Autonomous crypto super-agent, Tetrakis ($TTK) treasury analytics, market signals, and DeFi yields',
    rpc: true,
    rest: true,
    actions: ['status', 'ping', 'getPrices', 'getSignals', 'getTreasury', 'getTetrakisInfo', 'executeWorkCycle', 'api/status', 'api/prices', 'api/signals', 'api/treasury', 'api/yields', 'api/tetrakis']
  },
  PC_BRIDGE_V2: {
    service: 'trinity-pc-bridge-v2',
    name: 'Trinity PC Bridge v2',
    domain: 'bridge',
    probeAction: 'status',
    role: 'Secondary bridge for local commands and desktop integration',
    rpc: true,
    rest: true
  },
  CHAT_INFERENCE_SERVICE: {
    service: 'trinity-chat-inference',
    name: 'Trinity Fast Chat Inference Worker',
    domain: 'inference',
    probeAction: 'health',
    role: 'Dedicated low-latency AI inference worker for instant chat replies',
    rest: true
  },
  RESEARCHER_SERVICE: {
    service: 'trinity-agent-researcher',
    name: 'Trinity Research Specialist',
    domain: 'research',
    probeAction: 'health',
    role: 'Autonomous research agent with Llama 3.3 70B synthesis, web research, and memory persistence',
    rest: true,
    actions: ['health', 'research', 'research/history']
  },
  GEMINI_BRIDGE_SERVICE: {
    service: 'trinity-gemini',
    name: 'Trinity Google Gemini Bridge',
    domain: 'multimodal',
    probeAction: 'health',
    role: 'Google Gemini 2.5 Flash gateway with R2 artifacts, KV storage, and direct bridging',
    rest: true,
    actions: ['health', 'tools', 'generate']
  },
  OPS_SERVICE: {
    service: 'trinity-ops',
    name: 'Trinity Ops Proxy',
    domain: 'operations',
    probeAction: 'health',
    role: 'Dedicated operational proxy manager for /api/ops/ and /mcp requests',
    rest: true,
    actions: ['health']
  },
  CHAT_MAINTAINER_SERVICE: {
    service: 'trinity-chat-maintainer',
    name: 'Trinity Chat Maintainer',
    domain: 'maintenance',
    probeAction: 'getStatus',
    role: 'Chat quality oversight, response verification, and stuck-job detection',
    rpc: true,
    actions: ['getStatus', 'inspect', 'reviewReply']
  },
  DEPLOYER_SERVICE: {
    service: 'trinity-deployer',
    name: 'Trinity Deployer',
    domain: 'deployment',
    probeAction: 'health',
    role: 'Code snapshot manager and guarded deployments via CODE_KV',
    rest: true,
    actions: ['health']
  },
  SEEDER_SERVICE: {
    service: 'trinity-seeder',
    name: 'Trinity Seeder',
    domain: 'database',
    probeAction: 'health',
    role: 'Initialization and migration seeder for D1 databases',
    rest: true,
    actions: ['health']
  }
};

/**
 * Invokes a specific worker through Cloudflare service binding or RPC.
 */
export async function delegateWorker(env, workerBinding, action, data = {}, options = {}) {
  const meta = WORKER_CATALOG[workerBinding] || AUXILIARY_WORKER_CATALOG[workerBinding];
  if (!meta) {
    throw new Error(`Unknown worker binding: ${workerBinding}`);
  }

  const binding = env[workerBinding];
  if (!binding) {
    return {
      ok: false,
      worker: workerBinding,
      status: 'not_configured',
      error: `Worker ${meta.name} (${workerBinding}) is not bound in this environment.`
    };
  }

  const timeoutMs = options.timeoutMs || 15000;
  const traceId = options.traceId || crypto.randomUUID();
  const idempotency_key = options.idempotency_key || (options.mutating ? crypto.randomUUID() : undefined);
  const approval = options.approval !== undefined ? options.approval : (options.actor ? { approved: options.approved !== false, actor_role: options.actor.role || 'user', actor_id: options.actor.id, request_id: crypto.randomUUID() } : null);

  const started = Date.now();

  try {
    // 1. RPC invocation (e.g. KNOWLEDGE_SERVICE, CAPACITY_SERVICE, INTEGRATIONS_SERVICE, PC_BRIDGE_SERVICE, JERICHO_SERVICE)
    if (meta.rpc) {
      if (typeof binding[action] === 'function') {
        const result = await Promise.race([
          binding[action](data),
          new Promise((_, reject) => setTimeout(() => reject(new Error('RPC Timeout')), timeoutMs))
        ]);
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if (typeof binding.search === 'function' && (action === 'search' || !action)) {
        const query = typeof data === 'string' ? data : data.query || '';
        const result = await binding.search(query);
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if ((action === 'status' || action === 'aura.status') && (typeof binding.getStatus === 'function' || typeof binding.status === 'function')) {
        const fn = typeof binding.getStatus === 'function' ? () => binding.getStatus() : () => binding.status();
        const result = await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('RPC Timeout')), timeoutMs))
        ]);
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if ((action === 'skills' || action === 'skill.list' || action === 'aura.skills') && typeof binding.listSkills === 'function') {
        const result = await binding.listSkills();
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if ((action === 'plugins' || action === 'plugin.list') && typeof binding.listPlugins === 'function') {
        const result = await binding.listPlugins();
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if ((action === 'execute_skill' || action === 'skill.execute' || action === 'aura.execute_skill') && typeof binding.executeSkill === 'function') {
        const result = await binding.executeSkill(data.skill || data.name, data.params || data);
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
    }

    const internalSecret = env?.TRINITY_INTERNAL_KEY || env?.TRINITY_GATEWAY_KEY || '';
    const internalHeaders = {
      'Content-Type': 'application/json',
      ...(internalSecret ? { 'Authorization': `Bearer ${internalSecret}` } : {})
    };

    // 2. REST call (e.g., MEMORY, AUDIT_SERVICE, JERICHO_SERVICE, or fallback for RPC when only fetch is mocked in tests)
    if (meta.rest || workerBinding === 'MEMORY' || (meta.rpc && typeof binding.fetch === 'function')) {
      const cleanAction = (action === 'status' || action === 'aura.status') ? (meta.probeAction && meta.probeAction !== 'status' ? meta.probeAction : 'health') : action;
      const path = options.path || (cleanAction.startsWith('/') ? cleanAction : `/${cleanAction}`);
      const method = options.method || (options.mutating || Object.keys(data).length > 0 ? 'POST' : 'GET');
      const init = {
        method,
        headers: internalHeaders,
        signal: AbortSignal.timeout(timeoutMs)
      };
      if (method === 'POST') {
        init.body = JSON.stringify(data);
      }
      const response = await binding.fetch(`https://trinity.internal${path}`, init);
      const text = await boundedText(response);
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { text }; }
      const accepted = response.ok || (Array.isArray(meta.acceptStatuses) && meta.acceptStatuses.includes(response.status));
      return {
        ok: accepted,
        status: response.status,
        worker: workerBinding,
        result: payload,
        duration_ms: Date.now() - started,
        traceId
      };
    }

    // 3. Standard Action-based POST call (AURA workers, CORE, DISPATCHER, BUILDER, GUARDIAN, SENTINEL, SKILLS)
    const payload = {
      action,
      data,
      traceId,
      idempotency_key,
      approval
    };

    const response = await binding.fetch('https://trinity.internal/', {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const text = await boundedText(response);
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    const success = response.ok && result.ok !== false;

    // Audit logging to D1
    if (env.DB) {
      env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('orchestrator_delegation', ?)")
        .bind(JSON.stringify({ worker: workerBinding, action, success, duration_ms: Date.now() - started, traceId }))
        .run()
        .catch(() => {});
    }

    return {
      ok: success,
      status: response.status,
      worker: workerBinding,
      action,
      result: result.result || result,
      duration_ms: Date.now() - started,
      traceId
    };
  } catch (err) {
    return {
      ok: false,
      worker: workerBinding,
      action,
      error: err.message,
      duration_ms: Date.now() - started,
      traceId
    };
  }
}

/**
 * Full multi-agent task orchestration across bound Cloudflare Workers:
 * 1. Decomposition and planning (AURA_PLANNER / CORE)
 * 2. Parallel specialist execution (AURA_ANALYZER, AURA_ARCHITECT, AURA_CODEGEN, AURA_TESTER, AURA_OPTIMIZER, SKILLS, KNOWLEDGE_SERVICE, JERICHO_SERVICE, CAPACITY_SERVICE)
 * 3. Security audit and synthesis (AURA_SENTINEL / GUARDIAN)
 */
export async function orchestratePipeline(env, task, options = {}) {
  const started = Date.now();
  const traceId = crypto.randomUUID();
  const executionLog = [];

  const taskLower = String(task).toLowerCase();

  // PHASE 1: Planning and decomposition
  let planResult = null;
  if (env.AURA_PLANNER) {
    planResult = await delegateWorker(env, 'AURA_PLANNER', 'plan.task', { prompt: task, title: task.slice(0, 80) }, { traceId, idempotency_key: crypto.randomUUID() });
    executionLog.push({ phase: 'planning', worker: 'AURA_PLANNER', ok: planResult.ok, result: planResult.result });
  } else if (env.CORE) {
    planResult = await delegateWorker(env, 'CORE', 'core.reason', { prompt: `Decompose this request into concrete steps. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.\n\nRequest: ${task}` }, { traceId });
    executionLog.push({ phase: 'planning', worker: 'CORE', ok: planResult.ok, result: planResult.result });
  }

  // PHASE 2: Domain-based specialist selection and invocation
  const specialistCalls = [];

  // Coding & Refactoring (Slovak + English input patterns)
  if (/\b(kód|kod|code|funkci|function|program|script|refactor|implement|vygeneruj|generate|napíš kód|write code)\b/i.test(taskLower)) {
    if (env.AURA_CODEGEN) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_CODEGEN', 'codegen.generate', { prompt: task, language: 'javascript' }, { traceId, idempotency_key: crypto.randomUUID() })
          .then(async res => {
            executionLog.push({ phase: 'codegen', worker: 'AURA_CODEGEN', ok: res.ok, result: res.result });
            if (res.ok && env.AURA_TESTER && res.result) {
              const testRes = await delegateWorker(env, 'AURA_TESTER', 'test.validate', { code: JSON.stringify(res.result) }, { traceId });
              executionLog.push({ phase: 'testing', worker: 'AURA_TESTER', ok: testRes.ok, result: testRes.result });
            }
          })
      );
    }
  }

  // Architecture and design
  if (/\b(architekt|architect|dizajn|design|navrh|systém|system|databáz|database|schema|diagram|komponent|component|ui)\b/i.test(taskLower)) {
    if (env.AURA_ARCHITECT) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_ARCHITECT', 'architect.design', { prompt: task }, { traceId, idempotency_key: crypto.randomUUID() })
          .then(res => executionLog.push({ phase: 'architecture', worker: 'AURA_ARCHITECT', ok: res.ok, result: res.result }))
      );
    }
  }

  // Code and data analysis
  if (/\b(analyz|skontroluj|over|audit|prever|verify|check|chyby|bugy|bugs|výkon|performance|metriky|metrics)\b/i.test(taskLower)) {
    if (env.AURA_ANALYZER) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_ANALYZER', 'analyze.code', { code: task }, { traceId, idempotency_key: crypto.randomUUID() })
          .then(res => executionLog.push({ phase: 'analysis', worker: 'AURA_ANALYZER', ok: res.ok, result: res.result }))
      );
    }
  }

  // Optimization
  if (/\b(optimaliz|optimi|zrýchli|zrychli|token|query|latencia|latency|výkon|vyleps|improve)\b/i.test(taskLower)) {
    if (env.AURA_OPTIMIZER) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_OPTIMIZER', 'optimize.tokens', { prompt: task }, { traceId })
          .then(res => executionLog.push({ phase: 'optimization', worker: 'AURA_OPTIMIZER', ok: res.ok, result: res.result }))
      );
    }
  }

  // Knowledge base
  if (/\b(znalost|knowledge|dokument|document|vedomost|hľadaj v znalostiach|knowhow)\b/i.test(taskLower)) {
    if (env.KNOWLEDGE_SERVICE) {
      specialistCalls.push(
        delegateWorker(env, 'KNOWLEDGE_SERVICE', 'search', { query: task }, { traceId })
          .then(res => executionLog.push({ phase: 'knowledge', worker: 'KNOWLEDGE_SERVICE', ok: res.ok, result: res.result }))
      );
    }
  }

  // Crypto, Tetrakis & Treasury via Jericho123
  if (/\b(krypto|crypto|bitcoin|eth|solana|tetrakis|ttk|trk|jericho|treasury|defi|yield)\b/i.test(taskLower)) {
    if (env.JERICHO_SERVICE) {
      specialistCalls.push(
        delegateWorker(env, 'JERICHO_SERVICE', 'api/signals', {}, { traceId })
          .then(res => executionLog.push({ phase: 'crypto_signals', worker: 'JERICHO_SERVICE', ok: res.ok, result: res.result }))
      );
    }
  }

  // Await completion of all specialist invocations
  if (specialistCalls.length > 0) {
    await Promise.allSettled(specialistCalls);
  }

  // PHASE 3: Security audit and Sentinel check
  if (env.AURA_SENTINEL) {
    const sentinelCheck = await delegateWorker(env, 'AURA_SENTINEL', 'sentinel.scan', {}, { traceId });
    executionLog.push({ phase: 'sentinel_scan', worker: 'AURA_SENTINEL', ok: sentinelCheck.ok, result: sentinelCheck.result });
  }

  // PHASE 4: Result synthesis
  const successfulSteps = executionLog.filter(l => l.ok);
  const failedSteps = executionLog.filter(l => !l.ok);
  const status = (failedSteps.length === 0 && successfulSteps.length > 0) ? 'complete' : (successfulSteps.length > 0 ? 'partial' : 'failed');
  const isOk = status === 'complete';

  return {
    ok: isOk,
    status,
    traceId,
    duration_ms: Date.now() - started,
    task,
    total_phases: executionLog.length,
    successful_phases: successfulSteps.length,
    failed_phases: failedSteps.length,
    executionLog
  };
}

/**
 * Inspects health across the full 23-worker fleet (plus auxiliary workers JERICHO_SERVICE, CHAT_INFERENCE_SERVICE, PC_BRIDGE_V2, etc.).
 */
export async function inspectFleet(env) {
  const bindings = Object.keys(WORKER_CATALOG);
  const results = await Promise.all(
    bindings.map(async binding => {
      const meta = WORKER_CATALOG[binding];
      const configured = Boolean(env[binding]);
      if (!configured) {
        return { binding, service: meta.service, name: meta.name, status: 'not_configured', role: meta.role };
      }
      const probeAction = meta.probeAction || (meta.rpc ? 'status' : 'aura.status');
      const probe = await delegateWorker(env, binding, probeAction, { limit: 1 }, { timeoutMs: 4000 });
      return {
        binding,
        service: meta.service,
        name: meta.name,
        status: probe.ok ? 'online' : 'unreachable',
        duration_ms: probe.duration_ms,
        role: meta.role
      };
    })
  );

  const auxBindings = Object.keys(AUXILIARY_WORKER_CATALOG);
  const auxiliary_workers = await Promise.all(
    auxBindings.map(async binding => {
      const meta = AUXILIARY_WORKER_CATALOG[binding];
      const configured = Boolean(env[binding]);
      if (!configured) {
        return { binding, service: meta.service, name: meta.name, status: 'not_configured', role: meta.role };
      }
      const probe = await delegateWorker(env, binding, meta.probeAction || 'status', {}, { timeoutMs: 4000 });
      return {
        binding,
        service: meta.service,
        name: meta.name,
        status: probe.ok ? 'online' : 'unreachable',
        duration_ms: probe.duration_ms,
        role: meta.role
      };
    })
  );

  const online = results.filter(r => r.status === 'online').length;
  const total = results.length;

  return {
    fleet: 'Trinity 23-Worker Autonomous Fleet',
    total_workers: total,
    online_count: online,
    offline_count: total - online,
    workers: results,
    auxiliary_workers,
    checked_at: new Date().toISOString()
  };
}
