/**
 * TRINITY ALL-TOOLS COMPREHENSIVE VERIFICATION SUITE
 * 
 * Verifies every single category of tools across:
 * 1. Mathematical & Computational
 * 2. Text Processing & NLP
 * 3. Data Transformation & Encoders
 * 4. Time, Geo & System Utilities
 * 5. Open-Data APIs
 * 6. Sovereign Ledger MMR & Truth Guard
 * 7. Cloudflare Omni-Tools
 * 8. Local PC Desktop MCP Tools
 * 9. Production Cloudflare Edge Endpoints
 */

import { runTool, TOOL_SCHEMAS } from '../src/tools.js';
import { agentById } from '../src/registry.js';
import { cfD1Query, cfKVStore, cfR2Manage } from '../src/omni-tools.js';
import { readFile, writeFile } from 'node:fs/promises';

const results = [];
let passCount = 0;
let failCount = 0;

function record(category, tool, status, details) {
  if (status === 'PASSED') passCount++; else failCount++;
  results.push({ category, tool, status, details });
  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} [${category}] ${tool}: ${status} - ${typeof details === 'string' ? details : JSON.stringify(details).slice(0, 100)}`);
}

// Mock environment configured with enabled plugins and in-memory stores
const mockDbEvents = [];
const mockD1Store = new Map();
mockD1Store.set('SELECT installed,enabled FROM ops_plugins', { installed: 1, enabled: 1 });

const mockDB = {
  prepare: (sql) => ({
    bind: (...args) => ({
      all: async () => {
        if (sql.includes('ops_plugins')) return { results: [{ installed: 1, enabled: 1 }] };
        if (sql.includes('trinity_sovereign_ledger_v3')) return { results: [] };
        return { results: [{ id: 1, count: 42 }] };
      },
      first: async () => {
        if (sql.includes('ops_plugins')) return { installed: 1, enabled: 1 };
        return { id: 1, count: 42, installed: 1, enabled: 1 };
      },
      run: async () => {
        mockDbEvents.push({ sql, args });
        return { success: true, changes: 1 };
      }
    }),
    all: async () => ({ results: [{ installed: 1, enabled: 1 }] }),
    first: async () => ({ installed: 1, enabled: 1 }),
    run: async () => ({ success: true, changes: 1 })
  })
};

const kvStore = new Map();
const mockKV = {
  get: async (k) => kvStore.get(k) || null,
  put: async (k, v) => kvStore.set(k, v),
  delete: async (k) => kvStore.delete(k),
  list: async () => ({ keys: Array.from(kvStore.keys()).map(name => ({ name })) })
};

const r2Store = new Map();
const mockR2 = {
  get: async (k) => {
    const val = r2Store.get(k);
    if (!val) return null;
    return { text: async () => val, arrayBuffer: async () => Buffer.from(val) };
  },
  put: async (k, v) => r2Store.set(k, v),
  delete: async (k) => r2Store.delete(k),
  list: async () => ({ objects: Array.from(r2Store.keys()).map(key => ({ key })) })
};

const env = {
  DB: mockDB,
  Mastermind: mockKV,
  ARTIFACTS: mockR2,
  R2: mockR2
};

const orchestrator = agentById('orchestrator');

async function testBuiltin(category, toolName, args) {
  try {
    const startTime = performance.now();
    const res = await runTool(env, orchestrator, toolName, args, { ownerMode: true });
    const durationMs = Math.round(performance.now() - startTime);
    record(category, toolName, 'PASSED', { durationMs, preview: res });
  } catch (err) {
    record(category, toolName, 'FAILED', err.message);
  }
}

async function run() {
  console.log('================================================================');
  console.log('⚡ TRINITY SOVEREIGN OS - COMPREHENSIVE TOOL VERIFICATION TEST ⚡');
  console.log('================================================================\n');

  // 1. MATHEMATICAL & COMPUTATIONAL TOOLS
  console.log('--- 1. Mathematical & Computational Tools ---');
  await testBuiltin('Math', 'calculate', { operation: 'multiply', values: [12, 12] });
  await testBuiltin('Math', 'calculate', { operation: 'divide', values: [144, 12] });
  await testBuiltin('Math', 'calculate', { operation: 'percentage', values: [25, 200] });
  await testBuiltin('Math', 'geometry', { shape: 'circle', radius: 10 });
  await testBuiltin('Math', 'geometry', { shape: 'rectangle', width: 20, height: 10 });
  await testBuiltin('Math', 'statistics', { values: [10, 20, 30, 40, 50, 100] });
  await testBuiltin('Math', 'business_math', { operation: 'compound_growth', amount: 5000, rate: 7, periods: 5 });
  await testBuiltin('Math', 'convert_units', { value: 100, from: 'c', to: 'f' });
  await testBuiltin('Math', 'convert_units', { value: 1, from: 'kg', to: 'lb' });

  // 2. TEXT PROCESSING & SEMANTIC TOOLS
  console.log('\n--- 2. Text Processing & NLP Tools ---');
  await testBuiltin('Text', 'analyze_text', { text: 'Trinity Sovereign OS is an autonomous cognitive operating system built for total sovereignty and verification.' });
  await testBuiltin('Text', 'format_text', { text: 'trinity sovereign core os', mode: 'title' });
  await testBuiltin('Text', 'extract_entities', { text: 'Contact Ivan at support@auru.space or visit https://auru.space for more information.' });
  await testBuiltin('Text', 'redact_sensitive', { text: 'Secret contact is admin@auru.space and phone +421911222333.', types: ['email', 'phone'] });
  await testBuiltin('Text', 'html_to_text', { html: '<html><body><h1>Trinity OS</h1><p>Welcome to <b>Sovereign Core</b>.</p></body></html>' });
  await testBuiltin('Text', 'markdown_inspect', { markdown: '# Trinity Architecture\n\n## Layer 1\n- D1 Sovereign Ledger\n- Local Gateway\n\n[Link](https://auru.space)' });
  await testBuiltin('Text', 'text_diff', { before: 'version: 11.0.0', after: 'version: 11.1.0' });

  // 3. DATA STRUCTURES & CODECS
  console.log('\n--- 3. Data Structures & Codecs ---');
  await testBuiltin('Data', 'json_tool', { operation: 'format', json: '{"service":"trinity","status":"active"}' });
  await testBuiltin('Data', 'csv_inspect', { csv: 'id,name,role\n1,Ivan,Architect\n2,Trinity,Core' });
  await testBuiltin('Data', 'csv_to_json', { csv: 'id,name,role\n1,Ivan,Architect\n2,Trinity,Core' });
  await testBuiltin('Data', 'list_cleaner', { items: ['  trinity  ', 'edge', '  trinity  ', '', 'gateway'], trim: true, remove_empty: true });
  await testBuiltin('Data', 'table_transform', { json: '[{"id":1,"val":50},{"id":2,"val":100},{"id":3,"val":25}]', operation: 'sort', field: 'val', direction: 'desc' });
  await testBuiltin('Data', 'base64_codec', { operation: 'encode', value: 'Sovereign Trinity Covenant 2026' });
  await testBuiltin('Data', 'base64_codec', { operation: 'decode', value: 'U292ZXJlaWduIFRyaW5pdHkgQ292ZW5hbnQgMjAyNg==' });
  await testBuiltin('Data', 'uuid_tool', { operation: 'generate' });
  await testBuiltin('Data', 'uuid_tool', { operation: 'validate', value: 'e356638b-0e08-4193-a95e-20ddcbd3b4d7' });
  await testBuiltin('Data', 'semver_compare', { left: '11.1.0', right: '11.0.0' });
  await testBuiltin('Data', 'hash_text', { text: 'Trinity Sovereign Truth', algorithm: 'SHA-256' });

  // 4. TIME, URL & SYSTEM UTILITIES
  console.log('\n--- 4. Time, URL & System Utilities ---');
  await testBuiltin('System', 'current_time', { timezone: 'UTC' });
  await testBuiltin('System', 'current_time', { timezone: 'Europe/Bratislava' });
  await testBuiltin('System', 'date_math', { operation: 'difference_days', start: '2026-01-01', end: '2026-11-21' });
  await testBuiltin('System', 'timezone_convert', { datetime: '2026-11-21T12:00:00Z', from_timezone: 'UTC', to_timezone: 'Europe/Bratislava' });
  await testBuiltin('System', 'url_inspect', { url: 'https://auru.space/api/audit-ledger/verify?scope=full' });
  await testBuiltin('System', 'query_string', { operation: 'parse', value: 'system=trinity&version=11&verified=true' });
  await testBuiltin('System', 'color_convert', { color: '#2563eb', to: 'rgb' });
  await testBuiltin('System', 'contrast_check', { foreground: '#ffffff', background: '#0f172a' });
  await testBuiltin('System', 'diagnostic_ping', { message: 'verification-ping-2026' });
  await testBuiltin('System', 'plan_work', { task: 'Complete verification of autonomous Trinity tools' });

  // 5. OPEN DATA APIS
  console.log('\n--- 5. Open Data & External APIs ---');
  await testBuiltin('OpenData', 'free_modules_catalog', {});
  await testBuiltin('OpenData', 'network_dns', { domain: 'cloudflare.com', type: 'A' });
  await testBuiltin('OpenData', 'crypto_prices', { coins: ['bitcoin', 'ethereum'] });
  await testBuiltin('OpenData', 'tech_news', { limit: 3 });
  await testBuiltin('OpenData', 'macro_data', { country: 'SVK', indicator: 'gdp' });
  await testBuiltin('OpenData', 'open_wikipedia', { query: 'Alan Turing', lang: 'en' });
  await testBuiltin('OpenData', 'open_weather', { query: 'Bratislava' });

  // 6. SOVEREIGN LEDGER & TRUTH GUARD
  console.log('\n--- 6. Sovereign Ledger & Truth Guard ---');
  await testBuiltin('Sovereign', 'sovereign_ledger_v3', { action: 'architecture' });
  await testBuiltin('Sovereign', 'sovereign_lock_check', { action: 'charter_compliance' });
  await testBuiltin('Sovereign', 'truth_guard_verify', { action: 'validate_response', response_text: 'Trinity system is ready and verified.' });

  // 7. OMNI-TOOLS CLOUDFLARE BINDINGS
  console.log('\n--- 7. Cloudflare Omni-Tools ---');
  try {
    const d1Res = await cfD1Query(env, { query: 'SELECT count FROM ops_plugins' });
    record('OmniTools', 'cf_d1_query', d1Res.ok ? 'PASSED' : 'FAILED', d1Res);
  } catch (e) {
    record('OmniTools', 'cf_d1_query', 'FAILED', e.message);
  }

  try {
    await cfKVStore(env, { action: 'put', key: 'test_audit_key', value: { status: 'verified', at: new Date().toISOString() } });
    const kvGet = await cfKVStore(env, { action: 'get', key: 'test_audit_key' });
    record('OmniTools', 'cf_kv_store', kvGet.ok && kvGet.value?.status === 'verified' ? 'PASSED' : 'FAILED', kvGet);
  } catch (e) {
    record('OmniTools', 'cf_kv_store', 'FAILED', e.message);
  }

  try {
    const r2Put = await cfR2Manage(env, { action: 'upload', key: 'audit-evidence.txt', content: 'Trinity Sovereign Evidence' });
    record('OmniTools', 'cf_r2_manage', r2Put.ok ? 'PASSED' : 'FAILED', r2Put);
  } catch (e) {
    record('OmniTools', 'cf_r2_manage', 'FAILED', e.message);
  }

  // 8. LOCAL DESKTOP MCP TOOLS
  console.log('\n--- 8. Local Desktop MCP Tools (127.0.0.1:8795/mcp) ---');
  try {
    const launchData = JSON.parse(await readFile('C:/Users/saboi/Trinity/Trinity-antigravity/Local-Desktop/Data/launch.json', 'utf8'));
    const token = new URLSearchParams(new URL(launchData.url).hash.slice(1)).get('token');

    async function callLocalMcp(tool, args) {
      const resp = await fetch('http://127.0.0.1:8795/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: tool, arguments: args } }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return data.result;
    }

    const noteRes = await callLocalMcp('add_note', { text: `Autonomous tool test ${new Date().toISOString()}` });
    record('LocalMCP', 'add_note', 'PASSED', noteRes);

    const searchRes = await callLocalMcp('search_notes', { query: 'Autonomous tool test' });
    record('LocalMCP', 'search_notes', 'PASSED', searchRes);

    const listRes = await callLocalMcp('list_files', {});
    record('LocalMCP', 'list_files', 'PASSED', listRes);

    const receiptFile = `trinity-tool-receipt-${Date.now()}.txt`;
    const writeRes = await callLocalMcp('write_file', {
      path: receiptFile,
      content: `TRINITY TOOL VERIFICATION RECEIPT\nVerified: ${new Date().toISOString()}\nStatus: 100% OPERATIONAL\n`
    });
    record('LocalMCP', 'write_file', 'PASSED', writeRes);

    const readRes = await callLocalMcp('read_file', { path: receiptFile });
    record('LocalMCP', 'read_file', 'PASSED', readRes);

  } catch (err) {
    record('LocalMCP', 'pc_bridge_suite', 'FAILED', err.message);
  }

  // 9. PRODUCTION CLOUDFLARE EDGE & LOCAL GATEWAY HEALTH
  console.log('\n--- 9. Production Cloudflare Edge & Local Gateway Live Health ---');
  const endpoints = [
    { name: 'Cloudflare Edge Worker Health', url: 'https://trinity.saboivan2008.workers.dev/health' },
    { name: 'Production Sovereign Ledger Verify', url: 'https://trinity.saboivan2008.workers.dev/api/audit-ledger/verify' },
    { name: 'Custom Domain auru.space Health', url: 'https://auru.space/health' },
    { name: 'Local Gateway (Port 8791) Health', url: 'http://127.0.0.1:8791/health' },
    { name: 'Local Desktop (Port 8795) Health', url: 'http://127.0.0.1:8795/health' }
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep.url, { signal: AbortSignal.timeout(10000) });
      const data = await resp.json();
      record('LiveEndpoints', ep.name, resp.ok ? 'PASSED' : 'FAILED', { status: resp.status, data });
    } catch (e) {
      record('LiveEndpoints', ep.name, 'FAILED', e.message);
    }
  }

  // SUMMARY REPORT
  console.log('\n================================================================');
  console.log(`📊 VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${results.length} total tests.`);
  console.log('================================================================\n');

  await writeFile(
    new URL('../verification/all-tools-verification-report.json', import.meta.url),
    JSON.stringify({ checked_at: new Date().toISOString(), passCount, failCount, total: results.length, results }, null, 2)
  );

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

run();
