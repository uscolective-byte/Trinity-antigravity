import {McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {TRINITY_VERSION} from '../src/version.js';

// Auto-resolve credentials from local environment if not already loaded in process
export function loadEnvIfMissing() {
  const needsAuth = !process.env.TRINITY_MCP_TOKEN && !process.env.TRINITY_MCP_API_KEY;
  const needsAccess = (!process.env.CLOUDFLARE_ACCESS_CLIENT_ID && !process.env.CF_ACCESS_CLIENT_ID) ||
                      (!process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET && !process.env.CF_ACCESS_CLIENT_SECRET);
  if (!needsAuth && !needsAccess) return;

  // This bridge only needs its own credentials and target URL. Never import an
  // entire .env file into process.env: that file may contain unrelated secrets.
  const allowedKeys = new Set([
    'TRINITY_MCP_TOKEN',
    'TRINITY_MCP_API_KEY',
    'TRINITY_MCP_URL',
    'CLOUDFLARE_ACCESS_CLIENT_ID',
    'CLOUDFLARE_ACCESS_CLIENT_SECRET',
    'CF_ACCESS_CLIENT_ID',
    'CF_ACCESS_CLIENT_SECRET'
  ]);

  const candidates = [
    process.env.SHARED_ENV_PATH,
    path.join(os.homedir(), '.env')
  ].filter(Boolean);

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
          if (match) {
            const key = match[1];
            if (!allowedKeys.has(key)) continue;
            let val = match[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key] && val) {
              process.env[key] = val;
            }
          }
        }
        if ((process.env.TRINITY_MCP_TOKEN || process.env.TRINITY_MCP_API_KEY) &&
            (process.env.CLOUDFLARE_ACCESS_CLIENT_ID || process.env.CF_ACCESS_CLIENT_ID) &&
            (process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET || process.env.CF_ACCESS_CLIENT_SECRET)) {
          break;
        }
      } catch {}
    }
  }
}

export function parseRemoteResponse(text) {
  const lines = text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).filter(Boolean);
  const payload = lines.length ? JSON.parse(lines.at(-1)) : JSON.parse(text);
  if (payload.error) throw new Error(payload.error.message || 'Trinity MCP request failed.');
  return payload.result;
}

export function registerBridgeTools(server, forward) {
  // Core status and system inspection tools
  server.registerTool('trinity_status', {
    description: 'Read verified Trinity readiness and plugin status.',
    inputSchema: {}
  }, forward('trinity_status'));

  server.registerTool('get_capability_status', {
    description: 'Read current capability configuration, connectivity and execution evidence without secrets.',
    inputSchema: {}
  }, forward('get_capability_status'));

  server.registerTool('diagnostic_ping', {
    description: 'Runs a safe diagnostic ping to verify Tool Registry, Agent Runtime, and Tool Executor connectivity.',
    inputSchema: {
      message: z.string().max(2000).default('ping'),
      idempotency_key: z.string().uuid().optional()
    }
  }, forward('diagnostic_ping'));

  server.registerTool('infrastructure_status', {
    description: 'Read infrastructure health and resource binding status.',
    inputSchema: {}
  }, forward('infrastructure_status'));

  server.registerTool('check_services', {
    description: 'Check actual service-binding reachability.',
    inputSchema: {}
  }, forward('check_services'));

  server.registerTool('trinity_control_panel', {
    description: 'Read Trinity system configuration and control panel state.',
    inputSchema: {}
  }, forward('trinity_control_panel'));

  // Agents, planning and memory tools
  server.registerTool('list_agents', {
    description: 'List Trinity specialist roles.',
    inputSchema: {}
  }, forward('list_agents'));

  server.registerTool('dispatch_to_agent', {
    description: 'Forward a task to another AI system (Gemini, OpenAI / ChatGPT, or Microsoft Copilot Studio).',
    inputSchema: {
      target: z.enum(['gemini', 'openai', 'copilot_studio']),
      prompt: z.string().min(1).max(12000),
      context_key: z.string().max(200).optional()
    }
  }, forward('dispatch_to_agent'));

  server.registerTool('dispatch_task', {
    description: 'Queue bounded work in Trinity; follow with get_task.',
    inputSchema: {
      task: z.string().min(1).max(12000),
      agent: z.string().optional(),
      mode: z.enum(['single', 'team']).optional(),
      provider: z.enum(['workers-ai', 'openai', 'gemini', 'ollama', 'local']).optional(),
      language: z.enum(['sk', 'en']).optional(),
      idempotency_key: z.string().uuid().optional()
    }
  }, forward('dispatch_task'));

  server.registerTool('get_task', {
    description: 'Read task state and verified receipts.',
    inputSchema: {
      id: z.string().uuid()
    }
  }, forward('get_task'));

  server.registerTool('list_tasks', {
    description: 'List current and historical tasks.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional()
    }
  }, forward('list_tasks'));

  server.registerTool('search_memory', {
    description: 'Search shared Trinity memory as untrusted context.',
    inputSchema: {
      query: z.string().max(200)
    }
  }, forward('search_memory'));

  server.registerTool('trinity_memory_sync', {
    description: 'Read, write, or search shared semantic Trinity memory across agents.',
    inputSchema: {
      action: z.enum(['read', 'write', 'search']),
      key: z.string().max(200).optional(),
      payload: z.string().max(10000).optional(),
      source_agent: z.enum(['chatgpt', 'gemini', 'copilot', 'antigravity', 'trinity']).default('trinity')
    }
  }, forward('trinity_memory_sync'));

  server.registerTool('create_daily_plan', {
    description: 'Prepare a Slovak daily plan from provided tasks without calendar edits; requires UUID idempotency_key.',
    inputSchema: {
      date: z.iso.date(),
      tasks: z.array(z.object({
        title: z.string().trim().min(1).max(300),
        minutes: z.number().int().min(5).max(480),
        priority: z.enum(['high', 'normal', 'low']).default('normal')
      }).strict()).min(1).max(20),
      available_minutes: z.number().int().min(15).max(720),
      provider: z.enum(['workers-ai', 'openai', 'gemini']).default('workers-ai'),
      idempotency_key: z.string().uuid()
    }
  }, forward('create_daily_plan'));

  server.registerTool('sync_shared_notes', {
    description: 'Synchronize shared local and cloud notes with revision checks.',
    inputSchema: {
      changes: z.array(z.object({
        id: z.string().uuid(),
        text: z.string().max(8000),
        deleted: z.boolean().default(false),
        base_revision: z.number().int().min(0)
      }).strict()).max(5).default([]),
      cursor: z.string().uuid().optional()
    }
  }, forward('sync_shared_notes'));

  server.registerTool('sovereign_ledger', {
    description: 'Append or list entries in the authoritative D1 sovereign ledger.',
    inputSchema: {
      action: z.enum(['append', 'list']),
      entry: z.record(z.string(), z.unknown()).optional(),
      query: z.record(z.string(), z.unknown()).optional()
    }
  }, forward('sovereign_ledger'));

  // Project, files and actions tools
  server.registerTool('project_inspect', {
    description: 'Inspect relevant source files and pinned commit of Trinity.',
    inputSchema: {
      query: z.string().max(2000).default('')
    }
  }, forward('project_inspect'));

  server.registerTool('project_read', {
    description: 'Read Trinity source file from GitHub without requiring a local PC connection.',
    inputSchema: {
      path: z.string().max(500),
      ref: z.string().regex(/^[a-f0-9]{40}$/).optional()
    }
  }, forward('project_read'));

  server.registerTool('list_project_files', {
    description: 'List the bounded Trinity project workspace.',
    inputSchema: {
      path: z.string().max(500).optional(),
      depth: z.number().int().min(1).max(3).optional()
    }
  }, forward('list_project_files'));

  server.registerTool('get_source_file', {
    description: 'Read a source file through the approved PC bridge.',
    inputSchema: {
      path: z.string().min(1).max(500)
    }
  }, forward('get_source_file'));

  server.registerTool('edit_source_file', {
    description: 'Propose a source-file replacement. It will not run until the owner approves it.',
    inputSchema: {
      path: z.string().min(1).max(500),
      content: z.string().min(1).max(500000),
      rationale: z.string().min(10).max(500),
      expected_sha256: z.union([z.literal('absent'), z.string().regex(/^[a-f0-9]{64}$/)]).optional()
    }
  }, forward('edit_source_file'));

  server.registerTool('pc_find_files', {
    description: 'Find real files in the PC project workspace with coverage limits reported.',
    inputSchema: {
      path: z.string().min(1).max(2000).default('Trinity'),
      glob: z.string().min(1).max(300).default('**/*'),
      limit: z.number().int().min(1).max(200).default(50)
    }
  }, forward('pc_find_files'));

  server.registerTool('pc_search_text', {
    description: 'Search text in the PC project workspace via local bridge preserving lines and coverage limits.',
    inputSchema: {
      path: z.string().min(1).max(2000).default('Trinity'),
      pattern: z.string().min(1).max(2000),
      glob: z.string().min(1).max(300).default('**/*'),
      regex: z.boolean().default(false),
      case_sensitive: z.boolean().default(false),
      context: z.number().int().min(0).max(3).default(0),
      limit: z.number().int().min(1).max(200).default(50)
    }
  }, forward('pc_search_text'));

  server.registerTool('run_build', {
    description: 'Propose a bounded Trinity build on the PC bridge. Follow the returned action until a verified receipt exists.',
    inputSchema: {
      cwd: z.string().max(500).optional()
    }
  }, forward('run_build'));

  server.registerTool('request_project_action', {
    description: 'Propose a bounded project or PC action. Mutations require approval and a completed receipt.',
    inputSchema: {
      action: z.enum(['read', 'write', 'edit', 'selfwrite', 'run', 'deploy', 'share', 'upload', 'upgrade', 'screenshot', 'open_app', 'notify', 'system_info', 'scrape', 'web_fetch', 'download', 'git_commit', 'git_pr']),
      payload: z.record(z.string(), z.unknown()).default({}),
      rationale: z.string().min(5).max(1000)
    }
  }, forward('request_project_action'));

  server.registerTool('get_project_action', {
    description: 'Read the state and receipt of a proposed project action.',
    inputSchema: {
      id: z.string().uuid()
    }
  }, forward('get_project_action'));

  server.registerTool('list_system_actions', {
    description: 'List recent project actions and statuses.',
    inputSchema: {}
  }, forward('list_system_actions'));

  server.registerTool('approve_system_action', {
    description: 'Approve a proposed system action by ID (with optional matching confirmation UUID).',
    inputSchema: {
      id: z.string().uuid(),
      confirmation: z.string().uuid().optional()
    }
  }, forward('approve_system_action'));

  server.registerTool('reject_system_action', {
    description: 'Reject a proposed system action by ID (with optional matching confirmation UUID).',
    inputSchema: {
      id: z.string().uuid(),
      confirmation: z.string().uuid().optional()
    }
  }, forward('reject_system_action'));

  server.registerTool('list_improvements', {
    description: 'List proposed and implemented system improvements.',
    inputSchema: {}
  }, forward('list_improvements'));

  server.registerTool('propose_improvement', {
    description: 'Submit a code improvement proposal for a pinned commit.',
    inputSchema: {
      title: z.string().min(3).max(120),
      description: z.string().min(10).max(4000)
    }
  }, forward('propose_improvement'));

  // PC Bridge and local integration tools
  server.registerTool('pc_status', {
    description: 'Check the PC bridge and its bounded capabilities.',
    inputSchema: {}
  }, forward('pc_status'));

  server.registerTool('pc_open_url', {
    description: 'Open approved URL on PC desktop.',
    inputSchema: {
      url: z.string().min(1).max(2048)
    }
  }, forward('pc_open_url'));

  server.registerTool('pc_run_command', {
    description: 'Propose running a bounded command on the local PC (requires approval).',
    inputSchema: {
      command: z.string().min(1).max(2000),
      cwd: z.string().max(500).optional(),
      rationale: z.string().min(5).max(300)
    }
  }, forward('pc_run_command'));

  server.registerTool('pc_run_script', {
    description: 'Propose running a stored Node/Python/CMD script via the PC bridge with exact SHA-256 verification and separate approval.',
    inputSchema: {
      runtime: z.enum(['node', 'python', 'cmd']),
      path: z.string().regex(/^Trinity\/workspace\/scripts\/[A-Za-z0-9_./-]+$/),
      expected_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      args: z.array(z.string().max(2000)).max(20).default([]),
      timeout_ms: z.number().int().min(1000).max(600000).default(30000),
      rationale: z.string().min(10).max(500)
    }
  }, forward('pc_run_script'));

  server.registerTool('copilot_chat', {
    description: 'Run a query through the Trinity Copilot Agent with skills, plugins, and analysis.',
    inputSchema: {
      query: z.string().min(1).max(12000),
      session_id: z.string().uuid().optional(),
      agent: z.string().optional()
    }
  }, forward('copilot_chat'));

  // Ecosystem and synthesis tools
  server.registerTool('ecosystem_stats', {
    description: 'Read multi-worker ecosystem operational metrics.',
    inputSchema: {}
  }, forward('ecosystem_stats'));

  server.registerTool('search_ecosystem', {
    description: 'Search across Trinity ecosystem apps, plugins, and skills by query or domain.',
    inputSchema: {
      query: z.string().default(''),
      type: z.enum(['app', 'plugin', 'skill']).optional(),
      domain: z.string().optional()
    }
  }, forward('search_ecosystem'));

  server.registerTool('synthesize_skill', {
    description: 'Synthesize a new modular capability or skill specification.',
    inputSchema: {
      name: z.string().min(2).max(100),
      domain: z.string().default('software-dev')
    }
  }, forward('synthesize_skill'));

  server.registerTool('synthesize_plugin', {
    description: 'Synthesize a new agent plugin specification linking selected skills.',
    inputSchema: {
      name: z.string().min(2).max(100),
      domain: z.string().default('software-dev'),
      skills: z.array(z.string()).default([])
    }
  }, forward('synthesize_plugin'));

  server.registerTool('synthesize_app', {
    description: 'Synthesize a new application specification in the Trinity ecosystem.',
    inputSchema: {
      name: z.string().min(2).max(100),
      domain: z.string().default('software-dev'),
      type: z.string().default('web-app')
    }
  }, forward('synthesize_app'));

  server.registerTool('trigger_brain_cycle', {
    description: 'Trigger an autonomous Trinity cognitive cycle.',
    inputSchema: {}
  }, forward('trigger_brain_cycle'));

  server.registerTool('trigger_evolution_cycle', {
    description: 'Trigger an evolution optimization pass.',
    inputSchema: {}
  }, forward('trigger_evolution_cycle'));

  server.registerTool('azure_foundry_agent_status', {
    description: 'Query Azure AI Foundry external agent connectivity and configuration.',
    inputSchema: {}
  }, forward('azure_foundry_agent_status'));

  server.registerTool('azure_foundry_agent_invoke', {
    description: 'Send a request to the Trinity agent on Microsoft Azure AI Foundry.',
    inputSchema: {
      message: z.string().min(1).max(12000),
      agent: z.string().optional(),
      conversation_id: z.string().optional()
    }
  }, forward('azure_foundry_agent_invoke'));

  server.registerTool('google_ai_studio_status', {
    description: 'Return metadata-only configuration status for the Google AI Studio Bridge without accessing secret values.',
    inputSchema: {}
  }, forward('google_ai_studio_status'));

  server.registerTool('google_ai_studio_models', {
    description: 'List available Gemini models from Google AI Studio using server-side credentials.',
    inputSchema: {
      page_size: z.number().int().min(1).max(1000).optional()
    }
  }, forward('google_ai_studio_models'));

  server.registerTool('google_ai_studio_cocreate', {
    description: 'Run multi-turn collaborative co-creation between Trinity and Google AI Studio.',
    inputSchema: {
      task: z.string().min(1).max(8000),
      mode: z.enum(['pair', 'brainstorm', 'review', 'build_artifact']).optional(),
      session_id: z.string().max(120).optional(),
      model: z.string().max(120).optional(),
      context: z.string().max(12000).optional(),
      artifact: z.string().max(50000).optional(),
      reply_language: z.enum(['sk', 'en', 'auto']).optional()
    }
  }, forward('google_ai_studio_cocreate'));

  return server;
}

function startStdioBridge() {
  loadEnvIfMissing();

  const token = process.env.TRINITY_MCP_TOKEN || process.env.TRINITY_MCP_API_KEY;
  if (!token) throw new Error('TRINITY_MCP_TOKEN or TRINITY_MCP_API_KEY is missing. Configure SHARED_ENV_PATH or process.env.');

  const accessClientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID || process.env.CF_ACCESS_CLIENT_ID;
  const accessClientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET || process.env.CF_ACCESS_CLIENT_SECRET;
  if (Boolean(accessClientId) !== Boolean(accessClientSecret)) {
    throw new Error('Both Cloudflare Access service-token values are required when Access authentication is configured.');
  }

  const base = (process.env.TRINITY_MCP_URL || 'https://auru.space').replace(/\/$/, '');
  let requestId = 0;

  async function remoteTool(name, args = {}) {
    const headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    };
    if (accessClientId && accessClientSecret) {
      headers['CF-Access-Client-Id'] = accessClientId;
      headers['CF-Access-Client-Secret'] = accessClientSecret;
    }
    const response = await fetch(base + '/mcp', {
      method: 'POST',
      redirect: 'manual',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method: 'tools/call', params: { name, arguments: args } }),
      signal: AbortSignal.timeout(70_000)
    });
    if (response.status === 302) {
      const loc = response.headers.get('location') || '';
      throw new Error(`Trinity MCP blocked by Cloudflare Zero Trust Access login redirect (HTTP 302 -> ${loc}). Ensure CF-Access-Client-Id and CF-Access-Client-Secret are configured.`);
    }
    if (response.status === 403) {
      throw new Error('Trinity MCP blocked by Cloudflare Access or Trinity authorization (HTTP 403 Forbidden). Check Access credentials and Bearer token.');
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`Trinity MCP HTTP ${response.status}`);
    return parseRemoteResponse(text);
  }

  const forward = name => async args => remoteTool(name, args);

  serveStdio(() => {
    const server = new McpServer(
      { name: 'trinity-secure-bridge', version: TRINITY_VERSION },
      { instructions: 'Read status first. Mutating project or PC actions are proposals until Trinity returns a completed receipt. Never expose credentials or claim that a queued/proposed action already ran.' }
    );
    return registerBridgeTools(server, forward);
  }, {
    onerror: error => console.error(JSON.stringify({ event: 'trinity_mcp_error', message: error.message }))
  });
}

const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  startStdioBridge();
}
