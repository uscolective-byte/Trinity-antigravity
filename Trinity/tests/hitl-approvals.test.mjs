import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createHitlApproval, getHitlApproval } from '../src/hitl-approvals.js';
import { handleTelegramWebhook } from '../src/telegram-bridge.js';
import { runTool } from '../src/tools.js';

let mf, db;
const key = 'test-only-hitl-ops-secret-1234567890';
const vaultKey = Buffer.alloc(32, 9).toString('base64url');
const baseUrl = 'https://trinity.test';

async function req(path, body, auth = true, extra = {}) {
  return mf.dispatchFetch(baseUrl + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(auth ? { Authorization: 'Bearer ' + key } : {}),
      ...(body === undefined || typeof body === 'string' ? {} : { 'Content-Type': 'application/json' }),
      ...extra
    },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
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
            CF_VERSION_METADATA: { id: 'test-hitl', tag: 'test', timestamp: '2026-11-12T00:00:00.000Z' },
            TRINITY_OPS_KEY: key,
            TRINITY_OWNER_EMAIL: 'saboivan2008@gmail.com',
            TRINITY_GATEWAY_KEY: 'test-only-gateway-secret-123456789012345',
            TRINITY_VAULT_KEY: vaultKey,
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
              async run() { return { response: 'HITL_MOCK_OK' }; }
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

test('Creating HITL approval sends Telegram inline keyboard and Resend email, then callback_query approves & executes real key + vault', async () => {
  const tgCalls = [];
  const emailCalls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    const body = options?.body ? JSON.parse(options.body) : {};
    if (target.includes('api.telegram.org')) {
      tgCalls.push({ endpoint: target.split('/').pop(), body });
      return Response.json({ ok: true, result: { message_id: 901 } });
    }
    if (target.includes('api.resend.com')) {
      emailCalls.push({ url: target, body });
      return Response.json({ id: 're_test_123' }, { status: 200 });
    }
    throw new Error('Unexpected fetch: ' + target);
  };

  try {
    const env = {
      DB: db,
      TRINITY_VAULT_KEY: vaultKey,
      TRINITY_OWNER_EMAIL: 'saboivan2008@gmail.com',
      TELEGRAM_BOT_TOKEN: 'tg-test-bot-token',
      TELEGRAM_WEBHOOK_SECRET: 'tg-webhook-secret-123456',
      TELEGRAM_ALLOWED_USER_IDS: '987654321',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'Trinity <noreply@auru.space>'
    };

    const created = await createHitlApproval(env, {
      requestUrl: 'https://auru.space/api/hitl/request',
      requestedBy: 'agent:trinity',
      input: {
        action_type: 'provision_trinity_api_key',
        title: 'Vygenerovať produkčný Trinity API kľúč',
        rationale: 'Prepojenie mobilného klienta cez schválený API kľúč.',
        payload: { name: 'Mobile Client HITL', scopes: ['api:invoke'] }
      }
    });

    assert.equal(created.approval.status, 'pending');
    assert.equal(created.approve_url, `https://auru.space/approve/${created.approval.id}`);
    assert.equal(created.channels.telegram.sent, true);
    assert.equal(created.channels.email.sent, true);

    const sendCall = tgCalls.find((c) => c.endpoint === 'sendMessage');
    assert.ok(sendCall);
    const buttons = sendCall.body.reply_markup.inline_keyboard.flat();
    assert.ok(buttons.some((b) => b.callback_data === `hitl:approve:${created.approval.id}`));
    assert.ok(buttons.some((b) => b.callback_data === `hitl:reject:${created.approval.id}`));
    assert.ok(buttons.some((b) => b.url === `https://auru.space/approve/${created.approval.id}`));

    assert.equal(emailCalls.length, 1);
    assert.equal(emailCalls[0].body.to[0], 'saboivan2008@gmail.com');
    assert.ok(emailCalls[0].body.html.includes(`/approve/${created.approval.id}`));

    const pendingPromises = [];
    const ctx = { waitUntil: (p) => pendingPromises.push(p) };
    const webhookRes = await handleTelegramWebhook(
      new Request('https://auru.space/api/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
        },
        body: JSON.stringify({
          update_id: 777001,
          callback_query: {
            id: 'cbq_123',
            from: { id: 987654321, username: 'saboivan' },
            message: { message_id: 901, chat: { id: 987654321, type: 'private' } },
            data: `hitl:approve:${created.approval.id}`
          }
        })
      }),
      env,
      ctx
    );
    assert.equal(webhookRes.status, 200);
    await Promise.all(pendingPromises);

    const finished = await getHitlApproval(env, created.approval.id);
    assert.equal(finished.status, 'executed');
    assert.equal(finished.decision_channel, 'telegram');
    assert.equal(finished.result.executed, true);
    assert.ok(finished.result.key_id);
    assert.ok(finished.result.vault_secret_id);

    const keyRow = await db.prepare('SELECT id, name FROM ops_api_access_keys WHERE id=?').bind(finished.result.key_id).first();
    assert.equal(keyRow?.name, 'Mobile Client HITL');

    const vaultRow = await db.prepare('SELECT id, provider, secret_ciphertext FROM ops_secret_vault WHERE id=?').bind(finished.result.vault_secret_id).first();
    assert.equal(vaultRow?.provider, 'custom');
    assert.ok(vaultRow?.secret_ciphertext);

    assert.ok(tgCalls.some((c) => c.endpoint === 'answerCallbackQuery' && c.body.callback_query_id === 'cbq_123'));
    assert.ok(tgCalls.some((c) => c.endpoint === 'editMessageText' && c.body.text.includes('SCHVÁLENÉ & VYKONANÉ')));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('GET /approve/:id and POST /api/approve/:id enforce owner auth and single-use execution (409 on replay)', async () => {
  const createRes = await req('/api/hitl/request', {
    action_type: 'issue_license',
    title: 'Vydať Pro Studio licenciu pre klienta',
    rationale: 'Komerčný onboarding po úhrade.',
    payload: { subject_id: 'partner@auru.space', tier: 'pro_studio', expires_days: 90 }
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  const id = created.approval.id;

  const anonGet = await req(`/approve/${id}`, undefined, false);
  assert.equal(anonGet.status, 200);
  const anonHtml = await anonGet.text();
  assert.ok(anonHtml.includes('Vyžaduje sa prihlásenie vlastníka'));
  assert.ok(!anonHtml.includes('partner@auru.space'));

  const ownerGet = await req(`/approve/${id}`, undefined, true);
  assert.equal(ownerGet.status, 200);
  const ownerHtml = await ownerGet.text();
  assert.ok(ownerHtml.includes('Vydať Pro Studio licenciu pre klienta'));
  assert.ok(ownerHtml.includes('/api/approve/' + id));

  const anonPost = await req(`/api/approve/${id}`, { decision: 'approve' }, false);
  assert.equal(anonPost.status, 401);

  const firstApprove = await req(`/api/approve/${id}`, { decision: 'approve' }, true);
  assert.equal(firstApprove.status, 200);
  const firstBody = await firstApprove.json();
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.item.status, 'executed');
  assert.equal(firstBody.item.result.tier, 'pro_studio');

  const replayApprove = await req(`/api/approve/${id}`, { decision: 'approve' }, true);
  assert.equal(replayApprove.status, 409);

  // Also test HTML form reject flow
  const rejectReq = await req('/api/hitl/request', {
    action_type: 'custom_operation',
    title: 'Test zamietnutia cez HTML formulár',
    rationale: 'Overenie form POST.',
    payload: {}
  });
  const rejectId = (await rejectReq.json()).approval.id;
  const formRes = await req(
    `/api/approve/${rejectId}`,
    'decision=reject',
    true,
    { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' }
  );
  assert.equal(formRes.status, 200);
  const formHtml = await formRes.text();
  assert.ok(formHtml.includes('Zamietnuté vlastníkom'));
});

test('provision_openai_project_key without OPENAI_ADMIN_KEY transitions honestly to failed (502) and never fakes success', async () => {
  const createRes = await req('/api/hitl/request', {
    action_type: 'provision_openai_project_key',
    title: 'Vygenerovať OpenAI projektový kľúč ($20)',
    rationale: 'Test pravdivej politiky pri chýbajúcom OPENAI_ADMIN_KEY.',
    payload: { project_id: 'proj_test_123', name: 'Trinity Budget $20' }
  });
  assert.equal(createRes.status, 201);
  const id = (await createRes.json()).approval.id;

  const approveRes = await req(`/api/approve/${id}`, { decision: 'approve' }, true);
  assert.equal(approveRes.status, 502);
  const body = await approveRes.json();
  assert.equal(body.ok, false);
  assert.equal(body.item.status, 'failed');
  assert.ok(String(body.item.error_message || '').includes('OPENAI_ADMIN_KEY'));
});

test('AI tool request_owner_approval creates pending D1 record and returns truthful proposal receipt', async () => {
  const env = {
    DB: db,
    TRINITY_BASE_URL: 'https://auru.space',
    TRINITY_OWNER_EMAIL: 'saboivan2008@gmail.com'
  };
  const result = await runTool(
    env,
    { id: 'trinity-core' },
    'request_owner_approval',
    {
      action_type: 'custom_operation',
      title: 'Schváliť nasadenie integračného modulu',
      rationale: 'Agent potrebuje autorizáciu vlastníka pred zmenou konfigurácie.',
      payload: { target: 'webhook-sync' },
      ttl_minutes: 15
    }
  );
  assert.equal(result.status, 'pending');
  assert.equal(result.approve_url, `https://auru.space/approve/${result.id}`);
  assert.equal(result._evidence?.effect, 'proposal');

  const stored = await db.prepare('SELECT id, title, status, requested_by FROM ops_hitl_approvals WHERE id=?').bind(result.id).first();
  assert.equal(stored?.status, 'pending');
  assert.equal(stored?.requested_by, 'agent:trinity-core');
});
