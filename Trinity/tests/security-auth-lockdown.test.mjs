import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import devGateway from '../src/dev-gateway.js';
import { hash } from '../src/security.js';
import { extractActorFromRequest, handleAuditLedgerRoutes } from '../src/ledger-middleware.js';
import { generateInvoiceWithSepaQr } from '../src/banking-commodity-advanced.js';

const OPS_KEY = 'test-m2-security-ops-key-987654';
const USER_SESSION_TOKEN = 'a'.repeat(64);
const BASE_URL = 'https://auru.dev';

let mf;
let db;

async function createTrinityMiniflare(extraBindings = {}) {
  const modules = readdirSync('dist')
    .filter(x => !x.endsWith('.map') && !x.endsWith('.md'))
    .map(name => ({
      type: name === 'index.js' ? 'ESModule' : 'Text',
      path: resolve('dist', name)
    }));
  modules.sort((a, b) => (a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0));

  const instance = new Miniflare(convertV4MiniflareOptions({
    workers: [
      {
        name: 'trinity',
        modules,
        compatibilityDate: '2026-10-01',
        compatibilityFlags: ['nodejs_compat'],
        bindings: {
          ENVIRONMENT: 'production',
          TRINITY_ENV: 'production',
          TRINITY_OPS_KEY: OPS_KEY,
          TRINITY_OWNER_EMAIL: 'owner@auru.space',
          TRINITY_VAULT_KEY: Buffer.alloc(32, 9).toString('base64url'),
          ...extraBindings
        },
        d1Databases: { DB: 'sec-test-db' },
        kvNamespaces: { Mastermind: 'sec-kv', TRINITY_KV: 'sec-kv' },
        r2Buckets: { ARTIFACTS: 'sec-r2' },
        serviceBindings: { AI: { name: 'mock', entrypoint: 'MockAI' } },
        workflows: { OPS_WORKFLOW: { name: 'sec-workflow', className: 'TrinityOperations' } }
      },
      {
        name: 'mock',
        modules: true,
        compatibilityDate: '2026-10-01',
        script: `import {WorkerEntrypoint} from 'cloudflare:workers';
          export class MockAI extends WorkerEntrypoint {
            async run() { return { response: 'Authenticated reply' }; }
          }
          export default { fetch() { return new Response('mock'); } };`
      }
    ]
  }));

  const database = await instance.getD1Database('DB', 'trinity');
  for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
    const sql = await readFile(resolve('migrations', file), 'utf-8');
    const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await database.prepare(stmt).run().catch(() => {});
    }
  }
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      environment TEXT,
      actor TEXT,
      action TEXT,
      payload TEXT,
      timestamp INTEGER
    )
  `).run();

  const tokenHash = await hash(USER_SESSION_TOKEN);
  await database.prepare(
    "INSERT OR REPLACE INTO ops_users(email, password_hash, role, status) VALUES(?, 'unused', 'user', 'active')"
  ).bind('regular@auru.space').run().catch(() => {});
  await database.prepare(
    'INSERT OR REPLACE INTO ops_sessions(token_hash, expires_at, email) VALUES(?, ?, ?)'
  ).bind(tokenHash, Date.now() + 3_600_000, 'regular@auru.space').run();

  return { mf: instance, db: database };
}

before(async () => {
  ({ mf, db } = await createTrinityMiniflare());
});

after(async () => {
  if (mf) await mf.dispose();
});

test('P0 Auth Lockdown: POST /api/tools/execute enforces 401 unauth, 403 non-admin, and 200 admin on index.js (Miniflare) and dev-gateway.js', async () => {
  const payload = JSON.stringify({
    tool: 'kv_memory_store',
    arguments: { action: 'put', key: 'sec_test', value: 'ok' }
  });

  // 1. Primary Worker (Trinity/src/index.js via dist bundle)
  const unauthWorker = await mf.dispatchFetch(`${BASE_URL}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });
  assert.equal(unauthWorker.status, 401);

  const nonAdminWorker = await mf.dispatchFetch(`${BASE_URL}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `trinity_session=${USER_SESSION_TOKEN}` },
    body: payload
  });
  assert.equal(nonAdminWorker.status, 403);

  const adminWorker = await mf.dispatchFetch(`${BASE_URL}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPS_KEY}` },
    body: payload
  });
  assert.equal(adminWorker.status, 200);
  assert.equal((await adminWorker.json()).status, 'STORED');

  // 2. dev-gateway.js
  const kvStore = new Map();
  const userHash = await hash(USER_SESSION_TOKEN);
  const devEnv = {
    TRINITY_OPS_KEY: OPS_KEY,
    DB: {
      prepare() {
        let bound = [];
        return {
          bind(...args) { bound = args; return this; },
          async first() {
            if (bound[0] === userHash) return { expires_at: Date.now() + 60_000, email: 'regular@auru.space', role: 'user', status: 'active' };
            return null;
          }
        };
      }
    },
    TRINITY_KV: {
      async get(k) { return kvStore.get(k) ?? null; },
      async put(k, v) { kvStore.set(k, v); },
      async delete(k) { kvStore.delete(k); }
    }
  };

  assert.equal(
    (await devGateway.fetch(new Request(`${BASE_URL}/api/tools/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }), devEnv)).status,
    401
  );
  assert.equal(
    (await devGateway.fetch(new Request(`${BASE_URL}/api/tools/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `trinity_session=${USER_SESSION_TOKEN}` }, body: payload }), devEnv)).status,
    403
  );
  const devAdminRes = await devGateway.fetch(
    new Request(`${BASE_URL}/api/tools/execute`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPS_KEY}` }, body: payload }),
    devEnv
  );
  assert.equal(devAdminRes.status, 200);
  assert.equal(kvStore.get('sec_test'), 'ok');
});

test('P0 Auth Lockdown: /api/audit-ledger* requires auth, append requires admin, and spoofed actor headers are ignored', async () => {
  // Unauthenticated GET list, GET verify, POST append -> 401
  assert.equal((await mf.dispatchFetch(`${BASE_URL}/api/audit-ledger`)).status, 401);
  assert.equal((await mf.dispatchFetch(`${BASE_URL}/api/audit-ledger/verify`)).status, 401);
  assert.equal(
    (await mf.dispatchFetch(`${BASE_URL}/api/audit-ledger/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Trinity-Actor': 'Basterix' },
      body: JSON.stringify({ actor: 'Basterix', operation: 'FORGED_BLOCK', payload: {} })
    })).status,
    401
  );

  // Authenticated non-admin can read, but cannot append (403)
  assert.equal(
    (await mf.dispatchFetch(`${BASE_URL}/api/audit-ledger`, {
      headers: { Cookie: `trinity_session=${USER_SESSION_TOKEN}` }
    })).status,
    200
  );
  assert.equal(
    (await mf.dispatchFetch(`${BASE_URL}/api/audit-ledger/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `trinity_session=${USER_SESSION_TOKEN}` },
      body: JSON.stringify({ operation: 'NON_ADMIN_APPEND', payload: {} })
    })).status,
    403
  );

  // Admin append succeeds and uses verified identity (never spoofed header/body actor)
  const appendRes = await mf.dispatchFetch(`${BASE_URL}/api/audit-ledger/append`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPS_KEY}`,
      'X-Trinity-Actor': 'spoofed-header-actor',
      'X-User-Id': 'spoofed-user-id'
    },
    body: JSON.stringify({ actor: 'spoofed-body-actor', operation: 'ADMIN_AUDIT_OP', payload: { ok: true } })
  });
  assert.equal(appendRes.status, 201);
  const appended = await appendRes.json();
  assert.equal(appended.record.actor, 'owner@auru.space');

  // Direct extractActorFromRequest check
  const spoofReq = new Request('https://auru.dev/api/system/actions', {
    headers: { 'X-Trinity-Actor': 'basterix', 'X-User-Id': 'root' }
  });
  assert.equal(extractActorFromRequest(spoofReq), 'unauthenticated');
  assert.notEqual(extractActorFromRequest(spoofReq), 'basterix_edge_gateway');
  assert.equal(extractActorFromRequest(spoofReq, { id: 'uid-9', email: 'real@auru.space' }), 'real@auru.space');

  // Direct handleAuditLedgerRoutes without user -> 401
  const directUnauth = await handleAuditLedgerRoutes(
    new Request('https://auru.dev/api/audit-ledger'),
    {},
    new URL('https://auru.dev/api/audit-ledger')
  );
  assert.equal(directUnauth.status, 401);
});

test('P0 Auth Lockdown: /chat, /api/chat, /api/azure/agent, /api/profiles/*, /api/crypto/tetrakis/vault/deposit reject unauthenticated requests with 401', async () => {
  const paths = [
    ['/chat', { message: '5+5' }],
    ['/api/chat', { message: '5+5' }],
    ['/api/azure/agent', { message: 'hello' }],
    ['/api/profiles/create', { username: 'anon' }],
    ['/api/crypto/tetrakis/vault/deposit', { amount: 100 }]
  ];

  for (const [pathname, body] of paths) {
    const res = await mf.dispatchFetch(`${BASE_URL}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(res.status, 401, `Expected 401 for unauthenticated POST ${pathname}`);
  }
});

test('P0 Audit Attribution: Authenticated /chat records verified user identity, never hardcoded Basterix', async () => {
  const res = await mf.dispatchFetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `trinity_session=${USER_SESSION_TOKEN}`
    },
    body: JSON.stringify({ message: '2+2' })
  });
  assert.equal(res.status, 200);
  // Allow background waitUntil audit log write to settle
  await new Promise(r => setTimeout(r, 50));
  const rows = (await db.prepare('SELECT actor, action FROM audit_logs').all()).results || [];
  assert.ok(rows.length >= 1, 'Expected at least one audit_logs entry for authenticated /chat');
  assert.ok(rows.some(r => r.actor === 'regular@auru.space'), `Expected verified actor regular@auru.space, got ${JSON.stringify(rows)}`);
  assert.ok(rows.every(r => r.actor !== 'Basterix'), 'Actor must never be hardcoded to Basterix');
});

test('P0 PII Redaction & Honesty: GET /api/status strips google_accounts and windows_users and derives omnidev_studio honestly', async () => {
  const res = await mf.dispatchFetch(`${BASE_URL}/api/status`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const raw = JSON.stringify(body);

  assert.equal(body.root_authority.google_accounts, undefined);
  assert.equal(body.root_authority.windows_users, undefined);
  assert.doesNotMatch(raw, /saboivan2008@gmail\.com/i);
  assert.doesNotMatch(raw, /@gmail\.com/i);
  assert.doesNotMatch(raw, /"saboi"/);
  assert.equal(body.integrations.omnidev_studio, 'configured');

  // Verify unconfigured when AI/DB bindings are absent
  const modules = readdirSync('dist')
    .filter(x => !x.endsWith('.map') && !x.endsWith('.md'))
    .map(name => ({
      type: name === 'index.js' ? 'ESModule' : 'Text',
      path: resolve('dist', name)
    }));
  modules.sort((a, b) => (a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0));
  const bareMf = new Miniflare(convertV4MiniflareOptions({
    workers: [{ name: 'trinity-bare', modules, compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'] }]
  }));
  try {
    const bareRes = await bareMf.dispatchFetch(`${BASE_URL}/api/status`);
    assert.equal(bareRes.status, 200);
    const bareBody = await bareRes.json();
    assert.equal(bareBody.integrations.omnidev_studio, 'unconfigured');
  } finally {
    await bareMf.dispose();
  }
});

test('SEPA Invoice Security: Escapes HTML XSS payloads, requires configured IBAN, and uses dynamic UTC year', async () => {
  await assert.rejects(
    generateInvoiceWithSepaQr({}, 'admin', {
      client_name: 'Acme Corp',
      amount_eur: 100,
      item_description: 'Consulting'
    }),
    /SEPA IBAN is required/i
  );

  const inv = await generateInvoiceWithSepaQr(
    { SEPA_IBAN: 'SK3112000000198742637541', SEPA_BIC: 'TATRSKBX' },
    'admin',
    {
      client_name: '<script>alert("xss")</script> & "Evil"',
      client_email: 'user@example.com',
      amount_eur: 150,
      item_description: '<img src=x onerror=alert(1)> Service'
    }
  );

  assert.equal(inv.success, true);
  assert.ok(inv.invoice_number.startsWith(String(new Date().getUTCFullYear())));
  assert.doesNotMatch(inv.html_invoice, /SK3111000000002949000000/);
  assert.doesNotMatch(inv.html_invoice, /<script>alert/);
  assert.doesNotMatch(inv.html_invoice, /<img src=x onerror=/);
  assert.match(inv.html_invoice, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
  assert.match(inv.html_invoice, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
