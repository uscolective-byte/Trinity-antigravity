import test from 'node:test';
import assert from 'node:assert/strict';
import { SovereignLedgerEngine } from '../src/sovereign-ledger-mmr.js';
import {
  shouldAuditRequest,
  resolveLedgerDatabase,
  extractActorFromRequest,
  recordRequestAudit,
  handleAuditLedgerRoutes
} from '../src/ledger-middleware.js';

function createMockDb() {
  const rows = [];
  return {
    rows,
    prepare(query) {
      let boundArgs = [];
      return {
        bind(...args) {
          boundArgs = args;
          return this;
        },
        async run() {
          if (query.includes('INSERT INTO trinity_sovereign_ledger_v3')) {
            rows.push({
              block_id: boundArgs[0],
              timestamp: boundArgs[1],
              actor: boundArgs[2],
              operation: boundArgs[3],
              previous_hash: boundArgs[4],
              current_hash: boundArgs[5],
              payload: boundArgs[6]
            });
            return { success: true };
          }
          return { success: true };
        },
        async first() {
          if (query.includes('ORDER BY block_id DESC LIMIT 1')) {
            return rows.length > 0 ? rows[rows.length - 1] : null;
          }
          return null;
        },
        async all() {
          if (query.includes('ORDER BY block_id DESC')) {
            const limit = boundArgs[0] || 50;
            return { results: [...rows].reverse().slice(0, limit) };
          }
          if (query.includes('ORDER BY block_id ASC')) {
            const limit = boundArgs[0] || 1000;
            return { results: [...rows].slice(0, limit) };
          }
          return { results: [] };
        }
      };
    }
  };
}

test('shouldAuditRequest: correctly identifies audited paths and excludes GET/HEAD/audit-ledger', () => {
  assert.equal(shouldAuditRequest('/api/system/actions', 'POST'), true);
  assert.equal(shouldAuditRequest('/api/assistant/evolution/run', 'POST'), true);
  assert.equal(shouldAuditRequest('/api/mcp/invoke', 'POST'), true);
  assert.equal(shouldAuditRequest('/api/assistant/wallet/terminal/charge', 'POST'), true);

  // Excluded paths
  assert.equal(shouldAuditRequest('/api/audit-ledger', 'GET'), false);
  assert.equal(shouldAuditRequest('/api/audit-ledger/verify', 'GET'), false);
  assert.equal(shouldAuditRequest('/api/system/actions', 'OPTIONS'), false);
  assert.equal(shouldAuditRequest('/api/system/actions', 'HEAD'), false);
  assert.equal(shouldAuditRequest('/api/random/untracked', 'POST'), false);
});

test('extractActorFromRequest: extracts actor from headers or falls back gracefully', () => {
  const reqWithActor = new Request('https://test.local', {
    headers: { 'X-Trinity-Actor': 'operator-42' }
  });
  assert.equal(extractActorFromRequest(reqWithActor), 'operator-42');

  const reqWithAuth = new Request('https://test.local', {
    headers: { 'Authorization': 'Bearer token-xyz' }
  });
  assert.equal(extractActorFromRequest(reqWithAuth), 'authenticated_operator');

  const reqFallback = new Request('https://test.local');
  assert.equal(extractActorFromRequest(reqFallback), 'basterix_edge_gateway');
});

test('SovereignLedgerEngine: Appends cryptographic blocks, verifies integrity and detects tampering', async () => {
  const mockDb = createMockDb();
  const engine = new SovereignLedgerEngine({}, mockDb);

  const block1 = await engine.appendRecord({
    actor: 'basterix',
    operation: 'SYS_INIT',
    payload: { state: 'genesis' }
  });

  assert.equal(block1.blockId, 1);
  assert.equal(block1.previousHash, '0000000000000000000000000000000000000000000000000000000000000000');
  assert.match(block1.currentHash, /^[0-9a-f]{64}$/);

  const block2 = await engine.appendRecord({
    actor: 'admin',
    operation: 'MUTATION_A',
    payload: { value: 100 }
  });

  assert.equal(block2.blockId, 2);
  assert.equal(block2.previousHash, block1.currentHash);

  const verification = await engine.verifyChainIntegrity();
  assert.equal(verification.valid, true);
  assert.equal(verification.chainLength, 2);
  assert.equal(verification.headHash, block2.currentHash);

  // Tamper test
  mockDb.rows[1].current_hash = 'badbeef'.repeat(9) + 'bad';
  const failedVerification = await engine.verifyChainIntegrity();
  assert.equal(failedVerification.valid, false);
  assert.match(failedVerification.error, /Neplatný kontrolný súčet bloku/);
});

test('handleAuditLedgerRoutes: Handles GET verify, GET list, and POST append', async () => {
  const mockDb = createMockDb();
  const env = { DB: mockDb };

  // 1. Append record via POST
  const appendReq = new Request('https://test.local/api/audit-ledger/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'tester',
      operation: 'UNIT_TEST_OP',
      payload: { hello: 'ledger' }
    })
  });
  const appendRes = await handleAuditLedgerRoutes(appendReq, env, new URL(appendReq.url));
  assert.equal(appendRes.status, 201);
  const appendData = await appendRes.json();
  assert.equal(appendData.success, true);
  assert.equal(appendData.record.blockId, 1);

  // 2. Query list via GET
  const listReq = new Request('https://test.local/api/audit-ledger?limit=10', { method: 'GET' });
  const listRes = await handleAuditLedgerRoutes(listReq, env, new URL(listReq.url));
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.equal(listData.count, 1);
  assert.equal(listData.blocks[0].operation, 'UNIT_TEST_OP');

  // 3. Verify integrity via GET
  const verifyReq = new Request('https://test.local/api/audit-ledger/verify', { method: 'GET' });
  const verifyRes = await handleAuditLedgerRoutes(verifyReq, env, new URL(verifyReq.url));
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.success, true);
  assert.equal(verifyData.verification.valid, true);
});

test('recordRequestAudit: Safely handles missing DB without crashing', async () => {
  const req = new Request('https://test.local/api/system/actions', { method: 'POST' });
  const res = new Response('ok', { status: 200 });

  const result = await recordRequestAudit({
    request: req,
    response: res,
    env: {}, // no DB
    ctx: null,
    pathname: '/api/system/actions',
    method: 'POST',
    durationMs: 42
  });

  assert.equal(result, null);
});
