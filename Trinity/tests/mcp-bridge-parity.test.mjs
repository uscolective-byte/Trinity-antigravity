import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {z} from 'zod';
import {registerBridgeTools} from '../scripts/trinity-codex-mcp.mjs';
import {tapDiagnosticInput} from '../src/tap-mcp-adapter.js';
import {dailyPlanShape} from '../src/daily-planner.js';
import {sharedNotesInput} from '../src/shared-notes.js';
import {PC_TOOL_SCHEMAS} from '../src/tools.js';

const mcpSource = fs.readFileSync(new URL('../src/mcp.js', import.meta.url), 'utf8');
const bridgeSource = fs.readFileSync(new URL('../scripts/trinity-codex-mcp.mjs', import.meta.url), 'utf8');

function extractBalancedObject(source, openBraceIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inRegex = false;
  let escaped = false;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && (inSingle || inDouble || inTemplate || inRegex)) {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && !inRegex && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && !inRegex && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && !inRegex && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  throw new Error('Unbalanced brace while parsing MCP inputSchema');
}

function extractTopLevelKeysFromObjectLiteral(objLiteral) {
  const inner = objLiteral.slice(1, -1);
  const keys = [];
  let depth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let segmentStart = 0;

  const processSegment = raw => {
    const seg = raw.trim();
    if (!seg) return;
    const spreadMatch = seg.match(/^\.\.\.([A-Za-z0-9_.$[\]]+)$/);
    if (spreadMatch) {
      const expr = spreadMatch[1];
      if (expr === 'PC_TOOL_SCHEMAS.pc_run_script.shape') {
        keys.push(...Object.keys(PC_TOOL_SCHEMAS.pc_run_script.shape));
        return;
      }
      throw new Error(`Unsupported spread expression in mcp.js schema: ${expr}`);
    }
    const keyMatch = seg.match(/^['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*:/);
    if (keyMatch) keys.push(keyMatch[1]);
  };

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && (inSingle || inDouble || inTemplate)) {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    else if (ch === ',' && depth === 0 && parenDepth === 0 && bracketDepth === 0) {
      processSegment(inner.slice(segmentStart, i));
      segmentStart = i + 1;
    }
  }
  processSegment(inner.slice(segmentStart));
  return keys;
}

function parseMcpServerTools(source) {
  const tools = new Map();

  // 1. Direct server.registerTool('name', { ... inputSchema: ... })
  const directRe = /server\.registerTool\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*,\s*\{/g;
  for (const match of source.matchAll(directRe)) {
    const name = match[1];
    const configOpen = match.index + match[0].length - 1;
    const configObj = extractBalancedObject(source, configOpen);
    const schemaIdx = configObj.indexOf('inputSchema:');
    assert.ok(schemaIdx !== -1, `Tool ${name} in mcp.js is missing inputSchema`);
    const afterSchema = configObj.slice(schemaIdx + 'inputSchema:'.length).trimStart();

    let keys = [];
    if (afterSchema.startsWith('{')) {
      const schemaObj = extractBalancedObject(afterSchema, 0);
      keys = extractTopLevelKeysFromObjectLiteral(schemaObj);
    } else if (afterSchema.startsWith('tapDiagnosticInput.shape')) {
      keys = Object.keys(tapDiagnosticInput.shape);
    } else if (afterSchema.startsWith('sharedNotesInput.shape')) {
      keys = Object.keys(sharedNotesInput.shape);
    } else if (afterSchema.startsWith('dailyPlanShape')) {
      keys = Object.keys(dailyPlanShape);
    } else {
      throw new Error(`Unhandled inputSchema expression for ${name}: ${afterSchema.slice(0, 60)}`);
    }
    assert.ok(!tools.has(name), `Duplicate tool registration in mcp.js: ${name}`);
    tools.set(name, keys.sort());
  }

  // 2. registerAppTool(server, 'name', { ... inputSchema: z.object({}) ... })
  const appToolRe = /registerAppTool\(\s*server\s*,\s*['"]([a-zA-Z0-9_-]+)['"]\s*,\s*\{/g;
  for (const match of source.matchAll(appToolRe)) {
    const name = match[1];
    const configOpen = match.index + match[0].length - 1;
    const configObj = extractBalancedObject(source, configOpen);
    assert.match(configObj, /inputSchema\s*:\s*z\.object\(\s*\{\s*\}\s*\)/, `Unexpected app tool inputSchema for ${name}`);
    assert.ok(!tools.has(name), `Duplicate app tool registration in mcp.js: ${name}`);
    tools.set(name, []);
  }

  // 3. Loop-registered PC search tools: for (const [name, mode] of [['pc_find_files', 'files'], ['pc_search_text', 'content']])
  const loopMatch = source.match(/for\s*\(\s*const\s*\[\s*name\s*,\s*mode\s*\]\s*of\s*(\[[\s\S]*?\])\s*\)\s*\{[\s\S]*?server\.registerTool\(\s*name\b/);
  assert.ok(loopMatch, 'Expected loop registration for pc_find_files / pc_search_text in mcp.js');
  for (const pairMatch of loopMatch[1].matchAll(/\[\s*['"]([a-zA-Z0-9_-]+)['"]\s*,\s*['"][a-zA-Z0-9_-]+['"]\s*\]/g)) {
    const name = pairMatch[1];
    assert.ok(PC_TOOL_SCHEMAS[name], `Missing PC_TOOL_SCHEMAS entry for ${name}`);
    assert.ok(!tools.has(name), `Duplicate loop tool registration in mcp.js: ${name}`);
    tools.set(name, Object.keys(PC_TOOL_SCHEMAS[name].shape).sort());
  }

  return tools;
}

function captureBridgeRegistrations() {
  const registered = new Map();
  const mockServer = {
    registerTool(name, config, handler) {
      assert.ok(!registered.has(name), `Duplicate tool registration in trinity-codex-mcp.mjs: ${name}`);
      registered.set(name, {config, handler});
    }
  };
  registerBridgeTools(mockServer, name => async args => ({forwarded: name, args}));
  return registered;
}

test('MCP bridge registers exactly 48 tools with 1:1 name parity against Trinity/src/mcp.js', () => {
  const serverTools = parseMcpServerTools(mcpSource);
  const bridgeTools = captureBridgeRegistrations();
  const staticBridgeNames = [...bridgeSource.matchAll(/server\.registerTool\(\s*['"]([a-zA-Z0-9_-]+)['"]/g)].map(m => m[1]);

  assert.equal(serverTools.size, 48, `Expected 48 tools in Trinity/src/mcp.js, found ${serverTools.size}`);
  assert.equal(bridgeTools.size, 48, `Expected 48 runtime tools in Trinity/scripts/trinity-codex-mcp.mjs, found ${bridgeTools.size}`);
  assert.equal(staticBridgeNames.length, 48, `Expected 48 static server.registerTool calls in trinity-codex-mcp.mjs, found ${staticBridgeNames.length}`);

  const missingInBridge = [...serverTools.keys()].filter(name => !bridgeTools.has(name));
  const extraInBridge = [...bridgeTools.keys()].filter(name => !serverTools.has(name));

  assert.deepEqual(missingInBridge, [], `Tools missing from trinity-codex-mcp.mjs: ${missingInBridge.join(', ')}`);
  assert.deepEqual(extraInBridge, [], `Unexpected extra tools in trinity-codex-mcp.mjs: ${extraInBridge.join(', ')}`);

  // Verify the 6 previously missing tools are explicitly present
  for (const requiredTool of [
    'pc_find_files',
    'pc_search_text',
    'pc_run_script',
    'google_ai_studio_status',
    'google_ai_studio_models',
    'google_ai_studio_cocreate'
  ]) {
    assert.ok(bridgeTools.has(requiredTool), `Previously missing tool '${requiredTool}' must be registered`);
  }
});

test('Every single tool inputSchema parameter key set matches Trinity/src/mcp.js 1:1', () => {
  const serverTools = parseMcpServerTools(mcpSource);
  const bridgeTools = captureBridgeRegistrations();

  for (const [toolName, expectedKeys] of serverTools.entries()) {
    const entry = bridgeTools.get(toolName);
    assert.ok(entry, `Missing bridge registration for ${toolName}`);
    const bridgeSchema = entry.config.inputSchema || {};
    const actualKeys = Object.keys(bridgeSchema).sort();
    assert.deepEqual(
      actualKeys,
      expectedKeys,
      `Parameter key mismatch for tool '${toolName}': bridge=[${actualKeys.join(', ')}] vs mcp.js=[${expectedKeys.join(', ')}]`
    );
  }
});

test('Previously broken and newly added tool schemas validate real payloads and reject old mismatched keys', () => {
  const bridgeTools = captureBridgeRegistrations();
  const schemaOf = name => z.object(bridgeTools.get(name).config.inputSchema).strict();
  const validUuid = '11111111-2222-4333-8444-555555555555';
  const validSha256 = 'a'.repeat(64);
  const validCommit = 'b'.repeat(40);

  // dispatch_to_agent: { target, prompt, context_key? } (NOT { agent, task })
  assert.equal(schemaOf('dispatch_to_agent').safeParse({target: 'gemini', prompt: 'Analyze', context_key: 'ctx/1'}).success, true);
  assert.equal(schemaOf('dispatch_to_agent').safeParse({agent: 'gemini', task: 'Analyze'}).success, false);

  // copilot_chat: { query, session_id?, agent? } (NOT { message })
  assert.equal(schemaOf('copilot_chat').safeParse({query: 'Check status', session_id: validUuid, agent: 'coder'}).success, true);
  assert.equal(schemaOf('copilot_chat').safeParse({message: 'Check status'}).success, false);

  // azure_foundry_agent_invoke: { message, agent?, conversation_id? } (NOT { prompt })
  assert.equal(schemaOf('azure_foundry_agent_invoke').safeParse({message: 'Hello', agent: 'trinity', conversation_id: 'conv-1'}).success, true);
  assert.equal(schemaOf('azure_foundry_agent_invoke').safeParse({prompt: 'Hello'}).success, false);

  // trinity_memory_sync: { action, key?, payload?, source_agent? }
  const memParsed = schemaOf('trinity_memory_sync').parse({action: 'write', key: 'k1', payload: 'v1'});
  assert.equal(memParsed.source_agent, 'trinity');
  assert.equal(schemaOf('trinity_memory_sync').safeParse({}).success, false);

  // create_daily_plan: matches dailyPlanShape
  const planParsed = schemaOf('create_daily_plan').parse({
    date: '2026-11-26',
    tasks: [{title: 'Ship release', minutes: 60}],
    available_minutes: 240,
    idempotency_key: validUuid
  });
  assert.equal(planParsed.provider, 'workers-ai');
  assert.equal(planParsed.tasks[0].priority, 'normal');
  assert.equal(schemaOf('create_daily_plan').safeParse({}).success, false);

  // sync_shared_notes: matches sharedNotesInput
  const notesParsed = schemaOf('sync_shared_notes').parse({
    changes: [{id: validUuid, text: 'Note 1', base_revision: 0}],
    cursor: validUuid
  });
  assert.equal(notesParsed.changes[0].deleted, false);

  // sovereign_ledger: { action, entry?, query? }
  assert.equal(schemaOf('sovereign_ledger').safeParse({action: 'append', entry: {event: 'ok'}}).success, true);
  assert.equal(schemaOf('sovereign_ledger').safeParse({action: 'invalid'}).success, false);

  // pc_run_command: requires command + rationale (min 5) + optional cwd
  assert.equal(schemaOf('pc_run_command').safeParse({command: 'npm test', rationale: 'Verify build', cwd: 'Trinity'}).success, true);
  assert.equal(schemaOf('pc_run_command').safeParse({command: 'npm test'}).success, false);

  // pc_run_script: runtime, path, expected_sha256, args, timeout_ms, rationale
  const scriptParsed = schemaOf('pc_run_script').parse({
    runtime: 'node',
    path: 'Trinity/workspace/scripts/check.mjs',
    expected_sha256: validSha256,
    rationale: 'Execute verified diagnostic script'
  });
  assert.deepEqual(scriptParsed.args, []);
  assert.equal(scriptParsed.timeout_ms, 30000);
  assert.equal(schemaOf('pc_run_script').safeParse({runtime: 'bash', path: '/etc/passwd', expected_sha256: 'short', rationale: 'bad'}).success, false);

  // pc_find_files & pc_search_text
  assert.equal(schemaOf('pc_find_files').parse({}).path, 'Trinity');
  assert.equal(schemaOf('pc_search_text').parse({pattern: 'handleMcp'}).regex, false);
  assert.equal(schemaOf('pc_search_text').safeParse({}).success, false);

  // project_inspect, project_read, edit_source_file, list_tasks
  assert.equal(schemaOf('project_inspect').parse({}).query, '');
  assert.equal(schemaOf('project_read').safeParse({path: 'Trinity/src/mcp.js', ref: validCommit}).success, true);
  assert.equal(schemaOf('edit_source_file').safeParse({path: 'Trinity/src/a.js', content: 'x', rationale: 'Update value cleanly', expected_sha256: validSha256}).success, true);
  assert.equal(schemaOf('edit_source_file').safeParse({path: 'Trinity/src/a.js', content: 'x', rationale: 'Update value cleanly', expected_sha256: 'absent'}).success, true);
  assert.equal(schemaOf('list_tasks').safeParse({limit: 25}).success, true);

  // approve_system_action & reject_system_action
  assert.equal(schemaOf('approve_system_action').safeParse({id: validUuid, confirmation: validUuid}).success, true);
  assert.equal(schemaOf('reject_system_action').safeParse({id: validUuid}).success, true);
  assert.equal(schemaOf('approve_system_action').safeParse({id: 'not-a-uuid'}).success, false);

  // synthesize_* & search_ecosystem
  assert.equal(schemaOf('synthesize_skill').parse({name: 'audit-helper'}).domain, 'software-dev');
  assert.deepEqual(schemaOf('synthesize_plugin').parse({name: 'audit-pack'}).skills, []);
  assert.equal(schemaOf('synthesize_app').parse({name: 'status-ui'}).type, 'web-app');
  assert.equal(schemaOf('search_ecosystem').safeParse({query: 'audit', type: 'skill', domain: 'ops'}).success, true);

  // google_ai_studio_*
  assert.equal(schemaOf('google_ai_studio_models').safeParse({page_size: 50}).success, true);
  assert.equal(schemaOf('google_ai_studio_cocreate').safeParse({task: 'Review API', mode: 'review', reply_language: 'sk'}).success, true);
  assert.equal(schemaOf('google_ai_studio_cocreate').safeParse({task: 'Review API', mode: 'unknown'}).success, false);
});

test('registerBridgeTools registers all 48 tools cleanly on a real McpServer instance and parseRemoteResponse handles JSON/SSE', async () => {
  const {McpServer} = await import('@modelcontextprotocol/server');
  const {parseRemoteResponse} = await import('../scripts/trinity-codex-mcp.mjs');
  const server = new McpServer({name: 'trinity-parity-test', version: '11.1.0'});
  assert.doesNotThrow(() => {
    registerBridgeTools(server, name => async args => ({content: [{type: 'text', text: JSON.stringify({name, args})}]}));
  });
  assert.deepEqual(parseRemoteResponse(JSON.stringify({jsonrpc: '2.0', id: 1, result: {ok: true}})), {ok: true});
  assert.deepEqual(parseRemoteResponse('event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":48}}\n'), {tools: 48});
  assert.throws(() => parseRemoteResponse(JSON.stringify({jsonrpc: '2.0', id: 3, error: {message: 'Denied'}})), /Denied/);
});

test('verify-codex-mcp-access.mjs enforces 48 tools, public health/ready 200, and unauthenticated /mcp 401', async () => {
  const {EXPECTED_TOOL_COUNT, runPublicOnlyVerification, verifyOrigin} = await import('../../scripts/verify-codex-mcp-access.mjs');
  assert.equal(EXPECTED_TOOL_COUNT, 48);

  const mockTools = Array.from({length: 48}, (_, idx) => ({name: `tool_${idx + 1}`}));
  const passingFetcher = async (url, init = {}) => {
    const auth = init.headers?.Authorization || '';
    if (String(url).endsWith('/health')) {
      return Response.json({ok: true, service: 'Trinity', version: '11.1.0', environment: 'production', agents: 46, status: 'serving', deployment: {id: 'dep-1', tag: 'abc'}});
    }
    if (String(url).endsWith('/ready')) {
      return Response.json({ready: true, checks: {bindings: true, schema: true, cache: true}});
    }
    if (String(url).endsWith('/mcp')) {
      if (!auth) return Response.json({error: 'Sign in to Trinity.'}, {status: 401});
      const body = JSON.parse(init.body);
      if (body.method === 'initialize') return Response.json({jsonrpc: '2.0', id: body.id, result: {serverInfo: {name: 'trinity', version: '11.1.0'}, protocolVersion: '2025-03-26'}});
      if (body.method === 'tools/list') return Response.json({jsonrpc: '2.0', id: body.id, result: {tools: mockTools}});
      if (body.method === 'tools/call') return Response.json({jsonrpc: '2.0', id: body.id, result: {content: [{type: 'text', text: '{"healthy":true}'}]}});
    }
    return new Response('Not found', {status: 404});
  };

  const publicReceipt = await runPublicOnlyVerification(['https://auru.space', 'https://auru.dev'], {fetcher: passingFetcher});
  assert.equal(publicReceipt.ok, true);
  assert.equal(publicReceipt.mode, 'public-only');
  assert.equal(publicReceipt.expected_tool_count, 48);
  assert.equal(publicReceipt.origins.length, 2);
  assert.equal(publicReceipt.origins[0].unauthenticatedMcpBlocked.status, 401);

  const authResult = await verifyOrigin('https://auru.space', {TRINITY_MCP_TOKEN: 'test-token'}, {fetcher: passingFetcher});
  assert.equal(authResult.success, true);
  assert.equal(authResult.toolsCount, 48);
  assert.equal(authResult.diagnosticPingPassed, true);

  // Fails closed if unauthenticated /mcp returns 200 instead of 401
  const leakyMcpFetcher = async (url, init = {}) => {
    if (String(url).endsWith('/mcp')) return Response.json({jsonrpc: '2.0', id: 1, result: {}});
    return passingFetcher(url, init);
  };
  const leakyReceipt = await runPublicOnlyVerification(['https://auru.space'], {fetcher: leakyMcpFetcher});
  assert.equal(leakyReceipt.ok, false);
  assert.equal(leakyReceipt.origins[0].unauthenticatedMcpBlocked.ok, false);
});
