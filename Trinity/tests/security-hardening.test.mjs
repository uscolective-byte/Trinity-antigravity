import test from 'node:test';
import assert from 'node:assert/strict';
import { TrinityAuthBypass } from '../../core/authBypass.mjs';
import { executeLocalBridgeCommand } from '../../trinity-pc-bridge/bridge-core.mjs';
import { D1 } from '../src/lib/d1.js';

test('admin authorization fails closed without a configured secret', () => {
  const auth = new TrinityAuthBypass({ masterKey: '' });
  assert.equal(auth.verifyAuth({ authorization: 'Bearer anything' }).authorized, false);
  assert.equal(auth.bypassActive, false);
});

test('legacy bypass flag cannot grant admin access', () => {
  const original = process.env.BYPASS_EXTERNAL_KEYS;
  try {
    process.env.BYPASS_EXTERNAL_KEYS = 'true';
    const auth = new TrinityAuthBypass({ masterKey: 'known-test-secret' });
    assert.equal(auth.verifyAuth({}).authorized, false);
    assert.equal(auth.verifyAuth({ authorization: 'Bearer wrong' }).authorized, false);
    assert.equal(auth.verifyAuth({ authorization: 'Bearer known-test-secret' }).authorized, true);
    assert.equal(auth.verifyAuth({ 'X-API-KEY': 'known-test-secret' }).authorized, true);
    assert.equal(auth.generateReceipt('agent', {}, {}).verified, false);
  } finally {
    if (original === undefined) delete process.env.BYPASS_EXTERNAL_KEYS;
    else process.env.BYPASS_EXTERNAL_KEYS = original;
  }
});

test('PC bridge refuses arbitrary shell and unapproved side effects', async () => {
  const shell = await executeLocalBridgeCommand('Remove-Item -Recurse C:/');
  assert.equal(shell.success, false);
  assert.equal(shell.error, 'ARBITRARY_SHELL_DISABLED');
  const attempted = await executeLocalBridgeCommand({ action: 'run_command', target: 'dir' });
  assert.equal(attempted.success, false);
  assert.equal(attempted.error, 'ACTION_NOT_ALLOWED');
  const ping = await executeLocalBridgeCommand({ action: 'ping' });
  assert.equal(ping.success, true);
  assert.match(ping.output, /no PC action executed/);
});

test('tool success receipts require actual execution metadata', async () => {
  const calls = [];
  const db = new D1({
    prepare(sql) {
      return { bind(...params) { calls.push({ sql, params }); return this; } };
    },
    async batch(statements) { assert.equal(statements.length, 2); }
  });
  await assert.rejects(() => db.recordToolSuccess('sample', 1), /EXECUTION_EVIDENCE_REQUIRED/);
  const recorded = await db.recordToolSuccess('sample', 2, {
    runId: 'run-one',
    receiptId: 'receipt-one',
    step: 1,
    input: { data: 'input' },
    output: { success: true, result: 'actual response' }
  });
  assert.equal(recorded, true);
  assert.ok(calls.some(call => call.params.includes('receipt-one')));
  assert.ok(calls.some(call => call.params.some(param => String(param).includes('actual response'))));
});

test('tool success does not survive a database write failure', async () => {
  const db = new D1({
    prepare() { return { bind() { return this; } }; },
    async batch() { throw new Error('D1 unavailable'); }
  });
  await assert.rejects(() => db.recordToolSuccess('sample', 1, {
    runId: 'run-one', receiptId: 'receipt-one', step: 0, input: {}, output: {}
  }), /D1 unavailable/);
});
