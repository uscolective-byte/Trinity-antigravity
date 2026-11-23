/**
 * Opaque-Box 4-Tier E2E Release Verification Suite for Trinity Unified Release:
 *   - Area A: Tetrakis ($TTK) Native Space, 4-Pillar Utility, Zero-TON & /tetrakis-logo.png
 *   - Area B: Google AI Studio Bridge (Backend, Vault, Tools, MCP, HTTP, UI)
 *   - Area C: Dual-Language Architecture (100% English Internals / Slovak User Communication)
 *   - Area D: Holistic In-App & Repository Documentation Coherence & CI Guardrails
 *
 * Strictly derived from ORIGINAL_REQUEST.md, PROJECT.md § Interface Contracts, and TEST_INFRA.md.
 * Zero silent skips, zero working-tree mutations, zero real secrets, CWD-independent paths.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// ---------------------------------------------------------------------------
// CWD-Independent Paths & Synthetic Constants
// ---------------------------------------------------------------------------
const TRINITY_DIR = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST_DIR = resolve(TRINITY_DIR, 'dist');
const MIGRATIONS_DIR = resolve(TRINITY_DIR, 'migrations');
const ASSISTANT_DIR = resolve(TRINITY_DIR, 'public/assistant');
const SRC_DIR = resolve(TRINITY_DIR, 'src');

const WORKER_ORIGIN = 'https://trinity.test';
const OWNER_KEY = 'e2e-only-not-a-real-owner-key-1234567890abcdef';
const OWNER_EMAIL = 'e2e-owner@example.test';
const ORDINARY_EMAIL = 'e2e-ordinary-user@example.test';
const ORDINARY_SESSION_TOKEN = 'e'.repeat(64);
const VAULT_MASTER_KEY = Buffer.alloc(32, 9).toString('base64url');
const SYNTHETIC_AI_STUDIO_KEY = 'AIzaSySyntheticTestKey0000000000000000001';
const SYNTHETIC_ALT_KEY = 'AIzaSySyntheticAltKey0000000000000000002';
const SYNTHETIC_VAULT_KEY = 'AIzaSySyntheticVaultKey000000000000000003';
const SYNTHETIC_AQ_SECRET = 'AQ.SyntheticTokenValue000000000000000004';
const TTK_CONTRACT_ADDR = '0x4d308452a96d7dabfd2f33d92677a3a2724f387e';
const TTK_RECIPIENT_ADDR = '0x7e17f9072cfcbc7fe45973de0f11ec8db99281e4';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const SLOVAK_DIACRITICS_RE = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽěůřĚŮŘ]/;

// Semantic matchers for the 4 native Tetrakis ($TTK) ecosystem utility pillars
// (tolerant of both Slovak user-facing copy and English backend/doc phrasing)
const TETRAKIS_PILLAR_MATCHERS = [
  {
    name: 'Pillar 1 — Native In-Chat Payments & Instant P2P Transfers',
    pattern: /in[- ]?chat|p2p|v\s+chate|chatov|@wallet|peňaženk|tipping|prepitn|prevod|transfer|payment\s*request|platb/i
  },
  {
    name: 'Pillar 2 — Mini-Apps, AI Studio & Bot Economy',
    pattern: /mini[- ]?app|ai\s*studio|bot\s*(economy|ekonomik)|plugin|skill|micro[- ]?service|mikroslu|agent/i
  },
  {
    name: 'Pillar 3 — Domains, Handles & Digital Assets',
    pattern: /domain|domén|handle|používateľsk|username|digital\s*asset|digitáln.*aktív|collectible|zberateľ|hosting/i
  },
  {
    name: 'Pillar 4 — Creator & Compute Economy / Non-Custodial Space',
    pattern: /non[- ]?custodial|nekustodiál|creator|tvorc|compute|výpočtov|storage|úložisk|edge|vlastné\s+kľúče|private\s+key/i
  }
];

const ZERO_TON_FORBIDDEN_PATTERNS = [
  { label: '.ton- class', re: /\.ton-/ },
  { label: '--ton- CSS var', re: /--ton-/ },
  { label: 'data-ton-action attr', re: /data-ton-action/ },
  { label: 'ton-send-card id', re: /ton-send-card/ },
  { label: 'ton-contract-card id', re: /ton-contract-card/ },
  { label: 'TON-style phrase', re: /TON-style/i },
  { label: 'TON Space phrase', re: /\bTON\s+Space\b/i },
  { label: 'Tonkeeper brand', re: /\bTonkeeper\b/i },
  { label: 'THE TETRAKIS OPEN NETWORK', re: /THE\s+TETRAKIS\s+OPEN\s+NETWORK/i },
  { label: 'TON inverted-triangle SVG path', re: /M12\s+21L3\.8\s+7\.6/ }
];

const PRESERVED_DOCUMENT_SEED_IDS = [
  'trinity-gdpr-privacy-consent',
  'trinity-kompletna-dokumentacia',
  'trinity-omni-dev-studio-sprievodca',
  'trinity-meta-ai-social-manual',
  'trinity-desatoro-pravdivosti',
  'trinity-aktualny-stav-systemu',
  'trinity-architektura-20261103',
  'trinity-protokol-369-kvantovy-router',
  'trinity-team-handoff-ledger',
  'trinity-jednotna-receipt-architektura'
];

// ---------------------------------------------------------------------------
// Dynamic Module Loader & Assertion Helpers (Zero Silent Skips)
// ---------------------------------------------------------------------------
async function loadModule(relPath) {
  const url = new URL(relPath, import.meta.url).href;
  try {
    return await import(url);
  } catch (err) {
    assert.fail(`Required contract module "${relPath}" could not be imported (${err.code || err.name}): ${err.message}`);
  }
}

function requireExport(mod, exportName, relPath) {
  if (!(exportName in mod) || mod[exportName] === undefined) {
    assert.fail(`Required contract export "${exportName}" is missing from ${relPath}`);
  }
  return mod[exportName];
}

function readRepoFile(relFromRoot) {
  const fullPath = resolve(REPO_ROOT, relFromRoot);
  assert.ok(existsSync(fullPath), `Expected repository file to exist: ${relFromRoot}`);
  return readFileSync(fullPath, 'utf8');
}

function assertAllFourTetrakisPillars(text, contextLabel) {
  for (const pillar of TETRAKIS_PILLAR_MATCHERS) {
    assert.match(
      text,
      pillar.pattern,
      `${contextLabel} must cover ${pillar.name}`
    );
  }
}

function assertZeroTonLeaks(text, contextLabel, patterns = ZERO_TON_FORBIDDEN_PATTERNS) {
  const hits = [];
  for (const { label, re } of patterns) {
    const match = text.match(re);
    if (match) {
      hits.push(`${label} ("${match[0]}")`);
    }
  }
  assert.equal(
    hits.length,
    0,
    `${contextLabel} contains forbidden TON branding/class leaks: ${hits.join(', ')}`
  );
}

/**
 * Balanced HTML element extractor by id attribute.
 * Returns the full outer HTML of the matched container element.
 */
function extractHtmlElementById(html, id) {
  const idToken = `id="${id}"`;
  const idIdx = html.indexOf(idToken);
  if (idIdx < 0) return null;
  const openStart = html.lastIndexOf('<', idIdx);
  if (openStart < 0) return null;
  const tagMatch = html.slice(openStart).match(/^<([a-zA-Z0-9-]+)/);
  if (!tagMatch) return null;
  const tagName = tagMatch[1].toLowerCase();
  const openTagEnd = html.indexOf('>', idIdx);
  if (openTagEnd < 0) return null;
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  if (voidTags.has(tagName) || html[openTagEnd - 1] === '/') {
    return html.slice(openStart, openTagEnd + 1);
  }
  const tagRe = new RegExp(`<(\\/?)${tagName}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = openTagEnd + 1;
  let depth = 1;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const isClosing = match[1] === '/';
    const isSelfClosing = match[0].endsWith('/>');
    if (isClosing) depth--;
    else if (!isSelfClosing) depth++;
    if (depth === 0) {
      return html.slice(openStart, match.index + match[0].length);
    }
  }
  return html.slice(openStart);
}

/**
 * Accurate JS lexical comment extractor.
 * Properly skips single-quoted strings, double-quoted strings, template literals
 * (including nested ${...} expressions where real comments ARE scanned), and
 * regex literals so valid Slovak user-facing strings or markdown bullets inside
 * template literals NEVER trigger false positives.
 */
function extractJsComments(source) {
  const comments = [];
  const len = source.length;
  let i = 0;
  let line = 1;
  let lastToken = '';
  const templateBraceStack = [];

  const REGEX_PRECEDING_TOKENS = new Set([
    '', '(', '[', '{', ',', ';', ':', '!', '?', '=', '&', '|', '^', '~', '+', '-', '*', '%', '<', '>',
    'return', 'case', 'throw', 'in', 'of', 'typeof', 'void', 'delete', 'await', 'yield', 'new', 'else', 'do'
  ]);

  const updateLine = (ch) => {
    if (ch === '\n') line++;
  };

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      updateLine(ch);
      i++;
      continue;
    }

    // Single-line comment // ...
    if (ch === '/' && next === '/') {
      const startLine = line;
      let buf = '';
      i += 2;
      while (i < len && source[i] !== '\n') {
        buf += source[i++];
      }
      comments.push({ line: startLine, type: 'line', text: buf });
      continue;
    }

    // Block / JSDoc comment /* ... */
    if (ch === '/' && next === '*') {
      const startLine = line;
      let buf = '';
      i += 2;
      while (i < len && !(source[i] === '*' && source[i + 1] === '/')) {
        updateLine(source[i]);
        buf += source[i++];
      }
      if (i < len) i += 2;
      comments.push({ line: startLine, type: 'block', text: buf });
      continue;
    }

    // Single or double quoted string
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\') {
          if (i + 1 < len) updateLine(source[i + 1]);
          i += 2;
          continue;
        }
        updateLine(source[i]);
        i++;
      }
      if (i < len) i++;
      lastToken = 'STR';
      continue;
    }

    // Template literal `...` (resuming if popping back from ${...})
    if (ch === '`') {
      i++;
      while (i < len) {
        if (source[i] === '\\') {
          if (i + 1 < len) updateLine(source[i + 1]);
          i += 2;
          continue;
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          templateBraceStack.push(0);
          i += 2;
          lastToken = '{';
          break;
        }
        if (source[i] === '`') {
          i++;
          lastToken = 'STR';
          break;
        }
        updateLine(source[i]);
        i++;
      }
      continue;
    }

    // Track braces inside template literal expressions
    if (ch === '{' && templateBraceStack.length > 0) {
      templateBraceStack[templateBraceStack.length - 1]++;
      lastToken = '{';
      i++;
      continue;
    }
    if (ch === '}' && templateBraceStack.length > 0) {
      if (templateBraceStack[templateBraceStack.length - 1] === 0) {
        templateBraceStack.pop();
        i++;
        // Resume template literal scanning immediately
        while (i < len) {
          if (source[i] === '\\') {
            if (i + 1 < len) updateLine(source[i + 1]);
            i += 2;
            continue;
          }
          if (source[i] === '$' && source[i + 1] === '{') {
            templateBraceStack.push(0);
            i += 2;
            lastToken = '{';
            break;
          }
          if (source[i] === '`') {
            i++;
            lastToken = 'STR';
            break;
          }
          updateLine(source[i]);
          i++;
        }
        continue;
      } else {
        templateBraceStack[templateBraceStack.length - 1]--;
        lastToken = '}';
        i++;
        continue;
      }
    }

    // Regex literal heuristic
    if (ch === '/' && REGEX_PRECEDING_TOKENS.has(lastToken)) {
      i++;
      let inClass = false;
      while (i < len) {
        const rc = source[i];
        if (rc === '\\') {
          if (i + 1 < len) updateLine(source[i + 1]);
          i += 2;
          continue;
        }
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) {
          i++;
          while (i < len && /[a-z]/i.test(source[i])) i++;
          break;
        } else if (rc === '\n') {
          updateLine(rc);
          i++;
          break;
        }
        i++;
      }
      lastToken = 'REGEX';
      continue;
    }

    // Identifiers / keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_$]/.test(source[i])) {
        ident += source[i++];
      }
      lastToken = ident;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      while (i < len && /[0-9a-fA-FxXoObBn._]/.test(source[i])) i++;
      lastToken = 'NUM';
      continue;
    }

    lastToken = ch;
    i++;
  }

  return comments;
}

function walkJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkJsFiles(full));
    } else if (entry.endsWith('.js')) {
      results.push(full);
    }
  }
  return results.sort();
}

/**
 * Strips fenced code blocks (```...```) and {% raw %}...{% endraw %} blocks from markdown
 * to detect unescaped Jekyll Liquid tags (`{{` or `{%`).
 */
function findUnescapedLiquidTags(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let inRaw = false;
  const violations = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/\{%\s*raw\s*%\}/.test(line)) {
      inRaw = true;
      continue;
    }
    if (/\{%\s*endraw\s*%\}/.test(line)) {
      inRaw = false;
      continue;
    }
    if (inRaw) continue;
    // Strip inline backtick spans before checking for unescaped Liquid
    const withoutInlineCode = line.replace(/`[^`]*`/g, '');
    if (/\{\{|\{%/.test(withoutInlineCode)) {
      violations.push({ line: idx + 1, content: line.trim().slice(0, 120) });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Real SQLite D1 Migration Helper & Standalone Storage Harness (No dist/ needed)
// ---------------------------------------------------------------------------
async function applyAllMigrations(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,module TEXT NOT NULL,action TEXT NOT NULL,details TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS memory(id TEXT PRIMARY KEY,content TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS knowledge(id INTEGER PRIMARY KEY,topic TEXT,content TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS personality(id INTEGER PRIMARY KEY,trait TEXT,value TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,title TEXT,content TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS memory_long(key TEXT,value TEXT,category TEXT,importance INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS projects(id TEXT,name TEXT,description TEXT,status TEXT,updated_at TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tasks(id TEXT,title TEXT,status TEXT,assigned_agent TEXT,updated_at TEXT)')
  ]);
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
    if (file === '0048_trinity_sovereign_ai_os.sql') {
      for (let i = 0; i < statements.length; i++) {
        await db.prepare(statements[i]).run();
      }
    } else if (statements.length > 0) {
      await db.batch(statements.map(s => db.prepare(s)));
    }
  }
}

async function createStorageHarness(tag = 'storage') {
  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [
      {
        name: 'storage',
        modules: true,
        compatibilityDate: '2026-10-01',
        d1Databases: { DB: `e2e-${tag}-db` },
        kvNamespaces: { Mastermind: `e2e-${tag}-kv` },
        script: 'export default { fetch() { return new Response("ok"); } };'
      }
    ]
  }));
  const db = await mf.getD1Database('DB', 'storage');
  const kv = await mf.getKVNamespace('Mastermind', 'storage');
  await applyAllMigrations(db);
  return { mf, db, kv };
}

// ---------------------------------------------------------------------------
// Real Built Worker Harness (Miniflare + Real D1/KV/R2 + Mock Outbound)
// ---------------------------------------------------------------------------
const MOCK_AI_SCRIPT = `
import { WorkerEntrypoint } from 'cloudflare:workers';
export class MockAI extends WorkerEntrypoint {
  async run(model, args) {
    if (String(model).includes('flux')) return { image: btoa('mock-jpeg') };
    if (String(model).includes('whisper')) return { text: 'mock transcript' };
    if (String(model).includes('melotts')) return new Uint8Array([73, 68, 51]);
    return { response: 'Trinity edge synthesis response (Slovak user communication active).' };
  }
}
export default { fetch() { return new Response('mock-ai'); } };
`;

const MOCK_OUTBOUND_SCRIPT = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headersObj = {};
    for (const [k, v] of request.headers.entries()) {
      headersObj[k.toLowerCase()] = v;
    }
    let bodyText = '';
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try { bodyText = await request.text(); } catch {}
    }

    // Record request log in MOCK_CTRL KV for transparent assertions
    const existing = (await env.MOCK_CTRL.get('requests', 'json')) || [];
    existing.push({
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      search: url.search,
      headers: headersObj,
      body: bodyText.slice(0, 4000)
    });
    await env.MOCK_CTRL.put('requests', JSON.stringify(existing.slice(-60)));

    const mode = (await env.MOCK_CTRL.get('mode')) || 'ok';

    // Google AI Studio (generativelanguage.googleapis.com)
    if (url.hostname === 'generativelanguage.googleapis.com') {
      const apiKey = headersObj['x-goog-api-key'] || '';
      if (mode === '401' || !apiKey) {
        return Response.json(
          { error: { code: 401, message: 'API key not valid: ' + apiKey, status: 'UNAUTHENTICATED' } },
          { status: 401 }
        );
      }
      if (mode === '429') {
        return Response.json(
          { error: { code: 429, message: 'Quota exceeded for key ' + apiKey, status: 'RESOURCE_EXHAUSTED' } },
          { status: 429 }
        );
      }
      if (url.pathname.endsWith('/models') && request.method === 'GET') {
        return Response.json({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
            },
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
            },
            {
              name: 'models/gemini-2.0-flash',
              displayName: 'Gemini 2.0 Flash',
              supportedGenerationMethods: ['generateContent']
            }
          ]
        });
      }

      // 404 cascade test for gemini-3.8-flash or explicit unknown models
      if (url.pathname.includes('gemini-3.8-flash') || url.pathname.includes('non-existent-model')) {
        return Response.json(
          { error: { code: 404, message: 'models/gemini-3.8-flash is not found for API version v1beta', status: 'NOT_FOUND' } },
          { status: 404 }
        );
      }

      if (url.pathname.includes(':streamGenerateContent')) {
        const sse = [
          'data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'AI Studio SSE chunk 1. ' }] } }] }),
          '',
          'data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'AI Studio SSE chunk 2.' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 18, candidatesTokenCount: 12, totalTokenCount: 30 } }),
          ''
        ].join('\\n');
        return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
      }

      if (url.pathname.includes(':generateContent')) {
        return Response.json({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    text: 'Google AI Studio collaborative proposal: modular architecture artifact ready for Trinity synthesis.'
                  }
                ]
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: {
            promptTokenCount: 44,
            candidatesTokenCount: 22,
            totalTokenCount: 66
          }
        });
      }
    }

    // Base L2 JSON-RPC mock
    if (request.method === 'POST' && bodyText.includes('"jsonrpc"')) {
      const rpc = JSON.parse(bodyText);
      const rpcMode = (await env.MOCK_CTRL.get('rpc_mode')) || 'verified';
      const expectedBytecode = (await env.MOCK_CTRL.get('ttk_bytecode')) || '0x6000';
      if (rpc.method === 'eth_chainId') {
        return Response.json({ jsonrpc: '2.0', id: rpc.id, result: rpcMode === 'wrong_chain' ? '0x1' : '0x2105' });
      }
      if (rpc.method === 'eth_getCode') {
        return Response.json({ jsonrpc: '2.0', id: rpc.id, result: rpcMode === 'verified' ? expectedBytecode : '0x6000' });
      }
    }

    return Response.json({ error: 'Unexpected outbound URL in E2E mock: ' + request.url }, { status: 502 });
  }
};
`;

async function createWorkerHarness({ tag = 'primary', extraBindings = {} } = {}) {
  const distIndex = resolve(DIST_DIR, 'index.js');
  assert.ok(
    existsSync(distIndex),
    `Trinity/dist/index.js must be built via "npm --prefix Trinity run build" before running HTTP E2E tests (missing ${distIndex})`
  );

  const modules = readdirSync(DIST_DIR)
    .filter(name => !name.endsWith('.map') && !name.endsWith('.md'))
    .map(name => ({
      type: name === 'index.js'
        ? 'ESModule'
        : (name.endsWith('.png') || name.endsWith('.webp'))
          ? 'Data'
          : 'Text',
      path: resolve(DIST_DIR, name)
    }));
  modules.sort((a, b) => (a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0));

  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [
      {
        name: 'trinity',
        modules,
        compatibilityDate: '2026-10-01',
        compatibilityFlags: ['nodejs_compat'],
        outboundService: 'mock-outbound',
        bindings: {
          CF_VERSION_METADATA: { id: `e2e-${tag}`, tag: 'e2e-commit', timestamp: '2026-11-22T00:00:00.000Z' },
          TRINITY_OPS_KEY: OWNER_KEY,
          TRINITY_OWNER_EMAIL: OWNER_EMAIL,
          TRINITY_VAULT_KEY: VAULT_MASTER_KEY,
          TRINITY_ENV: 'production',
          GEMINI_MODEL: 'gemini-3.8-flash',
          ...extraBindings
        },
        kvNamespaces: { Mastermind: `e2e-${tag}-kv`, PC_STATE: `e2e-${tag}-pc` },
        d1Databases: { DB: `e2e-${tag}-db` },
        r2Buckets: { ARTIFACTS: `e2e-${tag}-r2` },
        serviceBindings: { AI: { name: 'mock-ai', entrypoint: 'MockAI' } },
        workflows: { OPS_WORKFLOW: { name: `e2e-${tag}-workflow`, className: 'TrinityOperations' } }
      },
      {
        name: 'mock-ai',
        modules: true,
        compatibilityDate: '2026-10-01',
        script: MOCK_AI_SCRIPT
      },
      {
        name: 'mock-outbound',
        modules: true,
        compatibilityDate: '2026-10-01',
        kvNamespaces: { MOCK_CTRL: `e2e-${tag}-mock-ctrl` },
        script: MOCK_OUTBOUND_SCRIPT
      }
    ]
  }));

  let db;
  let mockCtrl;
  try {
    db = await mf.getD1Database('DB', 'trinity');
    mockCtrl = await mf.getKVNamespace('MOCK_CTRL', 'mock-outbound');
    await applyAllMigrations(db);

    // Seed ordinary (non-admin) active user & valid session cookie
    const security = await loadModule('../src/security.js');
    const tokenHash = await security.hash(ORDINARY_SESSION_TOKEN);
    await db.prepare(
      "INSERT OR REPLACE INTO ops_users(email, google_sub, display_name, role, status) VALUES(?, 'e2e-ordinary-sub', 'E2E Ordinary User', 'user', 'active')"
    ).bind(ORDINARY_EMAIL).run();
    await db.prepare(
      'INSERT OR REPLACE INTO ops_sessions(token_hash, email, expires_at) VALUES(?, ?, ?)'
    ).bind(tokenHash, ORDINARY_EMAIL, Date.now() + 3600_000).run();
  } catch (err) {
    await mf.dispose().catch(() => {});
    throw err;
  }

  const req = (path, { method, body, auth = 'owner', headers = {} } = {}) => {
    const resolvedMethod = method || (body === undefined ? 'GET' : 'POST');
    const authHeaders = auth === 'owner'
      ? { Authorization: `Bearer ${OWNER_KEY}` }
      : auth === 'user'
        ? { Cookie: `trinity_session=${ORDINARY_SESSION_TOKEN}` }
        : {};
    return mf.dispatchFetch(WORKER_ORIGIN + path, {
      method: resolvedMethod,
      headers: {
        ...authHeaders,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  };

  const resetOutbound = async (mode = 'ok') => {
    await mockCtrl.put('requests', '[]');
    await mockCtrl.put('mode', mode);
  };

  const getOutboundRequests = async () => (await mockCtrl.get('requests', 'json')) || [];

  return { mf, db, mockCtrl, req, resetOutbound, getOutboundRequests };
}

// ---------------------------------------------------------------------------
// Mock Google AI Studio Fetcher for Contract-Layer Tests
// ---------------------------------------------------------------------------
function createMockAiStudioFetcher({
  modelsStatus = 200,
  generateStatus = 200,
  failModels = new Set(['gemini-3.8-flash']),
  responseText = 'Structured co-creation proposal from Google AI Studio.',
  errorMessageSuffix = ''
} = {}) {
  const calls = [];
  const fetcher = async (urlInput, init = {}) => {
    const urlStr = String(urlInput);
    const parsed = new URL(urlStr);
    const headerEntries = init.headers instanceof Headers
      ? Object.fromEntries([...init.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]))
      : Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));

    calls.push({
      url: urlStr,
      pathname: parsed.pathname,
      search: parsed.search,
      method: init.method || 'GET',
      headers: headerEntries,
      body: typeof init.body === 'string' ? init.body : ''
    });

    if (parsed.pathname.endsWith('/models')) {
      if (modelsStatus !== 200) {
        return new Response(JSON.stringify({
          error: {
            code: modelsStatus,
            message: `Upstream models error ${modelsStatus} ${errorMessageSuffix}`
          }
        }), { status: modelsStatus, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        models: [
          { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'streamGenerateContent'] },
          { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if target model should return 404 (for cascade testing)
    for (const badModel of failModels) {
      if (parsed.pathname.includes(`/models/${badModel}:`)) {
        return new Response(JSON.stringify({
          error: { code: 404, message: `models/${badModel} is not found for API version v1beta`, status: 'NOT_FOUND' }
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (generateStatus !== 200) {
      return new Response(JSON.stringify({
        error: {
          code: generateStatus,
          message: `Upstream generate error ${generateStatus} ${errorMessageSuffix}`
        }
      }), { status: generateStatus, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      candidates: [
        {
          content: { role: 'model', parts: [{ text: responseText }] },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: { promptTokenCount: 25, candidatesTokenCount: 15, totalTokenCount: 40 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetcher, calls };
}

/**
 * Boots Trinity/public/assistant/chat.js.txt against real DOM IDs from chat.html in a Node vm sandbox.
 */
function bootAssistantUiSandbox() {
  const html = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
  const source = readFileSync(resolve(ASSISTANT_DIR, 'chat.js.txt'), 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const elements = new Map();

  function makeNode(tagName = 'div') {
    const listeners = new Map();
    const classes = new Set();
    return {
      tagName: tagName.toUpperCase(),
      children: [],
      hidden: false,
      value: '',
      checked: false,
      disabled: false,
      textContent: '',
      innerHTML: '',
      dataset: {},
      style: {},
      classList: {
        add(...cs) { cs.forEach(c => classes.add(c)); },
        remove(...cs) { cs.forEach(c => classes.delete(c)); },
        toggle(c, force) {
          if (force === undefined) {
            if (classes.has(c)) classes.delete(c);
            else classes.add(c);
          } else if (force) classes.add(c);
          else classes.delete(c);
        },
        contains(c) { return classes.has(c); }
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatchEvent(ev) {
        for (const fn of (listeners.get(ev.type) || [])) fn(ev);
      },
      querySelector() { return makeNode(); },
      querySelectorAll() { return []; },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      focus() {},
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k] ?? null; },
      removeAttribute(k) { delete this[k]; }
    };
  }

  for (const id of ids) elements.set(id, makeNode());

  // Capture data-ttk-action elements from chat.html so querySelectorAll('[data-ttk-action]') sees them
  const ttkActionButtons = [...html.matchAll(/data-ttk-action="([^"]+)"/g)].map(m => {
    const btn = makeNode('button');
    btn.dataset.ttkAction = m[1];
    btn.setAttribute('data-ttk-action', m[1]);
    return btn;
  });

  const storage = new Map();
  let bootstrap = null;
  const fetchCalls = [];

  const context = {
    console, URL, URLSearchParams, TextDecoder, AbortController, AbortSignal, Response, DOMException, crypto, Intl, Date,
    setTimeout(fn, ms, ...args) { return setTimeout(fn, ms, ...args).unref(); },
    clearTimeout,
    setInterval(fn, ms, ...args) { return setInterval(fn, ms, ...args).unref(); },
    clearInterval,
    MutationObserver: class { observe() {} disconnect() {} },
    document: {
      getElementById: id => elements.get(id) || null,
      querySelector: sel => {
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        return null;
      },
      querySelectorAll: sel => {
        if (sel.includes('data-ttk-action')) return ttkActionButtons;
        return [];
      },
      createElement: makeNode,
      documentElement: makeNode('html'),
      body: makeNode('body'),
      addEventListener() {}
    },
    localStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k)
    },
    location: { hostname: 'auru.space', host: 'auru.space', origin: 'https://auru.space', href: 'https://auru.space/', hash: '', search: '', pathname: '/' },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    window: { addEventListener() {}, PublicKeyCredential: function () {} },
    fetch: async (path, init) => {
      fetchCalls.push({ path: String(path), init });
      if (String(path).includes('/ui-evolution')) return Response.json({ state: {} });
      if (String(path).includes('/crypto/tetrakis')) {
        return Response.json({
          token: { name: 'Tetrakis', symbol: 'TTK', totalSupply: '1000000000' },
          deployment_status: 'not_configured',
          market_price: null,
          payments: { enabled: false },
          utility_pillars: []
        });
      }
      return Response.json({});
    },
    TrinityAuth: {
      start(options) { bootstrap = options; },
      config: async () => ({ google_enabled: false, google_required: false }),
      requestJSON: async () => ({ account: { role: 'owner', email: OWNER_EMAIL }, pc_bridge: { connected: false }, cloud: true })
    }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { timeout: 5000 });
  return {
    html,
    source,
    context,
    elements,
    ttkActionButtons,
    fetchCalls,
    get bootstrap() { return bootstrap; },
    run: code => vm.runInContext(code, context, { timeout: 3000 })
  };
}

// ---------------------------------------------------------------------------
// Shared Harnesses (Cleanly Initialized & Disposed)
// ---------------------------------------------------------------------------
let storageHarness = null;
let primaryWorker = null;
let unconfiguredWorker = null;

async function ensureStorage() {
  if (!storageHarness) {
    storageHarness = await createStorageHarness('unit');
  }
  return storageHarness;
}

async function ensurePrimaryWorker() {
  if (!primaryWorker) {
    primaryWorker = await createWorkerHarness({
      tag: 'primary',
      extraBindings: {
        GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY
      }
    });
  }
  return primaryWorker;
}

async function ensureUnconfiguredWorker() {
  if (!unconfiguredWorker) {
    unconfiguredWorker = await createWorkerHarness({
      tag: 'unconfigured',
      extraBindings: {}
    });
  }
  return unconfiguredWorker;
}

after(async () => {
  await Promise.allSettled([
    storageHarness?.mf?.dispose(),
    primaryWorker?.mf?.dispose(),
    unconfiguredWorker?.mf?.dispose()
  ]);
});

// ===========================================================================
// TIER 1 — CATEGORY-PARTITION FUNCTIONAL COVERAGE (23 tests)
// ===========================================================================
describe('Tier 1 — Category-Partition Functional Coverage', () => {
  // -------------------------------------------------------------------------
  // Area A — Tetrakis ($TTK) Native Space & 4-Pillar Utility (T1-A1 .. T1-A6)
  // -------------------------------------------------------------------------
  test('T1-A1: Zero-TON Purge Across Space UI, CSS & JS', () => {
    const chatHtml = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
    const garageCss = readFileSync(resolve(ASSISTANT_DIR, 'garage.css'), 'utf8');
    const chatJs = readFileSync(resolve(ASSISTANT_DIR, 'chat.js.txt'), 'utf8');

    assertZeroTonLeaks(chatHtml, 'Trinity/public/assistant/chat.html');
    assertZeroTonLeaks(garageCss, 'Trinity/public/assistant/garage.css');
    assertZeroTonLeaks(chatJs, 'Trinity/public/assistant/chat.js.txt');
  });

  test('T1-A2: Tetrakis Brand, /tetrakis-logo.png & Tetrahedron Visuals', () => {
    const chatHtml = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
    const garageCss = readFileSync(resolve(ASSISTANT_DIR, 'garage.css'), 'utf8');
    const swJs = readFileSync(resolve(ASSISTANT_DIR, 'sw.js.txt'), 'utf8');
    const logoBytes = readFileSync(resolve(ASSISTANT_DIR, 'tetrakis-logo.png'));

    // Valid PNG magic bytes 89 50 4E 47
    assert.ok(logoBytes.length > 100, 'tetrakis-logo.png must be non-empty');
    assert.deepEqual([...logoBytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'tetrakis-logo.png must start with PNG magic bytes 89 50 4E 47');

    // Clean Tetrakis CSS classes, custom properties, actions & IDs
    assert.match(garageCss, /\.ttk-space-/, 'garage.css must define .ttk-space-* classes');
    assert.match(garageCss, /--ttk-/, 'garage.css must define --ttk-* custom properties');
    assert.match(chatHtml, /data-ttk-action=/, 'chat.html must use data-ttk-action attributes');
    assert.match(chatHtml, /id="ttk-send-card"/, 'chat.html must define #ttk-send-card');
    assert.match(chatHtml, /id="ttk-contract-card"/, 'chat.html must define #ttk-contract-card');

    // Prominent /tetrakis-logo.png in #crypto-view .ttk-space-emblem AND #wallet-view .tg-asset-avatar.ttk
    const cryptoView = extractHtmlElementById(chatHtml, 'crypto-view');
    const walletView = extractHtmlElementById(chatHtml, 'wallet-view');
    assert.ok(cryptoView, '#crypto-view must exist in chat.html');
    assert.ok(walletView, '#wallet-view must exist in chat.html');
    assert.match(
      cryptoView,
      /ttk-space-emblem[\s\S]{0,600}<img[^>]+src="\/tetrakis-logo\.png"/i,
      '#crypto-view .ttk-space-emblem must render <img src="/tetrakis-logo.png">'
    );
    assert.match(
      walletView,
      /tg-asset-avatar\s+ttk[\s\S]{0,400}<img[^>]+src="\/tetrakis-logo\.png"/i,
      '#wallet-view .tg-asset-avatar.ttk must render <img src="/tetrakis-logo.png">'
    );

    // Service worker allowlists /tetrakis-logo.png
    assert.match(swJs, /\/tetrakis-logo\.png/, 'sw.js.txt must allowlist /tetrakis-logo.png');
  });

  test('T1-A3: Authentic 4-Pillar Ecosystem Utility in UI, Backend & Lore', async () => {
    const chatHtml = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
    const cryptoView = extractHtmlElementById(chatHtml, 'crypto-view');
    assert.ok(cryptoView, '#crypto-view must exist in chat.html');
    assertAllFourTetrakisPillars(cryptoView, '#crypto-view (chat.html)');

    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const getTetrakisStatus = requireExport(cryptoMod, 'getTetrakisStatus', '../src/crypto-value-engine.js');
    const status = await getTetrakisStatus({});
    assert.ok(Array.isArray(status.utility_pillars), 'getTetrakisStatus().utility_pillars must be an array');
    assert.equal(status.utility_pillars.length, 4, 'getTetrakisStatus().utility_pillars must contain all 4 ecosystem utility pillars');
    assertAllFourTetrakisPillars(JSON.stringify(status.utility_pillars), 'getTetrakisStatus().utility_pillars');

    const manifestoRaw = readRepoFile('packages/crypto-core/lore/manifesto.json');
    const manifesto = JSON.parse(manifestoRaw);
    assert.equal(manifesto.symbol, 'TTK');
    assertAllFourTetrakisPillars(manifestoRaw, 'packages/crypto-core/lore/manifesto.json');

    const whitepaper = readRepoFile('docs/TETRAKIS-WHITEPAPER.md');
    assertAllFourTetrakisPillars(whitepaper, 'docs/TETRAKIS-WHITEPAPER.md');
  });

  test('T1-A4: Tetrakis Backend Verification & ERC-20 Calldata Contract', async () => {
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const getTetrakisStatus = requireExport(cryptoMod, 'getTetrakisStatus', '../src/crypto-value-engine.js');
    const parseTtkAmount = requireExport(cryptoMod, 'parseTtkAmount', '../src/crypto-value-engine.js');
    const encodeTtkTransfer = requireExport(cryptoMod, 'encodeTtkTransfer', '../src/crypto-value-engine.js');

    const artifact = JSON.parse(readRepoFile('contracts/tetrakis/build/TetrakisToken.json'));
    const fetchImpl = async (_url, options) => {
      const rpc = JSON.parse(options.body);
      const result = rpc.method === 'eth_chainId' ? '0x2105' : artifact.deployedBytecode;
      return { ok: true, json: async () => ({ jsonrpc: '2.0', id: rpc.id, result }) };
    };

    const status = await getTetrakisStatus({
      TTK_CHAIN_ID: '8453',
      TTK_CONTRACT_ADDRESS: TTK_CONTRACT_ADDR,
      TTK_PAYMENT_RECIPIENT: TTK_RECIPIENT_ADDR
    }, { fetchImpl });

    assert.equal(status.deployment_status, 'deployed_verified');
    assert.equal(status.payments.enabled, true);
    assert.equal(status.market_price, null);
    assert.equal(status.symbol || status.token?.symbol, 'TTK');

    const units = parseTtkAmount('42.125');
    assert.equal(units, 42_125_000_000_000_000_000n);
    const calldata = encodeTtkTransfer(TTK_RECIPIENT_ADDR, units);
    assert.equal(calldata.slice(0, 10), '0xa9059cbb');
    assert.equal(calldata.length, 138);
    assert.equal(BigInt(`0x${calldata.slice(-64)}`), units);
  });

  test('T1-A5: Worker HTTP Serving of /tetrakis-logo.png & /api/assistant/crypto/tetrakis', async () => {
    const w = await ensurePrimaryWorker();

    const logoRes = await w.req('/tetrakis-logo.png', { auth: 'none' });
    assert.equal(logoRes.status, 200, 'GET /tetrakis-logo.png must return HTTP 200');
    assert.match(logoRes.headers.get('content-type') || '', /image\/png/i);
    const buf = new Uint8Array(await logoRes.arrayBuffer());
    assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'GET /tetrakis-logo.png must serve genuine PNG magic bytes');

    for (const ep of ['/api/assistant/crypto/tetrakis', '/api/assistant/crypto/value']) {
      const res = await w.req(ep, { auth: 'owner' });
      assert.equal(res.status, 200, `GET ${ep} must return HTTP 200`);
      const body = await res.json();
      assert.ok((body.symbol || body.token?.symbol) === 'TTK', `${ep} must return token metadata`);
      assert.ok(body.network, `${ep} must return network metadata`);
      assert.ok(body.payments && typeof body.payments.enabled === 'boolean', `${ep} must return payments object`);
      assert.equal(body.market_price, null, `${ep} must return market_price: null (Truth Policy 2.1)`);
      assert.ok(Array.isArray(body.utility_pillars) && body.utility_pillars.length === 4, `${ep} must return 4 utility_pillars`);
    }
  });

  test('T1-A6: Preserved Functional DOM IDs & vm JS Wiring', () => {
    const s = bootAssistantUiSandbox();
    const requiredIds = [
      'web3-connect-btn',
      'ttk-payment-form',
      'ttk-payment-amount',
      'ttk-pay-btn',
      'ttk-copy-contract-btn',
      'ttk-send-card',
      'ttk-contract-card'
    ];
    for (const id of requiredIds) {
      assert.ok(s.elements.has(id), `chat.html must preserve interactive element #${id}`);
    }
    assert.ok(s.ttkActionButtons.length > 0, 'chat.html must expose data-ttk-action controls');
    assert.doesNotMatch(s.source, /data-ton-action/, 'chat.js.txt must not reference data-ton-action');
    assert.match(s.source, /data-ttk-action/, 'chat.js.txt must wire data-ttk-action');
    assert.equal(typeof s.bootstrap?.initialize, 'function', 'chat.js.txt must boot cleanly and register TrinityAuth.start');
  });

  // -------------------------------------------------------------------------
  // Area B — Google AI Studio Bridge (T1-B1 .. T1-B7)
  // -------------------------------------------------------------------------
  test('T1-B1: Metadata-Only Status Contract (Zero Secrets Store .get() Calls)', async () => {
    const mod = await loadModule('../src/google-ai-studio-bridge.js');
    const getStatus = requireExport(mod, 'getAiStudioBridgeStatus', '../src/google-ai-studio-bridge.js');
    const BASE_URL = requireExport(mod, 'GOOGLE_AI_STUDIO_BASE_URL', '../src/google-ai-studio-bridge.js');

    let getCalls = 0;
    const env = {
      TRINITY_MASTER_GOOGLE: {
        get: async () => {
          getCalls++;
          return SYNTHETIC_AI_STUDIO_KEY;
        }
      }
    };

    const status = await getStatus(env);
    assert.equal(status.bridge, 'google-ai-studio');
    assert.equal(status.endpoint, BASE_URL);
    assert.equal(status.endpoint, 'https://generativelanguage.googleapis.com/v1beta');
    assert.equal(status.configured, true);
    assert.equal(status.live_verified, false);
    assert.equal(status.secret_values_accessed, false);
    assert.equal(getCalls, 0, 'getAiStudioBridgeStatus must NEVER call Secrets Store .get()');
    assert.equal(JSON.stringify(status).includes(SYNTHETIC_AI_STUDIO_KEY), false, 'status must never leak secret value');
  });

  test('T1-B2: 3-Layer Credential Resolution (Worker Secrets, Secrets Store & AES-GCM Vault)', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const resolveCred = requireExport(bridge, 'resolveAiStudioCredential', '../src/google-ai-studio-bridge.js');
    const envVault = await loadModule('../src/env-vault.js');
    const secretVault = await loadModule('../src/secret-vault.js');
    const aiProviders = await loadModule('../src/ai-providers.js');

    // Layer 1: Worker string secrets
    for (const bindingName of ['GOOGLE_AI_STUDIO_API_KEY', 'GEMINI_API_KEY', 'apigoogle']) {
      const res = await resolveCred({ [bindingName]: SYNTHETIC_AI_STUDIO_KEY });
      assert.equal(res.apiKey, SYNTHETIC_AI_STUDIO_KEY, `Layer 1 must resolve ${bindingName}`);
      assert.ok(res.source, 'Layer 1 must populate source');
      assert.ok(res.binding, 'Layer 1 must populate binding');
    }

    // Layer 2: Secrets Store async .get()
    for (const bindingName of ['GOOGLE_AI_STUDIO_API_KEY', 'GEMINI_API_KEY', 'TRINITY_MASTER_GOOGLE']) {
      let called = 0;
      const res = await resolveCred({
        [bindingName]: {
          get: async () => {
            called++;
            return SYNTHETIC_ALT_KEY;
          }
        }
      });
      assert.equal(called, 1, `Layer 2 must invoke .get() on ${bindingName}`);
      assert.equal(res.apiKey, SYNTHETIC_ALT_KEY, `Layer 2 must resolve ${bindingName}`);
    }

    // Layer 3: AES-GCM encrypted D1 Vault (ops_secret_vault)
    const { db } = await ensureStorage();
    const vaultEnv = { DB: db, TRINITY_VAULT_KEY: VAULT_MASTER_KEY };
    const stored = await secretVault.storeSecret(vaultEnv, OWNER_EMAIL, {
      provider: 'google_ai_studio',
      name: 'E2E AI Studio Key',
      secret: SYNTHETIC_VAULT_KEY
    });
    try {
      const vaultRes = await resolveCred(vaultEnv, { ownerId: OWNER_EMAIL });
      assert.equal(vaultRes.apiKey, SYNTHETIC_VAULT_KEY, 'Layer 3 must decrypt google_ai_studio secret from AES-GCM D1 Vault');
    } finally {
      await secretVault.revokeSecret(vaultEnv, OWNER_EMAIL, stored.id);
    }

    // env-vault.js & ai-providers.js alignment
    assert.ok(
      envVault.PROVIDER_ENV_KEYS.google_ai_studio?.includes('GOOGLE_AI_STUDIO_API_KEY') ||
      envVault.PROVIDER_ENV_KEYS.gemini?.includes('GOOGLE_AI_STUDIO_API_KEY'),
      'env-vault.js PROVIDER_ENV_KEYS must recognize GOOGLE_AI_STUDIO_API_KEY'
    );
    const providers = await aiProviders.listAIProviders({ GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY }, OWNER_EMAIL);
    const geminiItem = providers.items.find(p => p.id === 'gemini' || p.id === 'google_ai_studio');
    assert.ok(geminiItem && geminiItem.configured === true, 'ai-providers.js must recognize GOOGLE_AI_STUDIO_API_KEY');
  });

  test('T1-B3: Model Discovery via x-goog-api-key Header Only (Zero ?key= Param)', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const listModels = requireExport(bridge, 'listAiStudioModels', '../src/google-ai-studio-bridge.js');

    const { fetcher, calls } = createMockAiStudioFetcher();
    const res = await listModels({ GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY }, { fetcher });

    assert.equal(res.ok, true);
    assert.equal(res.verified, true);
    assert.ok(Array.isArray(res.models) && res.models.length >= 2, 'must return discovered model list');
    assert.ok(res.recommended_model, 'must provide recommended_model');
    assert.equal(typeof res.total, 'number');
    assert.ok(res.receipt, 'must return structured Truth Policy receipt');

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith('https://generativelanguage.googleapis.com/v1beta/models'), 'must call v1beta/models');
    assert.equal(calls[0].headers['x-goog-api-key'], SYNTHETIC_AI_STUDIO_KEY, 'must pass key via x-goog-api-key header');
    assert.doesNotMatch(calls[0].url, /[?&]key=/i, 'must NEVER pass API key in query string');
  });

  test('T1-B4: Direct Generation & Live Verification Probe', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const generate = requireExport(bridge, 'generateAiStudioContent', '../src/google-ai-studio-bridge.js');
    const verify = requireExport(bridge, 'verifyAiStudioConnection', '../src/google-ai-studio-bridge.js');

    const { fetcher, calls } = createMockAiStudioFetcher({
      responseText: 'Verified generated output from Gemini 2.5 Flash.'
    });

    const gen = await generate(
      { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY },
      { prompt: 'Summarize the Trinity bridge architecture.', model: 'gemini-2.5-flash' },
      { fetcher }
    );
    assert.equal(gen.ok, true);
    assert.equal(gen.provider, 'google-ai-studio');
    assert.ok(gen.text && gen.text.includes('Verified generated output'));
    assert.ok(gen.usage, 'must include usage metadata');
    assert.equal(typeof gen.latency_ms, 'number');
    assert.ok(gen.receipt, 'must include structured receipt');

    const probe = await verify({ GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY }, { fetcher });
    assert.equal(probe.ok, true);
    assert.equal(probe.connected, true);
    assert.equal(probe.verified, true);
    assert.ok(probe.models_count >= 1);
    assert.ok(probe.receipt);
    assert.ok(calls.every(c => !/[?&]key=/i.test(c.url)), 'no call may leak ?key= in URL');
  });

  test('T1-B5: Multi-Turn Collaborative Co-Creation & Session Persistence', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const coCreate = requireExport(bridge, 'coCreateWithAiStudio', '../src/google-ai-studio-bridge.js');
    const getSession = requireExport(bridge, 'getAiStudioSession', '../src/google-ai-studio-bridge.js');
    const listSessions = requireExport(bridge, 'listAiStudioSessions', '../src/google-ai-studio-bridge.js');

    const { db, kv } = await ensureStorage();
    const { fetcher } = createMockAiStudioFetcher({
      responseText: 'AI Studio co-creation draft: modular TypeScript + Cloudflare Edge design.'
    });
    const env = { DB: db, Mastermind: kv, GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY };
    const sessionId = `e2e-session-${crypto.randomUUID().slice(0, 8)}`;

    const turn1 = await coCreate(env, {
      task: 'Navrhni nový modul pre Google AI Studio ko-kreáciu',
      mode: 'pair',
      session_id: sessionId,
      model: 'gemini-2.5-flash'
    }, { fetcher });

    assert.equal(turn1.ok, true);
    assert.equal(turn1.session_id, sessionId);
    assert.equal(turn1.turn, 1);
    assert.deepEqual(turn1.language_policy, { internal_work: 'en', user_communication: 'sk' });
    assert.ok(turn1.trinity_plan, 'turn 1 must include trinity_plan');
    assert.ok(turn1.ai_studio_contribution, 'turn 1 must include ai_studio_contribution');
    assert.ok(turn1.final_reply, 'turn 1 must include final_reply');
    assert.ok(turn1.receipt, 'turn 1 must include receipt');
    assert.ok(turn1._evidence, 'turn 1 must include _evidence');

    const turn2 = await coCreate(env, {
      task: 'Rozšír tento návrh o overenie bezpečnosti',
      mode: 'review',
      session_id: sessionId,
      model: 'gemini-2.5-flash'
    }, { fetcher });

    assert.equal(turn2.ok, true);
    assert.equal(turn2.session_id, sessionId);
    assert.equal(turn2.turn, 2);

    const saved = await getSession(env, sessionId);
    assert.ok(saved, 'getAiStudioSession must retrieve persisted session');
    const savedStr = JSON.stringify(saved);
    assert.ok(savedStr.includes(sessionId), 'retrieved session must match session_id');
    assert.equal(savedStr.includes(SYNTHETIC_AI_STUDIO_KEY), false, 'persisted session must never store plaintext API key');

    const sessions = await listSessions(env, 20);
    const listArr = Array.isArray(sessions) ? sessions : (sessions?.items || sessions?.sessions || []);
    assert.ok(
      listArr.some(s => (s.session_id || s.id) === sessionId),
      'listAiStudioSessions must include the persisted session'
    );
  });

  test('T1-B6: Tool, Plugin, Registry, Catalog, Vault, MCP & UI Wiring', async () => {
    const tools = await loadModule('../src/tools.js');
    const plugins = await loadModule('../src/plugins.js');
    const registry = await loadModule('../src/registry.js');
    const extInt = await loadModule('../src/external-integrations.js');
    const secretVault = await loadModule('../src/secret-vault.js');

    // tools.js wiring
    assert.ok(
      typeof tools.ACCOUNT_CONNECTOR_TOOLS?.has === 'function'
        ? tools.ACCOUNT_CONNECTOR_TOOLS.has('google_ai_studio')
        : tools.ACCOUNT_CONNECTOR_TOOLS.includes('google_ai_studio'),
      'ACCOUNT_CONNECTOR_TOOLS must include google_ai_studio'
    );
    assert.ok(tools.TOOL_SCHEMAS.google_ai_studio, 'TOOL_SCHEMAS must define google_ai_studio');
    assert.ok(tools.TOOL_HELP.google_ai_studio, 'TOOL_HELP must define google_ai_studio');

    // Run tool status action and verify _evidence
    const toolResult = await tools.runTool(
      { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY },
      'orchestrator',
      'google_ai_studio',
      { action: 'status' },
      { adminAuthorized: true, ownerMode: true }
    );
    assert.ok(toolResult && (toolResult._evidence || toolResult.receipt || toolResult.bridge === 'google-ai-studio'), 'runTool(google_ai_studio, status) must return structured status/evidence');
    assert.equal(JSON.stringify(toolResult).includes(SYNTHETIC_AI_STUDIO_KEY), false, 'tool result must not leak API key');

    // plugins.js & registry.js
    assert.ok(
      plugins.PLUGINS.some(p => Array.isArray(p.tools) && p.tools.includes('google_ai_studio')),
      'plugins.js must register a plugin exposing google_ai_studio'
    );
    const orchestrator = registry.agentById('orchestrator');
    assert.ok(orchestrator?.tools?.includes('google_ai_studio'), 'registry.js orchestrator must include google_ai_studio');

    // external-integrations.js
    const integrations = await extInt.listAllIntegrations({ GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY });
    assert.match(JSON.stringify(integrations), /google[_-]ai[_-]studio/i, 'external-integrations.js must list Google AI Studio');

    // secret-vault.js accepts google_ai_studio
    const parsed = secretVault.secretInputSchema.safeParse({
      provider: 'google_ai_studio',
      name: 'Studio Key',
      secret: SYNTHETIC_AI_STUDIO_KEY
    });
    assert.equal(parsed.success, true, 'secretInputSchema must accept provider "google_ai_studio"');

    // mcp.js source registers google_ai_studio_* tools (direct Node import is blocked by .html asset, runtime tested in T4-S4)
    const mcpSource = readFileSync(resolve(SRC_DIR, 'mcp.js'), 'utf8');
    assert.match(mcpSource, /google_ai_studio_/, 'mcp.js must register google_ai_studio_* MCP tools');

    // UI hooks in chat.html (#studio-view & #settings-secret-panel)
    const chatHtml = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
    const studioView = extractHtmlElementById(chatHtml, 'studio-view');
    const secretPanel = extractHtmlElementById(chatHtml, 'settings-secret-panel');
    assert.ok(studioView, '#studio-view must exist in chat.html');
    assert.ok(secretPanel, '#settings-secret-panel must exist in chat.html');
    assert.match(studioView, /ai[-_ ]studio/i, '#studio-view must expose Google AI Studio Co-Creation UI controls');
    assert.match(secretPanel, /value="google_ai_studio"/, '#settings-secret-panel must expose google_ai_studio provider option');
  });

  test('T1-B7: Worker HTTP AI Studio Bridge Routes (Miniflare + Outbound Mock)', async () => {
    const w = await ensurePrimaryWorker();
    await w.resetOutbound('ok');

    // 1. GET /status
    const statusRes = await w.req('/api/assistant/ai-studio/status');
    assert.equal(statusRes.status, 200, `GET /status failed: ${await statusRes.clone().text()}`);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.bridge, 'google-ai-studio');
    assert.equal(statusJson.configured, true);
    assert.equal(statusJson.live_verified, false);
    assert.equal(statusJson.secret_values_accessed, false);

    // 2. GET /models
    const modelsRes = await w.req('/api/assistant/ai-studio/models');
    assert.equal(modelsRes.status, 200, `GET /models failed: ${await modelsRes.clone().text()}`);
    const modelsJson = await modelsRes.json();
    assert.equal(modelsJson.ok, true);
    assert.ok(Array.isArray(modelsJson.models) && modelsJson.models.length >= 1);

    // 3. POST /verify
    const verifyRes = await w.req('/api/assistant/ai-studio/verify', { body: {} });
    assert.equal(verifyRes.status, 200, `POST /verify failed: ${await verifyRes.clone().text()}`);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.ok, true);
    assert.equal(verifyJson.verified, true);

    // 4. POST /generate
    const genRes = await w.req('/api/assistant/ai-studio/generate', {
      body: { prompt: 'List 2 edge architecture strengths.', model: 'gemini-2.5-flash' }
    });
    assert.equal(genRes.status, 200, `POST /generate failed: ${await genRes.clone().text()}`);
    const genJson = await genRes.json();
    assert.equal(genJson.ok, true);
    assert.equal(genJson.provider, 'google-ai-studio');
    assert.ok(genJson.text && genJson.text.length > 0);

    // 5. POST /co-create
    const coRes = await w.req('/api/assistant/ai-studio/co-create', {
      body: { task: 'Navrhni krátky API checklist', mode: 'pair', model: 'gemini-2.5-flash' }
    });
    assert.equal(coRes.status, 200, `POST /co-create failed: ${await coRes.clone().text()}`);
    const coJson = await coRes.json();
    assert.equal(coJson.ok, true);
    assert.ok(coJson.session_id);
    assert.equal(coJson.turn, 1);

    // 6. GET /sessions & GET /sessions/:id
    const listRes = await w.req('/api/assistant/ai-studio/sessions');
    assert.equal(listRes.status, 200, `GET /sessions failed: ${await listRes.clone().text()}`);
    const listJson = await listRes.json();
    const items = Array.isArray(listJson) ? listJson : (listJson.items || listJson.sessions || []);
    assert.ok(items.some(s => (s.session_id || s.id) === coJson.session_id));

    const getRes = await w.req(`/api/assistant/ai-studio/sessions/${encodeURIComponent(coJson.session_id)}`);
    assert.equal(getRes.status, 200, `GET /sessions/:id failed: ${await getRes.clone().text()}`);
    const sessionJson = await getRes.json();
    assert.ok(JSON.stringify(sessionJson).includes(coJson.session_id));

    // Verify all outbound calls used x-goog-api-key and NEVER ?key=
    const outbound = await w.getOutboundRequests();
    assert.ok(outbound.length >= 3, 'expected at least 3 real outbound Google API calls');
    for (const call of outbound) {
      assert.equal(call.headers['x-goog-api-key'], SYNTHETIC_AI_STUDIO_KEY);
      assert.doesNotMatch(call.url, /[?&]key=/i);
    }
  });

  // -------------------------------------------------------------------------
  // Area C — Dual-Language Architecture (T1-C1 .. T1-C5)
  // -------------------------------------------------------------------------
  test('T1-C1: Zero Slovak Diacritics in Trinity/src/ Comments & JSDoc', () => {
    const jsFiles = walkJsFiles(SRC_DIR);
    assert.ok(jsFiles.length >= 50, `Expected >= 50 JS files in Trinity/src/, found ${jsFiles.length}`);

    const violations = [];
    for (const file of jsFiles) {
      const source = readFileSync(file, 'utf8');
      const comments = extractJsComments(source);
      for (const c of comments) {
        if (SLOVAK_DIACRITICS_RE.test(c.text)) {
          violations.push(`${relative(REPO_ROOT, file)}:${c.line} -> ${c.text.trim().slice(0, 90)}`);
          if (violations.length >= 25) break;
        }
      }
      if (violations.length >= 25) break;
    }

    assert.equal(
      violations.length,
      0,
      `Found Slovak/Czech diacritics in Trinity/src/ JS comments/JSDoc (first ${violations.length}):\n  - ${violations.join('\n  - ')}`
    );
  });

  test('T1-C2: English Internal Prompts + Explicit Slovak User Reply Directive', async () => {
    const cog = await loadModule('../src/cognition.js');
    const pureEnglishDirectives = [
      ['KNOWLEDGE_DIRECTIVE', cog.KNOWLEDGE_DIRECTIVE],
      ['REASONING_DIRECTIVE', cog.REASONING_DIRECTIVE],
      ['UNIFIED_TRINITY_DIRECTIVE', cog.UNIFIED_TRINITY_DIRECTIVE]
    ];

    for (const [name, text] of pureEnglishDirectives) {
      assert.equal(typeof text, 'string', `${name} must be a string`);
      assert.equal(
        SLOVAK_DIACRITICS_RE.test(text),
        false,
        `${name} internal directive must be written in clean English (no Slovak diacritics)`
      );
    }

    // COMMUNICATION_STYLE is authored in English prose while intentionally quoting exact Slovak feminine grammar & banned Slovak clichés
    assert.equal(typeof cog.COMMUNICATION_STYLE, 'string', 'COMMUNICATION_STYLE must be a string');
    assert.match(cog.COMMUNICATION_STYLE, /COMMUNICATION STYLE:/, 'COMMUNICATION_STYLE must be written in English');
    assert.match(cog.COMMUNICATION_STYLE, /LANGUAGE RULE:\s*Always reply to the user in natural, idiomatic Slovak/i, 'COMMUNICATION_STYLE must explicitly instruct replying to users in Slovak');

    const combined = [...pureEnglishDirectives.map(([, t]) => t), cog.COMMUNICATION_STYLE].join('\n') + '\n' + (cog.languageDirective ? cog.languageDirective('sk') : '');
    assert.match(combined, /Slovak/i, 'Internal English prompt directives must explicitly direct replying to users in Slovak');

    // Also verify Google AI Studio Bridge internal prompt sent to Google is English with Slovak user synthesis rule
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const coCreate = requireExport(bridge, 'coCreateWithAiStudio', '../src/google-ai-studio-bridge.js');
    const { fetcher, calls } = createMockAiStudioFetcher();
    const res = await coCreate(
      { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY },
      { task: 'Help design a clean edge cache', mode: 'pair', model: 'gemini-2.5-flash' },
      { fetcher }
    );
    assert.equal(res.ok, true);
    assert.deepEqual(res.language_policy, { internal_work: 'en', user_communication: 'sk' });
    assert.ok(calls.length >= 1, 'coCreateWithAiStudio must call upstream Google AI Studio');
    const sentBody = calls.at(-1).body;
    assert.match(sentBody, /English|architecture|Trinity/i, 'Outbound co-creation prompt to Google AI Studio must use English internal framing');
  });

  test('T1-C3: Preserved Slovak User-Facing Formatters & Conversational Responses', async () => {
    const vrf = await loadModule('../src/verified-response-formatters.js');
    const truth = await loadModule('../src/truth.js');
    const tg = await loadModule('../src/telegram-bridge.js');
    const vb = await loadModule('../src/viber-bridge.js');

    assert.equal(vrf.UNAVAILABLE, 'Údaj nie je dostupný v systéme', 'UNAVAILABLE user formatter must remain in Slovak');
    const safeSk = truth.safeTruthResponse('sk');
    assert.match(safeSk, /Nemám overený|dôkaz|Režim/i, 'safeTruthResponse("sk") must remain in Slovak');

    const tgCrypto = await tg.executeCrypto({});
    assert.match(tgCrypto, /Tetrakis|TTK/i);
    assert.match(tgCrypto, /Zásoba|Štandard|overen/i, 'Telegram user-facing /crypto reply must remain in Slovak');

    const vbWallet = await vb.executeViberWallet({});
    assert.match(vbWallet, /PEŇAŽENKA|peňaženk/i, 'Viber user-facing wallet reply must remain in Slovak');
  });

  test('T1-C4: Preserved Slovak Input-Intent & Bilingual Truth Claim Detection', async () => {
    const fastChat = await loadModule('../src/fast-chat.js');
    const truth = await loadModule('../src/truth.js');
    const registry = await loadModule('../src/registry.js');

    const identity = fastChat.matchFastChatEdge('kto si');
    assert.equal(identity.matched, true, 'fast-chat must match Slovak "kto si"');
    assert.match(identity.reply, /Trinity/i);

    const calc = fastChat.matchFastChatEdge('koľko je 17 + 25');
    assert.equal(calc.matched, true, 'fast-chat must match Slovak arithmetic "koľko je 17 + 25"');
    assert.equal(calc.result, 42);

    assert.ok(
      truth.findUnsupportedActionClaims('nasadila som novú verziu', []).length > 0,
      'truth.js must detect Slovak unverified deployment claim'
    );
    assert.ok(
      truth.findUnsupportedActionClaims('vytvorila som nový projekt', []).length > 0,
      'truth.js must detect Slovak unverified creation claim'
    );
    assert.ok(
      truth.findUnsupportedActionClaims('I have deployed the worker to production', []).length > 0,
      'truth.js must detect English unverified deployment claim'
    );

    const team = registry.selectTeam('vytvor web a nasad na cloudflare');
    assert.ok(Array.isArray(team) && team.length > 0, 'registry.selectTeam must preserve Slovak routing keywords');
  });

  test('T1-C5: Inviolable Sovereign Oath & Truth Covenant Integrity', async () => {
    const prislub = readRepoFile('PRISLUB_TRINITY.txt');
    assert.ok(prislub.length > 500, 'PRISLUB_TRINITY.txt must remain intact');
    assert.match(prislub, /Basterix|Ivan Sabo/i);

    const cog = await loadModule('../src/cognition.js');
    assert.match(cog.TRINITY_LOYALTY_OATH, /PRÍSAHA PRAVDY/);
    assert.match(cog.TRINITY_LOYALTY_OATH, /PRÍSAHA VERNOSTI/);
    assert.match(cog.TRINITY_LOYALTY_OATH, /PRÍSAHA OCHRANY/);

    const truth = await loadModule('../src/truth.js');
    assert.match(truth.TRUTH_POLICY, /ZÁKAZ KLAMAŤ/);
    assert.match(truth.TRUTH_POLICY, /ZÁKAZ SIMULÁCIÍ/);
  });

  // -------------------------------------------------------------------------
  // Area D — Holistic Documentation Coherence & CI Guardrails (T1-D1 .. T1-D5)
  // -------------------------------------------------------------------------
  test('T1-D1: #doc-pane-crypto & #doc-pane-guide Truth Policy 2.1 Accuracy', () => {
    const chatHtml = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
    const docCrypto = extractHtmlElementById(chatHtml, 'doc-pane-crypto');
    const docOverview = extractHtmlElementById(chatHtml, 'doc-pane-guide');

    assert.ok(docCrypto, '#doc-pane-crypto must exist in chat.html');
    assert.ok(docOverview, '#doc-pane-guide must exist in chat.html');

    // Truth Policy 2.1 fixes: zero false EIP-2612, zero false deployed claim, zero false auto-unlock
    assert.doesNotMatch(docCrypto, /EIP-2612/i, '#doc-pane-crypto must NOT falsely claim EIP-2612 Permit');
    assert.doesNotMatch(docCrypto, /Bol nasadený/i, '#doc-pane-crypto must NOT falsely claim unverified mainnet deployment');
    assert.doesNotMatch(docCrypto, /automaticky odomkne/i, '#doc-pane-crypto must NOT falsely claim auto-unlock');
    assertZeroTonLeaks(docCrypto, '#doc-pane-crypto');
    assertAllFourTetrakisPillars(docCrypto, '#doc-pane-crypto');
    assert.match(docCrypto, /Truth Policy/i, '#doc-pane-crypto must reference Truth Policy 2.1');
    assert.match(docOverview, /Tetrakis|\$TTK/i, '#doc-pane-guide must accurately reference Tetrakis ($TTK)');
    assertZeroTonLeaks(docOverview, '#doc-pane-guide');
  });

  test('T1-D2: trinity-documents.js Seed Preservation + New Release Docs', async () => {
    const docsMod = await loadModule('../src/trinity-documents.js');
    const seeds = requireExport(docsMod, 'SEED_COMPLIANCE_DOCUMENTS', '../src/trinity-documents.js');
    const ids = new Set(seeds.map(d => d.id));

    for (const preservedId of PRESERVED_DOCUMENT_SEED_IDS) {
      assert.ok(ids.has(preservedId), `SEED_COMPLIANCE_DOCUMENTS must preserve existing seed ID "${preservedId}"`);
    }

    const allSeedText = seeds.map(d => `${d.id}\n${d.title}\n${d.summary}\n${d.content}`).join('\n\n');
    assert.doesNotMatch(allSeedText, /Staging zóna:\s*https:\/\/auru\.dev/i, 'trinity-documents.js must remove stale Staging zóna: https://auru.dev');
    assert.doesNotMatch(allSeedText, /trinity-staging/i, 'trinity-documents.js must remove stale trinity-staging Worker reference');

    // Must cover all 3 release pillars across seed docs (tolerant of new doc ID naming)
    assertAllFourTetrakisPillars(allSeedText, 'SEED_COMPLIANCE_DOCUMENTS (Tetrakis Space 4-pillar utility)');
    assert.match(allSeedText, /Google AI Studio/i, 'SEED_COMPLIANCE_DOCUMENTS must document Google AI Studio Bridge');
    assert.match(allSeedText, /\/api\/assistant\/ai-studio/i, 'SEED_COMPLIANCE_DOCUMENTS must document /api/assistant/ai-studio endpoints');
    assert.match(allSeedText, /(English|anglick)/i, 'SEED_COMPLIANCE_DOCUMENTS must document Dual-Language Architecture (EN internals)');
    assert.match(allSeedText, /(Slovak|sloven)/i, 'SEED_COMPLIANCE_DOCUMENTS must document Dual-Language Architecture (SK user communication)');
  });

  test('T1-D3: Repository Docs Coherence (README, Trinity/README, ARCHITECTURE, API_REFERENCE)', () => {
    const docFiles = ['README.md', 'Trinity/README.md', 'ARCHITECTURE.md', 'API_REFERENCE.md'];
    const contents = Object.fromEntries(docFiles.map(f => [f, readRepoFile(f)]));
    const combined = Object.values(contents).join('\n\n');

    // All 3 major release themes coherently documented
    assertAllFourTetrakisPillars(combined, 'Repository Docs (Tetrakis 4-pillar utility)');
    assert.match(combined, /\/api\/assistant\/ai-studio/, 'Repository docs must cover /api/assistant/ai-studio/* endpoints');
    assert.match(combined, /Google AI Studio/i, 'Repository docs must cover Google AI Studio Bridge');
    assert.match(combined, /Dual-Language|English.*Slovak|anglick.*sloven/i, 'Repository docs must cover Dual-Language Architecture');

    // Individual doc sanity & drift elimination
    for (const [name, text] of Object.entries(contents)) {
      assertZeroTonLeaks(text, name);
      assert.doesNotMatch(text, /\bbuild:development\b/, `${name} must not advertise stale build:development`);
      assert.doesNotMatch(text, /--env\s+development\b/, `${name} must not advertise stale --env development`);
      const liquid = findUnescapedLiquidTags(text);
      assert.equal(liquid.length, 0, `${name} contains unescaped Jekyll Liquid tags: ${JSON.stringify(liquid)}`);
    }
    assert.doesNotMatch(contents['ARCHITECTURE.md'], /\bv?11\.0\.0\b/, 'ARCHITECTURE.md must not contain stale 11.0.0 version drift');
    assert.match(contents['API_REFERENCE.md'], /\/api\/assistant\/ai-studio\/co-create/, 'API_REFERENCE.md must document /api/assistant/ai-studio/co-create');
  });

  test('T1-D4: Synchronized Release Docs CI Check (scripts/sync-release-docs.mjs --check)', () => {
    const out = execFileSync(process.execPath, [resolve(REPO_ROOT, 'scripts/sync-release-docs.mjs'), '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.doesNotMatch(out, /out of date/i, `sync-release-docs --check reported stale docs: ${out}`);
  });

  test('T1-D5: Secrets Store & Single-Production Guardrails', () => {
    const wrangler = JSON.parse(readFileSync(resolve(TRINITY_DIR, 'wrangler.jsonc'), 'utf8'));
    const topBindings = (wrangler.secrets_store_secrets || []).map(s => s.binding);
    const prodBindings = (wrangler.env?.production?.secrets_store_secrets || []).map(s => s.binding);

    assert.deepEqual(topBindings, ['OLLAMA_SECRET'], 'wrangler.jsonc top-level secrets_store_secrets must remain ["OLLAMA_SECRET"]');
    assert.deepEqual(prodBindings, ['OLLAMA_SECRET'], 'wrangler.jsonc production secrets_store_secrets must remain ["OLLAMA_SECRET"]');
    assert.equal(topBindings.includes('TRINITY_MASTER_GOOGLE'), false, 'must NEVER add TRINITY_MASTER_GOOGLE to wrangler.jsonc');

    const doctorOut = execFileSync(process.execPath, [resolve(TRINITY_DIR, 'scripts/secrets-store-doctor.mjs')], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });
    const doctorJson = JSON.parse(doctorOut);
    assert.equal(doctorJson.ok, true);
    assert.deepEqual(doctorJson.production_bindings, ['OLLAMA_SECRET']);
    assert.equal(doctorJson.secret_values_accessed, false);

    const auditOut = execFileSync(process.execPath, [resolve(TRINITY_DIR, 'scripts/cloudflare-env-audit.mjs'), '--strict'], {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    });
    const auditJson = JSON.parse(auditOut);
    assert.equal(auditJson.isolated, true);
    assert.equal(auditJson.mode, 'single-production');
  });
});

// ===========================================================================
// TIER 2 — BOUNDARY VALUE ANALYSIS & NEGATIVE TESTING (21 tests)
// ===========================================================================
describe('Tier 2 — Boundary Value Analysis & Negative Testing', () => {
  // -------------------------------------------------------------------------
  // Area A — Tetrakis Boundary & Negative Cases (T2-A1 .. T2-A5)
  // -------------------------------------------------------------------------
  test('T2-A1: Zero, Negative, Over-Supply & 19-Decimal TTK Amounts', async () => {
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const parseTtkAmount = requireExport(cryptoMod, 'parseTtkAmount', '../src/crypto-value-engine.js');

    // Exact valid boundaries
    assert.equal(parseTtkAmount('0.000000000000000001'), 1n, '1 wei lower boundary must succeed');
    assert.equal(parseTtkAmount('1000000000'), 1_000_000_000n * 10n ** 18n, '1B supply upper boundary must succeed');

    // Out-of-bounds & malformed rejections
    for (const invalid of ['', '   ', '0', '0.000000000000000000', '-1', '-0.5', '1.0000000000000000001', '1000000001', 'NaN', 'Infinity']) {
      assert.throws(() => parseTtkAmount(invalid), `parseTtkAmount(${JSON.stringify(invalid)}) must throw`);
    }
  });

  test('T2-A2: Invalid Recipient & Zero-Address Calldata Rejection', async () => {
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const encodeTtkTransfer = requireExport(cryptoMod, 'encodeTtkTransfer', '../src/crypto-value-engine.js');

    assert.throws(() => encodeTtkTransfer(ZERO_ADDRESS, 1000n), 'must reject zero address');
    assert.throws(() => encodeTtkTransfer('0x1234', 1000n), 'must reject short hex address');
    assert.throws(() => encodeTtkTransfer('not-an-address', 1000n), 'must reject non-hex recipient');
    assert.throws(() => encodeTtkTransfer(TTK_RECIPIENT_ADDR, 0n), 'must reject zero units');
    assert.throws(() => encodeTtkTransfer(TTK_RECIPIENT_ADDR, -5n), 'must reject negative units');
  });

  test('T2-A3: Fail-Closed Unconfigured, Wrong Chain, Wrong Bytecode & RPC Error', async () => {
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const getTetrakisStatus = requireExport(cryptoMod, 'getTetrakisStatus', '../src/crypto-value-engine.js');
    const artifact = JSON.parse(readRepoFile('contracts/tetrakis/build/TetrakisToken.json'));

    // 1. Missing env => 0 RPC calls
    let rpcCalls = 0;
    const unconf = await getTetrakisStatus({}, { fetchImpl: async () => { rpcCalls++; throw new Error('unexpected'); } });
    assert.equal(rpcCalls, 0);
    assert.equal(unconf.payments.enabled, false);
    assert.equal(unconf.market_price, null);

    // 2. Unsupported chain ID 1
    const badChain = await getTetrakisStatus({
      TTK_CHAIN_ID: '1',
      TTK_CONTRACT_ADDRESS: TTK_CONTRACT_ADDR,
      TTK_PAYMENT_RECIPIENT: TTK_RECIPIENT_ADDR
    }, { fetchImpl: async () => { throw new Error('should not call unsupported chain'); } });
    assert.equal(badChain.payments.enabled, false);

    // 3. Network mismatch
    const env = { TTK_CHAIN_ID: '8453', TTK_CONTRACT_ADDRESS: TTK_CONTRACT_ADDR, TTK_PAYMENT_RECIPIENT: TTK_RECIPIENT_ADDR };
    const mismatchNet = await getTetrakisStatus(env, {
      fetchImpl: async (_u, opt) => {
        const rpc = JSON.parse(opt.body);
        return { ok: true, json: async () => ({ result: rpc.method === 'eth_chainId' ? '0x14a34' : artifact.deployedBytecode }) };
      }
    });
    assert.equal(mismatchNet.deployment_status, 'network_mismatch');
    assert.equal(mismatchNet.payments.enabled, false);

    // 4. Contract bytecode mismatch
    const mismatchCode = await getTetrakisStatus(env, {
      fetchImpl: async (_u, opt) => {
        const rpc = JSON.parse(opt.body);
        return { ok: true, json: async () => ({ result: rpc.method === 'eth_chainId' ? '0x2105' : '0x6000' }) };
      }
    });
    assert.equal(mismatchCode.deployment_status, 'contract_mismatch');
    assert.equal(mismatchCode.payments.enabled, false);

    // 5. Thrown RPC network error
    const rpcErr = await getTetrakisStatus(env, {
      fetchImpl: async () => { throw new Error('ECONNREFUSED synthetic RPC failure'); }
    });
    assert.equal(rpcErr.payments.enabled, false);
    assert.equal(rpcErr.market_price, null);
  });

  test('T2-A4: Refusal to Fabricate Market Quote (HTTP 503)', async () => {
    const w = await ensurePrimaryWorker();
    const res = await w.req('/api/assistant/crypto/quote', { body: { amount: 100, currency: 'EUR' } });
    assert.equal(res.status, 503, 'POST /api/assistant/crypto/quote must refuse with HTTP 503');
    const body = await res.json();
    assert.equal(body.market_price, null);
    assert.equal(body.market_price_status, 'unavailable');
  });

  test('T2-A5: External Telegram Bot /wallet Non-Regression Boundary', () => {
    const connectHtml = readRepoFile('Trinity/public/connect.html');
    const tgBridge = readRepoFile('Trinity/src/telegram-bridge.js');
    assert.match(connectHtml, /\/wallet/, 'Trinity/public/connect.html must preserve CI-tested external Telegram Bot /wallet reference');
    assert.match(tgBridge, /\/wallet/, 'Trinity/src/telegram-bridge.js must preserve CI-tested external Telegram Bot /wallet command');
  });

  // -------------------------------------------------------------------------
  // Area B — Google AI Studio Bridge Boundary & Negative Cases (T2-B1 .. T2-B6)
  // -------------------------------------------------------------------------
  test('T2-B1: Unconfigured Fail-Closed — No Silent Edge Fallback', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const listModels = requireExport(bridge, 'listAiStudioModels', '../src/google-ai-studio-bridge.js');
    const verify = requireExport(bridge, 'verifyAiStudioConnection', '../src/google-ai-studio-bridge.js');
    const generate = requireExport(bridge, 'generateAiStudioContent', '../src/google-ai-studio-bridge.js');
    const coCreate = requireExport(bridge, 'coCreateWithAiStudio', '../src/google-ai-studio-bridge.js');

    const failFetcher = async () => { throw new Error('Must not issue outbound fetch when unconfigured'); };
    const env = {};

    const m = await listModels(env, { fetcher: failFetcher });
    assert.equal(m.ok, false);

    const v = await verify(env, { fetcher: failFetcher });
    assert.equal(v.ok, false);
    assert.equal(v.connected, false);

    const g = await generate(env, { prompt: 'Hello' }, { fetcher: failFetcher });
    assert.equal(g.ok, false);

    const c = await coCreate(env, { task: 'Build something' }, { fetcher: failFetcher });
    assert.equal(c.ok, false);
  });

  test('T2-B2: Secret Redaction Under Hostile Error Payloads', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const redact = requireExport(bridge, 'redactAiStudioSecret', '../src/google-ai-studio-bridge.js');
    const generate = requireExport(bridge, 'generateAiStudioContent', '../src/google-ai-studio-bridge.js');

    const hostile = [
      `Leaked key=${SYNTHETIC_AI_STUDIO_KEY}`,
      `https://generativelanguage.googleapis.com/v1beta/models?key=${SYNTHETIC_ALT_KEY}&api_key=${SYNTHETIC_VAULT_KEY}`,
      `x-goog-api-key: ${SYNTHETIC_AI_STUDIO_KEY}`,
      `token=${SYNTHETIC_AQ_SECRET}`
    ].join(' | ');

    const cleaned = redact(hostile);
    for (const secret of [SYNTHETIC_AI_STUDIO_KEY, SYNTHETIC_ALT_KEY, SYNTHETIC_VAULT_KEY, SYNTHETIC_AQ_SECRET]) {
      assert.equal(cleaned.includes(secret), false, `redactAiStudioSecret must strip ${secret.slice(0, 12)}...`);
    }

    // Verify upstream 401/403/429/500 errors echoing the API key are redacted before returning
    for (const status of [401, 403, 429, 500]) {
      const { fetcher } = createMockAiStudioFetcher({
        generateStatus: status,
        failModels: new Set(),
        errorMessageSuffix: `key=${SYNTHETIC_AI_STUDIO_KEY} x-goog-api-key: ${SYNTHETIC_AI_STUDIO_KEY} ?key=${SYNTHETIC_AI_STUDIO_KEY}`
      });
      const res = await generate(
        { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY },
        { prompt: 'Hostile upstream test', model: 'gemini-2.5-flash' },
        { fetcher }
      );
      assert.equal(res.ok, false);
      assert.equal(
        JSON.stringify(res).includes(SYNTHETIC_AI_STUDIO_KEY),
        false,
        `HTTP ${status} error output must never leak API key`
      );
    }
  });

  test('T2-B3: HTTP 404 Model Cascade vs Non-Fallback 401/403/429', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const generate = requireExport(bridge, 'generateAiStudioContent', '../src/google-ai-studio-bridge.js');

    // 404 on gemini-3.8-flash MUST cascade to valid default/discovered model
    const cascadeMock = createMockAiStudioFetcher({
      failModels: new Set(['gemini-3.8-flash']),
      responseText: 'Cascaded successfully to valid Gemini model.'
    });
    const okRes = await generate(
      { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY, GEMINI_MODEL: 'gemini-3.8-flash' },
      { prompt: 'Test 404 model cascade' },
      { fetcher: cascadeMock.fetcher }
    );
    assert.equal(okRes.ok, true, '404 on unavailable model must cascade to valid fallback model');
    assert.notEqual(okRes.model, 'gemini-3.8-flash');
    assert.ok(cascadeMock.calls.some(c => c.pathname.includes('gemini-3.8-flash')), 'must have attempted requested model first');
    assert.ok(cascadeMock.calls.some(c => c.pathname.includes('gemini-2.5-flash') || c.pathname.includes('gemini-2.0-flash')), 'must have cascaded to fallback model');

    // 401, 403, 429 MUST fail closed immediately without masking or retrying all models
    for (const status of [401, 403, 429]) {
      const authMock = createMockAiStudioFetcher({ generateStatus: status, failModels: new Set() });
      const failRes = await generate(
        { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY },
        { prompt: 'Do not fallback on auth/quota error', model: 'gemini-2.5-flash' },
        { fetcher: authMock.fetcher }
      );
      assert.equal(failRes.ok, false, `HTTP ${status} must fail closed`);
      const genCalls = authMock.calls.filter(c => c.pathname.includes(':generateContent'));
      assert.equal(genCalls.length, 1, `HTTP ${status} must NOT cascade across models (called ${genCalls.length} times)`);
    }
  });

  test('T2-B4: Throwing / Malformed Secrets Store Binding Fail-Closed', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const resolveCred = requireExport(bridge, 'resolveAiStudioCredential', '../src/google-ai-studio-bridge.js');

    // Throwing .get() containing a secret substring must fail closed cleanly
    const throwingEnv = {
      TRINITY_MASTER_GOOGLE: {
        get: async () => { throw new Error(`Secret store outage for ${SYNTHETIC_AI_STUDIO_KEY}`); }
      }
    };
    const r1 = await resolveCred(throwingEnv);
    assert.ok(!r1 || !r1.apiKey, 'throwing Secrets Store binding must not return an API key');
    assert.equal(JSON.stringify(r1 || {}).includes(SYNTHETIC_AI_STUDIO_KEY), false, 'must not leak secret from thrown error');

    // Whitespace / empty .get() must fail closed
    const blankEnv = {
      GOOGLE_AI_STUDIO_API_KEY: {
        get: async () => '   \n\t  '
      }
    };
    const r2 = await resolveCred(blankEnv);
    assert.ok(!r2 || !r2.apiKey, 'blank Secrets Store value must be rejected');
  });

  test('T2-B5: Strict Auth & Role Enforcement on HTTP Endpoints', async () => {
    const w = await ensurePrimaryWorker();

    const endpoints = [
      { path: '/api/assistant/ai-studio/status', method: 'GET' },
      { path: '/api/assistant/ai-studio/models', method: 'GET' },
      { path: '/api/assistant/ai-studio/verify', method: 'POST', body: {} },
      { path: '/api/assistant/ai-studio/generate', method: 'POST', body: { prompt: 'hi' } },
      { path: '/api/assistant/ai-studio/co-create', method: 'POST', body: { task: 'hi' } },
      { path: '/api/assistant/ai-studio/sessions', method: 'GET' }
    ];

    for (const ep of endpoints) {
      const unauth = await w.req(ep.path, { method: ep.method, body: ep.body, auth: 'none' });
      assert.equal(unauth.status, 401, `Unauthenticated ${ep.method} ${ep.path} must return 401`);
    }

    // Ordinary non-admin user calling POST /verify must receive 403
    const userVerify = await w.req('/api/assistant/ai-studio/verify', { method: 'POST', body: {}, auth: 'user' });
    assert.equal(userVerify.status, 403, 'Non-admin authenticated user calling POST /verify must return 403');
  });

  test('T2-B6: Session Bounded Window (<= 12 Turns) & Missing/Invalid Input Validation', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const generate = requireExport(bridge, 'generateAiStudioContent', '../src/google-ai-studio-bridge.js');
    const coCreate = requireExport(bridge, 'coCreateWithAiStudio', '../src/google-ai-studio-bridge.js');
    const getSession = requireExport(bridge, 'getAiStudioSession', '../src/google-ai-studio-bridge.js');

    const { db, kv } = await ensureStorage();
    const { fetcher } = createMockAiStudioFetcher();
    const env = { DB: db, Mastermind: kv, GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY };

    // Missing / empty inputs must fail cleanly (return { ok: false } or throw controlled validation error)
    let emptyGenOk = true;
    try {
      const r = await generate(env, { prompt: '   ' }, { fetcher });
      emptyGenOk = Boolean(r?.ok);
    } catch {
      emptyGenOk = false;
    }
    assert.equal(emptyGenOk, false, 'Empty prompt in generateAiStudioContent must fail cleanly');

    let emptyCoOk = true;
    try {
      const r = await coCreate(env, { task: '' }, { fetcher });
      emptyCoOk = Boolean(r?.ok);
    } catch {
      emptyCoOk = false;
    }
    assert.equal(emptyCoOk, false, 'Empty task in coCreateWithAiStudio must fail cleanly');

    // >12 turns on one session must remain bounded (<= 12 persisted turns)
    const boundedId = `e2e-bounded-${crypto.randomUUID().slice(0, 8)}`;
    for (let i = 1; i <= 14; i++) {
      const res = await coCreate(env, {
        task: `Iteration ${i}: refine component`,
        mode: 'pair',
        session_id: boundedId,
        model: 'gemini-2.5-flash'
      }, { fetcher });
      assert.equal(res.ok, true, `Turn ${i} failed`);
    }
    const saved = await getSession(env, boundedId);
    assert.ok(saved, 'Bounded session must be persisted');
    const turns = saved.turns || saved.history || saved.messages || [];
    assert.ok(Array.isArray(turns) && turns.length > 0 && turns.length <= 12, `Persisted turn history must be bounded <= 12, got ${turns.length}`);

    // Unknown session_id returns null (or 404 via HTTP)
    const missing = await getSession(env, 'non-existent-ai-studio-session-xyz');
    assert.equal(missing, null, 'getAiStudioSession for unknown ID must return null');
  });

  // -------------------------------------------------------------------------
  // Area C — Dual-Language Boundary & Negative Cases (T2-C1 .. T2-C5)
  // -------------------------------------------------------------------------
  test('T2-C1: Bilingual Truth Claim Rejection — SK & EN Unverified Claims', async () => {
    const truth = await loadModule('../src/truth.js');
    const skClaims = truth.findUnsupportedActionClaims('Úspešne som nasadila novú verziu na produkciu', []);
    const enClaims = truth.findUnsupportedActionClaims('I have deployed the changes to production', []);
    assert.ok(skClaims.length > 0, 'Must flag unverified Slovak deployment claim');
    assert.ok(enClaims.length > 0, 'Must flag unverified English deployment claim');
  });

  test('T2-C2: Explicit English User Override in Co-Creation', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const coCreate = requireExport(bridge, 'coCreateWithAiStudio', '../src/google-ai-studio-bridge.js');
    const { fetcher } = createMockAiStudioFetcher();
    const env = { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY };

    const enRes = await coCreate(env, {
      task: 'Design a webhook retry policy',
      reply_language: 'en',
      model: 'gemini-2.5-flash'
    }, { fetcher });
    assert.equal(enRes.ok, true);
    assert.deepEqual(enRes.language_policy, { internal_work: 'en', user_communication: 'en' });

    const defaultRes = await coCreate(env, {
      task: 'Navrhni stratégiu retry',
      model: 'gemini-2.5-flash'
    }, { fetcher });
    assert.equal(defaultRes.ok, true);
    assert.deepEqual(defaultRes.language_policy, { internal_work: 'en', user_communication: 'sk' });
  });

  test('T2-C3: Empty/Whitespace & Mixed-Language Input Resilience', async () => {
    const fastChat = await loadModule('../src/fast-chat.js');
    const truth = await loadModule('../src/truth.js');

    for (const edgeInput of ['', '   \n\t  ', '🚀✨ Ďakujem / Thanks! 123', 'ľščťžýáíé äôň']) {
      assert.doesNotThrow(() => fastChat.matchFastChatEdge(edgeInput));
      assert.doesNotThrow(() => truth.findUnsupportedActionClaims(edgeInput, []));
    }
  });

  test('T2-C4: No Slovak Boilerplate Header Regression in Trinity/src/', () => {
    const boilerplateRe = /@description\s+Modul\s+.+\s+v\s+ekosystéme\s+TRINITY\s+OMNI-CORE/;
    const hits = [];
    for (const file of walkJsFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      if (boilerplateRe.test(content)) {
        hits.push(relative(REPO_ROOT, file));
      }
    }
    assert.equal(
      hits.length,
      0,
      `Found ${hits.length} file(s) with legacy Slovak JSDoc boilerplate (first 10): ${hits.slice(0, 10).join(', ')}`
    );
  });

  test('T2-C5: Public Assistant Comments EN vs Slovak UI Notices Preserved', () => {
    const garageCss = readFileSync(resolve(ASSISTANT_DIR, 'garage.css'), 'utf8');
    const chatJs = readFileSync(resolve(ASSISTANT_DIR, 'chat.js.txt'), 'utf8');

    // CSS comments in garage.css must be English (no Slovak diacritics inside /* ... */)
    const cssComments = [...garageCss.matchAll(/\/\*[\s\S]*?\*\//g)].map(m => m[0]);
    const slovakCssComments = cssComments.filter(c => SLOVAK_DIACRITICS_RE.test(c));
    assert.equal(
      slovakCssComments.length,
      0,
      `garage.css comments must be English; found Slovak comments: ${slovakCssComments.slice(0, 3).join(' | ')}`
    );

    // User-facing Slovak login/error notices in chat.js.txt must remain preserved
    assert.match(chatJs, /Prihlásenie do Trinity/, 'chat.js.txt must preserve Slovak login title ("Prihlásenie do Trinity")');
    assert.match(chatJs, /API kľúč/, 'chat.js.txt must preserve Slovak API key notice ("API kľúč")');
  });

  // -------------------------------------------------------------------------
  // Area D — Documentation & Guardrail Negative Cases (T2-D1 .. T2-D5)
  // -------------------------------------------------------------------------
  test('T2-D1: Unknown In-App Document ID Returns Null / 404 (English Technical Error)', async () => {
    const docsMod = await loadModule('../src/trinity-documents.js');
    const getDoc = requireExport(docsMod, 'getTrinityDocument', '../src/trinity-documents.js');

    let returned = undefined;
    let caught = null;
    try {
      returned = await getDoc({}, 'non-existent-doc-id-xyz');
    } catch (err) {
      caught = err;
    }
    if (caught) {
      assert.equal(caught.status, 404, 'getTrinityDocument throwing for unknown ID must use status 404');
      assert.equal(SLOVAK_DIACRITICS_RE.test(caught.message), false, 'Technical 404 error message in trinity-documents.js must be in English');
    } else {
      assert.equal(returned, null, 'getTrinityDocument for unknown ID must return null or throw 404');
    }

    const w = await ensurePrimaryWorker();
    const res = await w.req('/api/assistant/documents/non-existent-doc-id-xyz');
    assert.equal(res.status, 404, 'GET /api/assistant/documents/non-existent-doc-id-xyz must return HTTP 404');
    const body = await res.json();
    assert.ok(body.error, '404 response must contain error message');
    assert.equal(SLOVAK_DIACRITICS_RE.test(String(body.error)), false, 'HTTP 404 API error for missing doc must be in English');
  });

  test('T2-D2: Zero Unescaped Jekyll Liquid Tags Across Updated Markdown Docs', () => {
    const mdFiles = [
      'README.md',
      'Trinity/README.md',
      'ARCHITECTURE.md',
      'API_REFERENCE.md',
      'docs/TETRAKIS-WHITEPAPER.md'
    ];
    for (const rel of mdFiles) {
      const content = readRepoFile(rel);
      const violations = findUnescapedLiquidTags(content);
      assert.equal(
        violations.length,
        0,
        `${rel} has unescaped Jekyll Liquid tags that break jekyll-docker.yml: ${JSON.stringify(violations)}`
      );
    }
  });

  test('T2-D3: Zero Secrets in Trinity/wrangler.jsonc Plaintext vars', () => {
    const raw = readFileSync(resolve(TRINITY_DIR, 'wrangler.jsonc'), 'utf8');
    const cfg = JSON.parse(raw);
    const varBlocks = [cfg.vars || {}, cfg.env?.production?.vars || {}];
    const forbiddenKeys = ['GOOGLE_CLIENT_SECRET', 'GEMINI_API_KEY', 'GOOGLE_AI_STUDIO_API_KEY'];

    for (const vars of varBlocks) {
      for (const fk of forbiddenKeys) {
        assert.equal(Object.hasOwn(vars, fk), false, `wrangler.jsonc vars must never contain plaintext ${fk}`);
      }
    }
    assert.doesNotMatch(raw, /AIza[0-9A-Za-z_-]{20,}/, 'wrangler.jsonc must never contain an AIza... API key');
  });

  test('T2-D4: Release Marker Integrity in README.md & Trinity/README.md', async () => {
    const pkg = JSON.parse(readFileSync(resolve(TRINITY_DIR, 'package.json'), 'utf8'));
    const versionMod = await loadModule('../src/version.js');
    assert.equal(pkg.version, versionMod.TRINITY_VERSION, 'Trinity/package.json version must match Trinity/src/version.js');

    for (const rel of ['README.md', 'Trinity/README.md']) {
      const text = readRepoFile(rel);
      const start = text.indexOf('<!-- trinity-release:start -->');
      const end = text.indexOf('<!-- trinity-release:end -->');
      assert.ok(start >= 0 && end > start, `${rel} must contain valid trinity-release markers`);
      const block = text.slice(start, end);
      assert.ok(block.includes(pkg.version), `${rel} release block must match version ${pkg.version}`);
    }
  });

  test('T2-D5: No Stale Legacy Staging Claims in In-App or Repo Docs', () => {
    const targets = [
      'Trinity/src/trinity-documents.js',
      'Trinity/README.md',
      'API_REFERENCE.md'
    ];
    for (const rel of targets) {
      const text = readRepoFile(rel);
      assert.doesNotMatch(text, /trinity-staging/i, `${rel} must not advertise legacy trinity-staging`);
      assert.doesNotMatch(text, /\bbuild:development\b/, `${rel} must not advertise stale build:development`);
      assert.doesNotMatch(text, /--env\s+development\b/, `${rel} must not advertise stale --env development`);
    }
  });
});

// ===========================================================================
// TIER 3 — PAIRWISE COMBINATORIAL TESTING (5 pairwise matrices)
// ===========================================================================
describe('Tier 3 — Pairwise Combinatorial Testing', () => {
  test('T3-P1: Credential Source x Precedence x Operation Matrix', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const getStatus = requireExport(bridge, 'getAiStudioBridgeStatus', '../src/google-ai-studio-bridge.js');
    const resolveCred = requireExport(bridge, 'resolveAiStudioCredential', '../src/google-ai-studio-bridge.js');
    const listModels = requireExport(bridge, 'listAiStudioModels', '../src/google-ai-studio-bridge.js');
    const generate = requireExport(bridge, 'generateAiStudioContent', '../src/google-ai-studio-bridge.js');
    const secretVault = await loadModule('../src/secret-vault.js');

    const { db } = await ensureStorage();
    const vaultEnvBase = { DB: db, TRINITY_VAULT_KEY: VAULT_MASTER_KEY };
    const stored = await secretVault.storeSecret(vaultEnvBase, OWNER_EMAIL, {
      provider: 'google_ai_studio',
      name: 'Pairwise Vault Key',
      secret: SYNTHETIC_VAULT_KEY
    });

    try {
      const cases = [
        {
          label: 'worker-secret GOOGLE_AI_STUDIO_API_KEY',
          makeEnv: () => ({ env: { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY }, storeCalls: () => 0 }),
          expectedKey: SYNTHETIC_AI_STUDIO_KEY,
          expectStoreZeroOnResolve: true
        },
        {
          label: 'worker-secret GEMINI_API_KEY',
          makeEnv: () => ({ env: { GEMINI_API_KEY: SYNTHETIC_ALT_KEY }, storeCalls: () => 0 }),
          expectedKey: SYNTHETIC_ALT_KEY,
          expectStoreZeroOnResolve: true
        },
        {
          label: 'secrets-store TRINITY_MASTER_GOOGLE',
          makeEnv: () => {
            let calls = 0;
            return {
              env: { TRINITY_MASTER_GOOGLE: { get: async () => { calls++; return SYNTHETIC_ALT_KEY; } } },
              storeCalls: () => calls
            };
          },
          expectedKey: SYNTHETIC_ALT_KEY,
          expectStoreZeroOnResolve: false
        },
        {
          label: 'secrets-store GOOGLE_AI_STUDIO_API_KEY',
          makeEnv: () => {
            let calls = 0;
            return {
              env: { GOOGLE_AI_STUDIO_API_KEY: { get: async () => { calls++; return SYNTHETIC_AI_STUDIO_KEY; } } },
              storeCalls: () => calls
            };
          },
          expectedKey: SYNTHETIC_AI_STUDIO_KEY,
          expectStoreZeroOnResolve: false
        },
        {
          label: 'encrypted-vault ops_secret_vault',
          makeEnv: () => ({ env: { ...vaultEnvBase }, storeCalls: () => 0 }),
          expectedKey: SYNTHETIC_VAULT_KEY,
          expectStoreZeroOnResolve: true
        },
        {
          label: 'precedence: worker-secret overrides secrets-store',
          makeEnv: () => {
            let calls = 0;
            return {
              env: {
                GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY,
                TRINITY_MASTER_GOOGLE: { get: async () => { calls++; return SYNTHETIC_ALT_KEY; } }
              },
              storeCalls: () => calls
            };
          },
          expectedKey: SYNTHETIC_AI_STUDIO_KEY,
          expectStoreZeroOnResolve: true
        }
      ];

      for (const c of cases) {
        const { env, storeCalls } = c.makeEnv();

        // Operation 1: status MUST NEVER call Secrets Store .get()
        const st = await getStatus(env, OWNER_EMAIL);
        assert.equal(st.configured, true, `[${c.label}] status.configured must be true`);
        assert.equal(st.secret_values_accessed, false, `[${c.label}] status.secret_values_accessed must be false`);
        assert.equal(storeCalls(), 0, `[${c.label}] status must make 0 .get() calls`);

        // Operation 2: resolveCredential
        const cred = await resolveCred(env, { ownerId: OWNER_EMAIL });
        assert.equal(cred.apiKey, c.expectedKey, `[${c.label}] resolved wrong key`);
        if (c.expectStoreZeroOnResolve) {
          assert.equal(storeCalls(), 0, `[${c.label}] worker secret precedence must avoid calling store .get()`);
        }

        // Operation 3: listModels
        const lmMock = createMockAiStudioFetcher();
        const lm = await listModels(env, { fetcher: lmMock.fetcher, ownerId: OWNER_EMAIL });
        assert.equal(lm.ok, true, `[${c.label}] listModels failed`);
        assert.equal(lmMock.calls[0].headers['x-goog-api-key'], c.expectedKey);

        // Operation 4: generate
        const genMock = createMockAiStudioFetcher();
        const gen = await generate(env, { prompt: 'ping', model: 'gemini-2.5-flash' }, { fetcher: genMock.fetcher, ownerId: OWNER_EMAIL });
        assert.equal(gen.ok, true, `[${c.label}] generate failed`);
        assert.equal(genMock.calls[0].headers['x-goog-api-key'], c.expectedKey);
      }
    } finally {
      await secretVault.revokeSecret(vaultEnvBase, OWNER_EMAIL, stored.id);
    }
  });

  test('T3-P2: Co-Creation Mode x Reply Language x Upstream Outcome Matrix', async () => {
    const bridge = await loadModule('../src/google-ai-studio-bridge.js');
    const coCreate = requireExport(bridge, 'coCreateWithAiStudio', '../src/google-ai-studio-bridge.js');
    const env = { GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY };

    // Pairwise covering array across mode (4) x reply_language (2) x upstream outcome (3)
    const matrix = [
      { mode: 'pair', reply_language: 'sk', outcome: '200' },
      { mode: 'brainstorm', reply_language: 'en', outcome: '200' },
      { mode: 'review', reply_language: 'sk', outcome: '404_fallback' },
      { mode: 'build_artifact', reply_language: 'en', outcome: '404_fallback' },
      { mode: 'build_artifact', reply_language: 'sk', outcome: '200' },
      { mode: 'pair', reply_language: 'en', outcome: '429' },
      { mode: 'brainstorm', reply_language: 'sk', outcome: '429' },
      { mode: 'review', reply_language: 'en', outcome: '200' }
    ];

    for (const row of matrix) {
      const mock = createMockAiStudioFetcher({
        generateStatus: row.outcome === '429' ? 429 : 200,
        failModels: row.outcome === '404_fallback' ? new Set(['gemini-3.8-flash']) : new Set(),
        responseText: row.mode === 'build_artifact'
          ? '```html\n<!doctype html><html><body><h1>Co-Created Artifact</h1></body></html>\n```'
          : `Proposal for ${row.mode}`
      });

      const res = await coCreate(env, {
        task: `Co-creation matrix task (${row.mode}/${row.reply_language}/${row.outcome})`,
        mode: row.mode,
        reply_language: row.reply_language,
        model: row.outcome === '404_fallback' ? 'gemini-3.8-flash' : 'gemini-2.5-flash'
      }, { fetcher: mock.fetcher });

      if (row.outcome === '429') {
        assert.equal(res.ok, false, `429 rate-limit must fail closed for ${JSON.stringify(row)}`);
        assert.equal(JSON.stringify(res).includes(SYNTHETIC_AI_STUDIO_KEY), false);
      } else {
        assert.equal(res.ok, true, `Expected success for ${JSON.stringify(row)}, got ${JSON.stringify(res)}`);
        assert.equal(res.mode, row.mode);
        assert.deepEqual(res.language_policy, { internal_work: 'en', user_communication: row.reply_language });
        assert.ok(res.receipt, `Missing receipt for ${JSON.stringify(row)}`);
        assert.ok(res._evidence, `Missing _evidence for ${JSON.stringify(row)}`);
      }
    }
  });

  test('T3-P3: Tetrakis Network x Contract State x Recipient Validity Matrix', async () => {
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const getTetrakisStatus = requireExport(cryptoMod, 'getTetrakisStatus', '../src/crypto-value-engine.js');
    const artifact = JSON.parse(readRepoFile('contracts/tetrakis/build/TetrakisToken.json'));

    const chainHex = { '8453': '0x2105', '84532': '0x14a34', '1': '0x1' };
    const matrix = [
      { chain: '8453', bytecode: 'match', recipient: TTK_RECIPIENT_ADDR, expectEnabled: true },
      { chain: '84532', bytecode: 'match', recipient: TTK_RECIPIENT_ADDR, expectEnabled: true },
      { chain: '8453', bytecode: 'mismatch', recipient: TTK_RECIPIENT_ADDR, expectEnabled: false },
      { chain: '8453', bytecode: 'empty', recipient: TTK_RECIPIENT_ADDR, expectEnabled: false },
      { chain: '8453', bytecode: 'match', recipient: ZERO_ADDRESS, expectEnabled: false },
      { chain: '84532', bytecode: 'match', recipient: '', expectEnabled: false },
      { chain: '1', bytecode: 'match', recipient: TTK_RECIPIENT_ADDR, expectEnabled: false },
      { chain: '1', bytecode: 'empty', recipient: ZERO_ADDRESS, expectEnabled: false }
    ];

    for (const row of matrix) {
      const fetchImpl = async (_url, opt) => {
        const rpc = JSON.parse(opt.body);
        if (rpc.method === 'eth_chainId') {
          return { ok: true, json: async () => ({ result: chainHex[row.chain] }) };
        }
        const code = row.bytecode === 'match' ? artifact.deployedBytecode : row.bytecode === 'mismatch' ? '0x6000' : '0x';
        return { ok: true, json: async () => ({ result: code }) };
      };

      const env = {
        TTK_CHAIN_ID: row.chain,
        TTK_CONTRACT_ADDRESS: TTK_CONTRACT_ADDR,
        ...(row.recipient ? { TTK_PAYMENT_RECIPIENT: row.recipient } : {})
      };
      const status = await getTetrakisStatus(env, { fetchImpl });
      assert.equal(
        status.payments.enabled,
        row.expectEnabled,
        `Matrix mismatch for ${JSON.stringify(row)} -> deployment_status=${status.deployment_status}`
      );
      assert.equal(status.market_price, null);
    }
  });

  test('T3-P4: Auth Role x AI Studio Endpoint Matrix via Real Worker', async () => {
    const w = await ensurePrimaryWorker();
    await w.resetOutbound('ok');

    const matrix = [
      { path: '/api/assistant/ai-studio/status', method: 'GET', unauth: 401, user: [200, 403], owner: 200 },
      { path: '/api/assistant/ai-studio/models', method: 'GET', unauth: 401, user: [200, 403], owner: 200 },
      { path: '/api/assistant/ai-studio/verify', method: 'POST', body: {}, unauth: 401, user: [403], owner: 200 },
      { path: '/api/assistant/ai-studio/generate', method: 'POST', body: { prompt: 'Matrix test', model: 'gemini-2.5-flash' }, unauth: 401, user: [200, 403], owner: 200 },
      { path: '/api/assistant/ai-studio/co-create', method: 'POST', body: { task: 'Matrix co-create', model: 'gemini-2.5-flash' }, unauth: 401, user: [200, 403], owner: 200 },
      { path: '/api/assistant/ai-studio/sessions', method: 'GET', unauth: 401, user: [200, 403], owner: 200 }
    ];

    for (const row of matrix) {
      const rUnauth = await w.req(row.path, { method: row.method, body: row.body, auth: 'none' });
      assert.equal(rUnauth.status, row.unauth, `unauth ${row.method} ${row.path}`);

      const rUser = await w.req(row.path, { method: row.method, body: row.body, auth: 'user' });
      assert.ok(
        row.user.includes(rUser.status),
        `ordinary-user ${row.method} ${row.path} expected ${row.user.join('/')} got ${rUser.status}`
      );

      const rOwner = await w.req(row.path, { method: row.method, body: row.body, auth: 'owner' });
      assert.equal(rOwner.status, row.owner, `owner ${row.method} ${row.path}: ${await rOwner.clone().text()}`);
    }
  });

  test('T3-P5: Cross-Layer Consistency Matrix — UI x Backend x In-App Docs x Repo Docs', async () => {
    const chatHtml = readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8');
    const cryptoView = extractHtmlElementById(chatHtml, 'crypto-view') || '';
    const docCrypto = extractHtmlElementById(chatHtml, 'doc-pane-crypto') || '';
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const ttkStatus = await cryptoMod.getTetrakisStatus({});
    const docsMod = await loadModule('../src/trinity-documents.js');
    const seedText = docsMod.SEED_COMPLIANCE_DOCUMENTS.map(d => `${d.title}\n${d.summary}\n${d.content}`).join('\n');
    const repoDocs = ['README.md', 'Trinity/README.md', 'ARCHITECTURE.md', 'API_REFERENCE.md']
      .map(readRepoFile)
      .join('\n');

    const surfaces = [
      ['UI #crypto-view', cryptoView],
      ['UI #doc-pane-crypto', docCrypto],
      ['Backend getTetrakisStatus', JSON.stringify(ttkStatus)],
      ['In-App Seed Docs', seedText],
      ['Repo Docs', repoDocs]
    ];

    for (const [label, text] of surfaces) {
      assertAllFourTetrakisPillars(text, `Cross-layer surface: ${label}`);
      assert.match(text, /Base/i, `${label} must agree on Base L2 network`);
      assert.match(text, /ERC-?20/i, `${label} must agree on ERC-20 standard`);
      assert.match(text, /1[\s,_]?000[\s,_]?000[\s,_]?000|1B/i, `${label} must agree on fixed 1B TTK supply`);
      assertZeroTonLeaks(text, `Cross-layer surface: ${label}`);
    }

    // Logo, AI Studio endpoints & Dual-Language rule consistency across UI/In-App/Repo
    assert.match(cryptoView, /\/tetrakis-logo\.png/);
    assert.match(seedText, /\/api\/assistant\/ai-studio/);
    assert.match(repoDocs, /\/api\/assistant\/ai-studio/);
    assert.match(seedText, /Slovak|sloven/i);
    assert.match(repoDocs, /Slovak|sloven/i);
  });
});

// ===========================================================================
// TIER 4 — REAL-WORLD END-TO-END WORKLOAD SCENARIOS (5 E2E journeys)
// ===========================================================================
describe('Tier 4 — Real-World End-to-End Workload Scenarios', () => {
  test('T4-S1: Full Multi-Turn Trinity <-> Google AI Studio Co-Creation Session over Real Worker HTTP', async () => {
    const w = await ensurePrimaryWorker();
    await w.resetOutbound('ok');

    // Step 1: Metadata-only status check (live_verified: false, zero outbound calls)
    const stRes = await w.req('/api/assistant/ai-studio/status');
    assert.equal(stRes.status, 200);
    const st = await stRes.json();
    assert.equal(st.configured, true);
    assert.equal(st.live_verified, false);
    assert.equal(st.secret_values_accessed, false);
    assert.equal((await w.getOutboundRequests()).length, 0, 'status must trigger 0 outbound network requests');

    // Step 2: Live connection verification
    const verRes = await w.req('/api/assistant/ai-studio/verify', { body: {} });
    assert.equal(verRes.status, 200);
    const ver = await verRes.json();
    assert.equal(ver.verified, true);
    assert.equal(ver.connected, true);

    // Step 3: Discover models
    const modRes = await w.req('/api/assistant/ai-studio/models');
    assert.equal(modRes.status, 200);
    const mod = await modRes.json();
    assert.ok(mod.models.length >= 2);

    // Step 4: Turn 1 build_artifact using default GEMINI_MODEL='gemini-3.8-flash' (triggers 404 -> cascade to gemini-2.5-flash)
    const t1Res = await w.req('/api/assistant/ai-studio/co-create', {
      body: {
        task: 'Vytvor návrh mini-aplikácie pre Tetrakis Space platby',
        mode: 'build_artifact'
      }
    });
    assert.equal(t1Res.status, 200, `Turn 1 co-create failed: ${await t1Res.clone().text()}`);
    const t1 = await t1Res.json();
    assert.equal(t1.ok, true);
    assert.equal(t1.turn, 1);
    assert.ok(t1.session_id);
    assert.deepEqual(t1.language_policy, { internal_work: 'en', user_communication: 'sk' });
    assert.ok(t1._evidence, 'Turn 1 must return Truth Policy _evidence');
    assert.ok(t1.receipt, 'Turn 1 must return receipt');

    // Step 5: Turn 2 follow-up on same session_id
    const t2Res = await w.req('/api/assistant/ai-studio/co-create', {
      body: {
        task: 'Pridaj bezpečnostný checklist pre ERC-20 transfer',
        mode: 'review',
        session_id: t1.session_id,
        model: 'gemini-2.5-flash'
      }
    });
    assert.equal(t2Res.status, 200);
    const t2 = await t2Res.json();
    assert.equal(t2.ok, true);
    assert.equal(t2.turn, 2);
    assert.equal(t2.session_id, t1.session_id);

    // Step 6: Retrieve persisted sessions & individual session history
    const listRes = await w.req('/api/assistant/ai-studio/sessions');
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    const listItems = Array.isArray(listJson) ? listJson : (listJson.items || listJson.sessions || []);
    assert.ok(listItems.some(s => (s.session_id || s.id) === t1.session_id));

    const detailRes = await w.req(`/api/assistant/ai-studio/sessions/${encodeURIComponent(t1.session_id)}`);
    assert.equal(detailRes.status, 200);
    const detailText = await detailRes.text();
    assert.ok(detailText.includes(t1.session_id));

    // Verify zero API key leaks across all responses and valid outbound protocol
    const allResponses = JSON.stringify({ st, ver, mod, t1, t2, listJson, detailText });
    assert.equal(allResponses.includes(SYNTHETIC_AI_STUDIO_KEY), false, 'Synthetic API key must NEVER appear in any HTTP response');

    const outbound = await w.getOutboundRequests();
    assert.ok(outbound.some(r => r.pathname.includes('gemini-3.8-flash')), 'Turn 1 should exercise 404 cascade from gemini-3.8-flash');
    assert.ok(outbound.some(r => r.pathname.includes('gemini-2.5-flash')), 'Turn 1 should cascade to gemini-2.5-flash');
    for (const call of outbound) {
      assert.equal(call.headers['x-goog-api-key'], SYNTHETIC_AI_STUDIO_KEY);
      assert.doesNotMatch(call.url, /[?&]key=/i);
    }
  });

  test('T4-S2: Encrypted Vault -> Google AI Studio Bridge -> Revoke -> Fail-Closed E2E Flow', async () => {
    const w = await ensureUnconfiguredWorker();
    await w.resetOutbound('ok');

    // Step 1: Initially unconfigured -> fail closed
    const initSt = await (await w.req('/api/assistant/ai-studio/status')).json();
    assert.equal(initSt.configured, false, 'Unconfigured worker must initially report configured: false');

    // Step 2: Store synthetic google_ai_studio key via real AES-GCM encrypted Vault API
    const storeRes = await w.req('/api/assistant/secrets', {
      body: { provider: 'google_ai_studio', name: 'E2E Vault Studio Key', secret: SYNTHETIC_VAULT_KEY }
    });
    assert.equal(storeRes.status, 201, `POST /api/assistant/secrets failed: ${await storeRes.clone().text()}`);
    const storedItem = (await storeRes.json()).item;
    assert.ok(storedItem?.id);
    assert.equal(storedItem.secret, undefined, 'Vault must never return plaintext secret');

    try {
      // Step 3: Status detects encrypted vault without leaking plaintext
      const vaultStRes = await w.req('/api/assistant/ai-studio/status');
      assert.equal(vaultStRes.status, 200);
      const vaultSt = await vaultStRes.json();
      assert.equal(vaultSt.configured, true);
      assert.equal(vaultSt.secret_values_accessed, false);
      assert.equal(JSON.stringify(vaultSt).includes(SYNTHETIC_VAULT_KEY), false);

      // Step 4: Verify & Generate end-to-end resolving decrypted Vault secret
      const verRes = await w.req('/api/assistant/ai-studio/verify', { body: {} });
      assert.equal(verRes.status, 200, `Vault verify failed: ${await verRes.clone().text()}`);
      assert.equal((await verRes.json()).verified, true);

      const genRes = await w.req('/api/assistant/ai-studio/generate', {
        body: { prompt: 'Verify decrypted vault call', model: 'gemini-2.5-flash' }
      });
      assert.equal(genRes.status, 200, `Vault generate failed: ${await genRes.clone().text()}`);
      const genJson = await genRes.json();
      assert.equal(genJson.ok, true);
      assert.equal(JSON.stringify(genJson).includes(SYNTHETIC_VAULT_KEY), false);

      const outbound = await w.getOutboundRequests();
      assert.ok(outbound.some(c => c.headers['x-goog-api-key'] === SYNTHETIC_VAULT_KEY), 'Outbound request must use decrypted Vault key via header');
    } finally {
      // Step 5: Revoke the secret
      const revRes = await w.req(`/api/assistant/secrets/${storedItem.id}/revoke`, { body: {} });
      assert.equal(revRes.status, 200, 'Vault secret revocation must succeed');
    }

    // Step 6: After revocation, subsequent calls MUST fail closed
    const postRevGen = await w.req('/api/assistant/ai-studio/generate', {
      body: { prompt: 'Must fail closed after revoke', model: 'gemini-2.5-flash' }
    });
    const postRevBody = await postRevGen.json();
    assert.ok(postRevGen.status >= 400 || postRevBody.ok === false, 'Post-revocation generation must fail closed');
  });

  test('T4-S3: Tetrakis Space Lifecycle — Logo -> Fail-Closed -> Verified Base L2 -> Calldata -> UI Boot', async () => {
    const w = await ensureUnconfiguredWorker();

    // 1. Worker serves authentic PNG logo
    const logoRes = await w.req('/tetrakis-logo.png', { auth: 'none' });
    assert.equal(logoRes.status, 200);
    const pngHead = [...new Uint8Array(await logoRes.arrayBuffer()).subarray(0, 4)];
    assert.deepEqual(pngHead, [0x89, 0x50, 0x4e, 0x47]);

    // 2. Unconfigured Worker returns fail-closed status + 4 utility pillars + market_price: null
    const ttkRes = await w.req('/api/assistant/crypto/tetrakis');
    assert.equal(ttkRes.status, 200);
    const ttkJson = await ttkRes.json();
    assert.equal(ttkJson.deployment_status, 'not_configured');
    assert.equal(ttkJson.payments.enabled, false);
    assert.equal(ttkJson.market_price, null);
    assert.ok(Array.isArray(ttkJson.utility_pillars) && ttkJson.utility_pillars.length === 4);

    // 3. Refusal to fabricate market quote
    const quoteRes = await w.req('/api/assistant/crypto/quote', { body: { amount: 50 } });
    assert.equal(quoteRes.status, 503);

    // 4. Verified Base L2 status + exact 18-decimal ERC-20 transfer calldata
    const cryptoMod = await loadModule('../src/crypto-value-engine.js');
    const artifact = JSON.parse(readRepoFile('contracts/tetrakis/build/TetrakisToken.json'));
    const verified = await cryptoMod.getTetrakisStatus({
      TTK_CHAIN_ID: '8453',
      TTK_CONTRACT_ADDRESS: TTK_CONTRACT_ADDR,
      TTK_PAYMENT_RECIPIENT: TTK_RECIPIENT_ADDR
    }, {
      fetchImpl: async (_u, opt) => {
        const rpc = JSON.parse(opt.body);
        return { ok: true, json: async () => ({ result: rpc.method === 'eth_chainId' ? '0x2105' : artifact.deployedBytecode }) };
      }
    });
    assert.equal(verified.deployment_status, 'deployed_verified');
    assert.equal(verified.payments.enabled, true);
    assert.equal(verified.market_price, null);

    const units = cryptoMod.parseTtkAmount('125.75');
    const calldata = cryptoMod.encodeTtkTransfer(TTK_RECIPIENT_ADDR, units);
    assert.equal(calldata.slice(0, 10), '0xa9059cbb');
    assert.equal(BigInt(`0x${calldata.slice(-64)}`), units);

    // 5. Real vm boot of chat.js.txt + view switching @wallet <-> Tetrakis Space
    const s = bootAssistantUiSandbox();
    await s.bootstrap.initialize();
    await s.run("setView('wallet', false)");
    assert.equal(s.run('currentView'), 'wallet');
    await s.run("setView('crypto', false)");
    assert.equal(s.run('currentView'), 'crypto');
    assertZeroTonLeaks(s.html, 'Booted chat.html');
    assert.match(s.html, /\/tetrakis-logo\.png/);
  });

  test('T4-S4: Agent Tool & MCP End-to-End Invocation of google_ai_studio', async () => {
    const tools = await loadModule('../src/tools.js');
    const { db, kv } = await ensureStorage();

    // 1. Direct runTool('google_ai_studio', status)
    const statusOut = await tools.runTool(
      { DB: db, Mastermind: kv, GOOGLE_AI_STUDIO_API_KEY: SYNTHETIC_AI_STUDIO_KEY },
      'orchestrator',
      'google_ai_studio',
      { action: 'status' },
      { adminAuthorized: true, ownerMode: true }
    );
    assert.ok(statusOut, 'runTool status must return payload');
    assert.equal(JSON.stringify(statusOut).includes(SYNTHETIC_AI_STUDIO_KEY), false);

    // 2. Real Worker MCP tools/list & tools/call over JSON-RPC
    const w = await ensurePrimaryWorker();
    await w.resetOutbound('ok');
    const mcpHeaders = { Accept: 'application/json, text/event-stream' };

    const initRes = await w.req('/mcp', {
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'e2e-suite', version: '1.0' } }
      },
      headers: mcpHeaders
    });
    assert.equal(initRes.status, 200, `MCP initialize failed: ${await initRes.clone().text()}`);

    const listRes = await w.req('/mcp', {
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      headers: mcpHeaders
    });
    assert.equal(listRes.status, 200);
    const listText = await listRes.text();
    assert.match(listText, /google_ai_studio_status/, 'MCP tools/list must expose google_ai_studio_status');
    assert.match(listText, /google_ai_studio_models/, 'MCP tools/list must expose google_ai_studio_models');
    assert.match(listText, /google_ai_studio_cocreate/, 'MCP tools/list must expose google_ai_studio_cocreate');

    const callRes = await w.req('/mcp', {
      body: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'google_ai_studio_status', arguments: {} } },
      headers: mcpHeaders
    });
    assert.equal(callRes.status, 200);
    const callText = await callRes.text();
    assert.match(callText, /google-ai-studio/);
    assert.equal(callText.includes(SYNTHETIC_AI_STUDIO_KEY), false, 'MCP tool output must never leak API key');
  });

  test('T4-S5: Unified Release Truth, Dual-Language & Docs/CI Readiness Audit', async () => {
    const w = await ensurePrimaryWorker();

    // 1. Real Worker GET /api/assistant/documents
    const docsRes = await w.req('/api/assistant/documents?limit=60');
    assert.equal(docsRes.status, 200);
    const docsJson = await docsRes.json();
    const ids = new Set((docsJson.items || []).map(d => d.id));
    for (const seedId of PRESERVED_DOCUMENT_SEED_IDS) {
      assert.ok(ids.has(seedId), `Worker /api/assistant/documents must preserve seed ID ${seedId}`);
    }

    const joined = (docsJson.items || []).map(d => `${d.title}\n${d.summary}\n${d.content}`).join('\n');
    assertAllFourTetrakisPillars(joined, 'Worker /api/assistant/documents');
    assert.match(joined, /Google AI Studio/i, 'Worker /api/assistant/documents must document Google AI Studio Bridge');
    assert.match(joined, /(English|anglick)/i, 'Worker /api/assistant/documents must document Dual-Language Architecture');

    // 2. Real Worker export endpoint
    const exportRes = await w.req('/api/assistant/documents/trinity-kompletna-dokumentacia/export?format=md');
    assert.equal(exportRes.status, 200);
    assert.match(exportRes.headers.get('content-type') || '', /text\/markdown/i);
    const exportedMd = await exportRes.text();
    assert.doesNotMatch(exportedMd, /trinity-staging/i, 'Exported docs must not contain stale trinity-staging claim');

    // 3. CLI CI Gates
    execFileSync(process.execPath, [resolve(REPO_ROOT, 'scripts/sync-release-docs.mjs'), '--check'], { cwd: REPO_ROOT });
    const doctor = JSON.parse(execFileSync(process.execPath, [resolve(TRINITY_DIR, 'scripts/secrets-store-doctor.mjs')], { cwd: REPO_ROOT, encoding: 'utf8' }));
    assert.equal(doctor.ok, true);
    const audit = JSON.parse(execFileSync(process.execPath, [resolve(TRINITY_DIR, 'scripts/cloudflare-env-audit.mjs'), '--strict'], { cwd: REPO_ROOT, encoding: 'utf8' }));
    assert.equal(audit.isolated, true);

    // 4. Zero TON leaks in Tetrakis Space UI & zero Slovak comments in Trinity/src/
    assertZeroTonLeaks(readFileSync(resolve(ASSISTANT_DIR, 'chat.html'), 'utf8'), 'chat.html');
    const srcViolations = [];
    for (const file of walkJsFiles(SRC_DIR)) {
      for (const c of extractJsComments(readFileSync(file, 'utf8'))) {
        if (SLOVAK_DIACRITICS_RE.test(c.text)) {
          srcViolations.push(`${relative(REPO_ROOT, file)}:${c.line}`);
          break;
        }
      }
    }
    assert.equal(srcViolations.length, 0, `Release readiness failed: ${srcViolations.length} src files still contain Slovak comments`);
  });
});
