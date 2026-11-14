import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hashPassword, verifyPassword } from '../src/user-auth.js';

let mf, db;
const key = 'test-ops-key-credential-auth-12345';
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
            CF_VERSION_METADATA: { id: 'test-user-auth', tag: 'test', timestamp: '2026-11-14T00:00:00.000Z' },
            TRINITY_OPS_KEY: key,
            TRINITY_OWNER_EMAIL: 'saboivan2008@gmail.com',
            TRINITY_GATEWAY_KEY: 'test-gateway-key-12345678901234567',
            TRINITY_VAULT_KEY: Buffer.alloc(32, 8).toString('base64url'),
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
              async run() { return { response: 'MOCK_OK' }; }
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

test('PBKDF2 password hashing & constant-time verification', async () => {
  const { hashHex, saltHex } = await hashPassword('Secret1234');
  assert.equal(typeof hashHex, 'string');
  assert.equal(hashHex.length, 64);
  assert.equal(saltHex.length, 32);

  const ok = await verifyPassword('Secret1234', hashHex, saltHex);
  assert.equal(ok, true);

  const fail = await verifyPassword('WrongPassword1', hashHex, saltHex);
  assert.equal(fail, false);
});

test('User registration with credentials provisions user and sets session cookie', async () => {
  const res = await req('/api/auth/register', {
    email: 'newuser@auru.space',
    password: 'Password123!',
    display_name: 'New Trinity Member'
  }, false);

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.email, 'newuser@auru.space');
  assert.equal(data.user.display_name, 'New Trinity Member');
  assert.equal(data.user.role, 'user');
  assert.equal(data.user.status, 'active');

  const cookieHeader = res.headers.get('set-cookie');
  assert.ok(cookieHeader && cookieHeader.includes('trinity_session='));

  // Duplicate registration fails with 409
  const dupRes = await req('/api/auth/register', {
    email: 'newuser@auru.space',
    password: 'Password123!'
  }, false);
  assert.equal(dupRes.status, 409);
});

test('User login with valid credentials issues session and returns profile', async () => {
  const res = await req('/api/auth/login', {
    email: 'newuser@auru.space',
    password: 'Password123!'
  }, false);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.email, 'newuser@auru.space');

  const cookie = res.headers.get('set-cookie')?.match(/trinity_session=([a-f0-9]+)/)?.[0];
  assert.ok(cookie);

  // Authenticated route /api/auth/me returns the profile
  const meRes = await mf.dispatchFetch(baseUrl + '/api/auth/me', {
    headers: { Cookie: cookie }
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.user.email, 'newuser@auru.space');
  assert.equal(meData.user.display_name, 'New Trinity Member');

  // Updating profile
  const updateRes = await mf.dispatchFetch(baseUrl + '/api/auth/profile', {
    method: 'PATCH',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      Origin: baseUrl
    },
    body: JSON.stringify({ display_name: 'Alex Developer' })
  });
  assert.equal(updateRes.status, 200);
  const updatedData = await updateRes.json();
  assert.equal(updatedData.user.display_name, 'Alex Developer');

  // Login with invalid password fails with 401
  const badLogin = await req('/api/auth/login', {
    email: 'newuser@auru.space',
    password: 'WrongPassword999'
  }, false);
  assert.equal(badLogin.status, 401);
});

test('Owner email registered via credentials receives owner role', async () => {
  const res = await req('/api/auth/register', {
    email: 'saboivan2008@gmail.com',
    password: 'OwnerPassword2026!',
    display_name: 'Basterix Sovereign'
  }, false);

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.email, 'saboivan2008@gmail.com');
  assert.equal(data.user.role, 'owner');
  assert.equal(data.user.is_owner, true);
});
