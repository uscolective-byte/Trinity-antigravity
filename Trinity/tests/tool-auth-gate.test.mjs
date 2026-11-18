import test from 'node:test';
import assert from 'node:assert/strict';
import { executeToolCalls } from '../src/trinity-tools/tool-calling-engine.js';

const llmCall = ['```json', JSON.stringify({ tool_calls: [{ name: 'kv_put', arguments: { key: 'important', value: 'changed' } }] }), '```'].join('\n');

test('spoofed owner id without verified principal cannot call a mutating tool', async () => {
  let writes = 0;
  const env = { TRINITY_KV: { async put() { writes++; } } };
  const unauthorized = await executeToolCalls(llmCall, env, {
    userId: 'basterix', sessionId: 's1', authenticated: false, role: 'owner'
  });
  assert.equal(unauthorized.hasToolCalls, true);
  assert.equal(unauthorized.results[0].status, 'DENIED');
  assert.equal(unauthorized.results[0].executed, false);
  const ordinaryUser = await executeToolCalls(llmCall, env, {
    userId: 'someone', sessionId: 's2', authenticated: true, role: 'user'
  });
  assert.equal(ordinaryUser.results[0].status, 'DENIED');
  assert.equal(writes, 0);
});

test('server-verified owner may invoke typed tool', async () => {
  let writes = 0;
  const env = { TRINITY_KV: { async put(key, value) {
    writes++;
    assert.equal(key, 'important');
    assert.equal(value, 'changed');
  } } };
  const result = await executeToolCalls(llmCall, env, {
    userId: 'verified-id', sessionId: 'session-1', authenticated: true, role: 'owner'
  });
  assert.equal(writes, 1);
  assert.equal(result.hasToolCalls, true);
  assert.equal(result.results[0].status, 'SUCCESS');
});
