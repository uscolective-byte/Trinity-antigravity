import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CircuitBreaker,
  CIRCUIT_STATES,
  fetchWithTimeout,
  createReceiptId,
  routePentadTask
} from '../src/circuit-breaker-router.js';

test('CircuitBreaker: State transitions and failure threshold', () => {
  const breaker = new CircuitBreaker('test-service', {
    failureThreshold: 2,
    resetTimeoutMs: 100
  });

  assert.equal(breaker.state, CIRCUIT_STATES.CLOSED);
  assert.equal(breaker.isOpen(), false);

  // First failure
  breaker.recordFailure();
  assert.equal(breaker.state, CIRCUIT_STATES.CLOSED);
  assert.equal(breaker.isOpen(), false);

  // Second failure -> Trips to OPEN
  breaker.recordFailure();
  assert.equal(breaker.state, CIRCUIT_STATES.OPEN);
  assert.equal(breaker.isOpen(), true);

  // After cooldown timeout -> transitions to HALF_OPEN
  breaker.lastFailureTime = Date.now() - 150;
  assert.equal(breaker.isOpen(), false);
  assert.equal(breaker.state, CIRCUIT_STATES.HALF_OPEN);

  // Success in HALF_OPEN resets to CLOSED
  breaker.recordSuccess();
  assert.equal(breaker.state, CIRCUIT_STATES.CLOSED);
  assert.equal(breaker.failureCount, 0);
});

test('createReceiptId: Generates valid sovereign receipt ID', () => {
  const id = createReceiptId('PNT');
  assert.match(id, /^PNT-RCPT-[A-Z0-9]+-[A-Z0-9]+$/);
});

test('routePentadTask: Edge execution returns receipt_id and 0 external tokens', async () => {
  const mockEnv = {
    AI: {
      run: async (model, params) => {
        return { response: 'Test Edge Response from Llama' };
      }
    },
    Mastermind: {
      put: async (key, val) => {}
    }
  };

  const res = await routePentadTask({
    prompt: 'Hello Trinity',
    preferredNode: 'edge',
    env: mockEnv
  });

  assert.equal(res.text, 'Test Edge Response from Llama');
  assert.equal(res.fallback_used, false);
  assert.match(res.receipt_id, /^PNT-RCPT-/);
  assert.equal(res.deed, 'TRINITY-DEED-20261025-001');
});

test('routePentadTask: Copilot failure gracefully falls back to Edge AI', async () => {
  const mockEnv = {
    COPILOT_STUDIO_SECRET: 'mock-secret',
    DIRECTLINE_URL: 'https://invalid-nonexistent-copilot-url.local',
    AI: {
      run: async (model, params) => {
        return { response: 'Fallback Edge AI Response' };
      }
    },
    Mastermind: {
      put: async (key, val) => {}
    }
  };

  const res = await routePentadTask({
    prompt: 'Query Copilot',
    preferredNode: 'copilot',
    env: mockEnv
  });

  assert.equal(res.text, 'Fallback Edge AI Response');
  assert.equal(res.fallback_used, true);
  assert.match(res.receipt_id, /^PNT-RCPT-/);
});
