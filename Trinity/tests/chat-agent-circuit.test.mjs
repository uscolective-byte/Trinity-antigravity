import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatAgent } from '../src/chat-agent.js';

test('ChatAgent actually skips a failed primary after three failures and can use fallback', async () => {
  const state = new Map();
  const storage = {
    async get(key) { return state.get(key); },
    async put(key, value) { state.set(key, value); }
  };
  const calls = [];
  const agent = new ChatAgent({ storage }, {
    AI: {
      async run(model) {
        calls.push(model);
        if (model.includes('70b')) throw new Error('provider unavailable');
        return { response: 'Real fallback model response' };
      }
    }
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    await assert.rejects(
      agent._runModelGuarded('edge-llama-70b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', [], 100),
      /MODEL_(PROVIDER_ERROR|CIRCUIT_OPEN)/
    );
  }
  assert.equal(calls.length, 3, 'fourth primary attempt must be skipped');
  assert.equal(state.get('circuit:v1:edge-llama-70b').status, 'open');
  const fallback = await agent._runModelGuarded('edge-llama-8b', '@cf/meta/llama-3.1-8b-instruct-fast', [], 100);
  assert.equal(fallback.response, 'Real fallback model response');
  assert.equal(calls.length, 4);
});
