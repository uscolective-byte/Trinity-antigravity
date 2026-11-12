import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { inspectPromptAbuse, inspectEscrowInquirySpam, POLICY_VERSION } from '../src/compliance-shield.js';
import { renderLandingHtml } from '../src/landing-page.js';

let mf, db;
const key = 'test-only-not-a-real-secret-123456789';
const baseUrl = 'https://trinity.test';

async function req(path, body, auth = true, extra = {}) {
  return mf.dispatchFetch(baseUrl + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(auth ? { Authorization: 'Bearer ' + key } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...extra
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

before(async () => {
  const modules = readdirSync('dist')
    .filter((x) => !x.endsWith('.map') && !x.endsWith('.md'))
    .map((name) => ({ type: name === 'index.js' ? 'ESModule' : 'Text', path: resolve('dist', name) }));
  modules.sort((a, b) => (a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0));

  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'trinity',
          modules,
          compatibilityDate: '2026-10-01',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            CF_VERSION_METADATA: { id: 'test-compliance', tag: 'test', timestamp: '2026-11-12T00:00:00.000Z' },
            TRINITY_OPS_KEY: key,
            TRINITY_GATEWAY_KEY: 'test-only-gateway-secret-123456789012345',
            TRINITY_VAULT_KEY: Buffer.alloc(32, 7).toString('base64url'),
            AI_FAST_FALLBACK_MODEL: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
          },
          kvNamespaces: { Mastermind: 'test-kv' },
          d1Databases: { DB: 'test-db' },
          r2Buckets: { ARTIFACTS: 'test-r2' },
          serviceBindings: { AI: { name: 'mock', entrypoint: 'MockAI' } },
          workflows: { OPS_WORKFLOW: { name: 'test-workflow', className: 'TrinityOperations' } }
        },
        {
          name: 'mock',
          modules: true,
          compatibilityDate: '2026-10-01',
          script: `import { WorkerEntrypoint } from 'cloudflare:workers';
            export class MockAI extends WorkerEntrypoint {
              async run() { return { response: 'CLEAN_AI_RESPONSE' }; }
            }
            export default { fetch() { return new Response('ok'); } };`
        }
      ]
    })
  );

  db = await mf.getD1Database('DB', 'trinity');
  await db.batch([
    db.prepare('CREATE TABLE audit_log(id INTEGER PRIMARY KEY,module TEXT NOT NULL,action TEXT NOT NULL,details TEXT)'),
    db.prepare('CREATE TABLE memory(id TEXT PRIMARY KEY,content TEXT)'),
    db.prepare('CREATE TABLE knowledge(id INTEGER PRIMARY KEY,topic TEXT,content TEXT)'),
    db.prepare('CREATE TABLE personality(id INTEGER PRIMARY KEY,trait TEXT,value TEXT)'),
    db.prepare('CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT,content TEXT)'),
    db.prepare('CREATE TABLE memory_long(key TEXT,value TEXT,category TEXT,importance INTEGER)'),
    db.prepare('CREATE TABLE projects(id TEXT,name TEXT,description TEXT,status TEXT,updated_at TEXT)'),
    db.prepare('CREATE TABLE tasks(id TEXT,title TEXT,status TEXT,assigned_agent TEXT,updated_at TEXT)')
  ]);

  for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync('migrations/' + file, 'utf8');
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean);
    if (file === '0048_trinity_sovereign_ai_os.sql') {
      for (const stmt of statements) await db.prepare(stmt).run();
    } else {
      await db.batch(statements.map((s) => db.prepare(s)));
    }
  }
});

after(async () => {
  await mf?.dispose();
});

test('inspectPromptAbuse and inspectEscrowInquirySpam catch token floods, url spam and honeypots', () => {
  assert.equal(inspectPromptAbuse('Priprav čistý návrh webu pre klienta.').ok, true);
  assert.equal(inspectPromptAbuse('x'.repeat(17000)).ok, false);
  assert.equal(inspectPromptAbuse('SPAM_BLOCK_12345'.repeat(12)).flags.includes('repetition_flood'), true);
  assert.equal(inspectPromptAbuse('a'.repeat(200)).flags.includes('char_flood'), true);

  const manyUrls = Array.from({ length: 12 }, (_, i) => `https://spam${i}.example/win`).join(' ');
  assert.equal(inspectPromptAbuse(manyUrls).flags.includes('url_spam'), true);

  assert.equal(inspectEscrowInquirySpam({ domain_name: 'auru.space', website: 'https://bot.evil', buyer_notes: 'test' }).ok, false);
  assert.equal(
    inspectEscrowInquirySpam({
      domain_name: 'auru.space',
      buyer_notes: 'Pozri https://a.test https://b.test https://c.test'
    }).ok,
    false
  );
  assert.equal(
    inspectEscrowInquirySpam({
      domain_name: 'auru.space',
      buyer_email: 'buyer@example.com',
      offer_amount_eur: 1500,
      buyer_notes: 'Seriózny záujem o doménu.'
    }).ok,
    true
  );
});

test('public legal HTML routes and policies API respond cleanly with strict CSP hygiene', async () => {
  for (const path of ['/legal', '/terms', '/aup', '/privacy', '/license', '/security-policy']) {
    const res = await req(path, undefined, false);
    assert.equal(res.status, 200, `${path} status`);
    const html = await res.text();
    assert.ok(html.includes('Trinity'), `${path} mentions Trinity`);
    assert.equal(/<script\b/i.test(html), false, `${path} has no inline script`);
  }

  const jsonRes = await req('/api/legal/policies', undefined, false);
  assert.equal(jsonRes.status, 200);
  const payload = await jsonRes.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.policy_version, POLICY_VERSION);
  assert.ok(Array.isArray(payload.license_tiers) && payload.license_tiers.length >= 3);
  assert.ok(payload.policies.some((p) => p.id === 'aup'));
});

test('anti-spam shield blocks escrow honeypots, prompt floods and duplicate spam bursts with rate limit headers', async () => {
  const botRes = await req(
    '/api/domains/escrow/inquire',
    {
      domain_name: 'auru.space',
      buyer_email: 'spam@example.com',
      offer_amount_eur: 500,
      website: 'https://spam-bot.invalid'
    },
    false,
    { 'CF-Connecting-IP': '198.51.100.20' }
  );
  assert.equal(botRes.status, 400);

  const okChat = await req('/api/chat', { message: 'Vytvor krátky prehľad architektúry Trinity.' }, true, {
    'CF-Connecting-IP': '198.51.100.21'
  });
  assert.equal(okChat.status, 200);
  assert.ok(okChat.headers.get('X-RateLimit-Limit'));
  assert.equal(okChat.headers.get('X-Trinity-Policy-Version'), POLICY_VERSION);

  const floodRes = await req('/api/chat', { message: 'REPEAT_SPAM_PAYLOAD_'.repeat(14) }, true, {
    'CF-Connecting-IP': '198.51.100.22'
  });
  assert.equal(floodRes.status, 400);

  // 4 identické správy po sebe spustia duplicate-flood ban (HTTP 429)
  let blockedDup = false;
  for (let i = 0; i < 6; i++) {
    const r = await req('/api/chat', { message: 'Identický spamový test prompt číslo jeden' }, true, {
      'CF-Connecting-IP': '198.51.100.23'
    });
    if (r.status === 429) {
      blockedDup = true;
      break;
    }
  }
  assert.equal(blockedDup, true);
});

test('commercial license grants, revocation, policy acceptance and shield status work against D1', async () => {
  const issueRes = await req('/api/legal/license/issue', {
    subject_id: 'client@acme.sk',
    tier: 'pro_studio',
    expires_days: 90
  });
  assert.equal(issueRes.status, 201);
  const issued = await issueRes.json();
  assert.equal(issued.ok, true);
  assert.ok(issued.grant.license_key.startsWith('trn_lic_'));

  const licLookup = await req('/api/legal/license', undefined, true, {
    'X-Trinity-License': issued.grant.license_key
  });
  assert.equal(licLookup.status, 200);
  const licData = await licLookup.json();
  assert.equal(licData.active_license.tier, 'pro_studio');
  assert.equal(licData.active_license.max_rpm, 60);

  const acceptRes = await req('/api/legal/accept', { documents: ['terms', 'aup', 'privacy', 'license'] });
  assert.equal(acceptRes.status, 200);
  const acc = await acceptRes.json();
  assert.equal(acc.ok, true);
  assert.equal(acc.policy_version, POLICY_VERSION);

  const revokeRes = await req('/api/legal/license/revoke', { id: issued.grant.id });
  assert.equal(revokeRes.status, 200);
  assert.equal((await revokeRes.json()).grant.status, 'revoked');

  const shieldRes = await req('/api/security/shield-status');
  assert.equal(shieldRes.status, 200);
  const shield = await shieldRes.json();
  assert.equal(shield.shield_active, true);
  assert.ok(shield.policy_acceptances_count >= 1);
  assert.ok(shield.incidents_recent.length >= 1);
});

test('UI workspace and landing page expose redesigned Studio controls and legal links without inline JS', () => {
  const chatHtml = readFileSync('public/assistant/chat.html', 'utf8');
  assert.ok(chatHtml.includes('id="command-palette-dialog"'));
  assert.ok(chatHtml.includes('id="legal-dialog"'));
  assert.ok(chatHtml.includes('id="settings-governance-panel"'));
  assert.ok(chatHtml.includes('id="cmdk-trigger"'));
  assert.equal(/\sonclick\s*=|<script(?![^>]*\bsrc=)[^>]*>/i.test(chatHtml), false);

  const landingHtml = renderLandingHtml({ host: 'auru.space', version: '13.0.0' });
  assert.ok(landingHtml.includes('/terms'));
  assert.ok(landingHtml.includes('/aup'));
  assert.ok(landingHtml.includes('/license'));
  assert.equal(/<script\b/i.test(landingHtml), false);
});
