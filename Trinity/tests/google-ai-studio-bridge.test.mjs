/**
 * @module Trinity/tests/google-ai-studio-bridge.test.mjs
 * @description Deterministic unit and integration test suite for the Google AI Studio Bridge
 * and aligned credential/provider modules (env-vault, secret-vault, ai-providers, gemini-gem-agent).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_AI_STUDIO_BASE_URL,
  AI_STUDIO_DEFAULT_MODELS,
  redactAiStudioSecret,
  resolveAiStudioCredential,
  getAiStudioBridgeStatus,
  listAiStudioModels,
  verifyAiStudioConnection,
  generateAiStudioContent,
  coCreateWithAiStudio,
  getAiStudioSession,
  listAiStudioSessions
} from '../src/google-ai-studio-bridge.js';
import { PROVIDER_ENV_KEYS, getProviderSecret } from '../src/env-vault.js';
import { secretInputSchema, storeSecret, resolveProviderSecret } from '../src/secret-vault.js';
import { listAIProviders, getConfiguredAIProvider } from '../src/ai-providers.js';
import { executeGeminiGemAgent } from '../src/gemini-gem-agent.js';

const FAKE_AIZA_KEY = `AIzaSy${'A'.repeat(33)}`;
const FAKE_AIZA_KEY_2 = `AIzaSy${'B'.repeat(33)}`;
const FAKE_AQ_KEY = `AQ.${'Q'.repeat(36)}`;
const FAKE_VAULT_MASTER_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');

function createInMemoryD1() {
  const vaultRows = [];
  const memoryRows = new Map();
  const events = [];

  return {
    vaultRows,
    memoryRows,
    events,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      const runner = (args) => ({
        async first() {
          if (normalized.startsWith('INSERT INTO ops_secret_vault')) {
            const [id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint] = args;
            const now = new Date().toISOString();
            const existingIdx = vaultRows.findIndex(r => r.owner_id === owner_id && r.provider === provider && r.name === name);
            const row = {
              id,
              owner_id,
              provider,
              name,
              secret_ciphertext,
              secret_iv,
              secret_hint,
              status: 'stored',
              verification_json: null,
              created_at: now,
              updated_at: now,
              last_verified_at: null,
              revoked_at: null
            };
            if (existingIdx >= 0) {
              row.id = vaultRows[existingIdx].id;
              vaultRows[existingIdx] = row;
            } else {
              vaultRows.push(row);
            }
            return row;
          }
          if (normalized.includes('FROM ops_secret_vault') && normalized.includes('WHERE id=? AND owner_id=? AND provider=?')) {
            const [id, owner_id, provider] = args;
            return vaultRows.find(r => r.id === id && r.owner_id === owner_id && r.provider === provider && r.status !== 'revoked') || null;
          }
          if (normalized.includes('FROM ops_secret_vault') && normalized.includes("provider IN ('google_ai_studio','gemini')")) {
            if (normalized.includes('owner_id=?')) {
              const [owner_id] = args;
              const match = vaultRows.find(r => r.owner_id === owner_id && (r.provider === 'google_ai_studio' || r.provider === 'gemini') && r.status !== 'revoked');
              return match ? { id: match.id } : null;
            }
            const match = vaultRows.find(r => (r.provider === 'google_ai_studio' || r.provider === 'gemini') && r.status !== 'revoked');
            return match ? { id: match.id } : null;
          }
          if (normalized.includes('FROM ops_secret_vault') && normalized.includes('WHERE provider=?')) {
            const [provider] = args;
            return vaultRows.find(r => r.provider === provider && r.status !== 'revoked') || null;
          }
          if (normalized.includes('FROM ops_secret_vault') && normalized.includes("provider='gemini'")) {
            return vaultRows.find(r => r.provider === 'gemini' && r.status !== 'revoked') || null;
          }
          if (normalized.includes('FROM ops_secret_vault') && normalized.includes("provider='google_ai_studio'")) {
            return vaultRows.find(r => r.provider === 'google_ai_studio' && r.status !== 'revoked') || null;
          }
          if (normalized.includes('FROM ops_memory WHERE key = ?')) {
            const [key] = args;
            return memoryRows.get(key) || null;
          }
          return null;
        },
        async all() {
          if (normalized.includes('FROM ops_memory WHERE key LIKE ?')) {
            const [pattern, limit] = args;
            const prefix = String(pattern || '').replace(/%$/, '');
            const matches = [];
            for (const [k, row] of memoryRows.entries()) {
              if (k.startsWith(prefix)) matches.push({ key: k, value: row.value, updated_at: row.updated_at });
            }
            matches.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
            return { results: matches.slice(0, limit || 20) };
          }
          if (normalized.includes('FROM ops_secret_vault WHERE owner_id=?')) {
            const [owner_id] = args;
            return { results: vaultRows.filter(r => r.owner_id === owner_id && r.status !== 'revoked') };
          }
          return { results: [] };
        },
        async run() {
          if (normalized.startsWith('INSERT INTO ops_events')) {
            events.push({ sql: normalized, args });
            return { success: true };
          }
          if (normalized.startsWith('INSERT INTO ops_memory')) {
            const [key, value] = args;
            const now = new Date().toISOString();
            memoryRows.set(key, { key, value, source: 'google-ai-studio-bridge', updated_at: now });
            return { success: true };
          }
          return { success: true };
        }
      });

      return {
        bind(...args) {
          return runner(args);
        },
        first() {
          return runner([]).first();
        },
        all() {
          return runner([]).all();
        },
        run() {
          return runner([]).run();
        }
      };
    }
  };
}

function createInMemoryKV() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async list({ prefix = '', limit = 100 } = {}) {
      const keys = [];
      for (const name of store.keys()) {
        if (name.startsWith(prefix)) keys.push({ name });
      }
      return { keys: keys.slice(0, limit) };
    }
  };
}

// ============================================================================
// Group 1: Metadata-only status (getAiStudioBridgeStatus)
// ============================================================================
test('Group 1: getAiStudioBridgeStatus is strictly metadata-only, calls .get() 0 times, and never leaks keys', async () => {
  let storeReads = 0;
  const db = createInMemoryD1();
  await storeSecret(
    { DB: db, TRINITY_VAULT_KEY: FAKE_VAULT_MASTER_KEY },
    'owner@auru.space',
    { provider: 'google_ai_studio', name: 'Primary Studio Key', secret: FAKE_AIZA_KEY }
  );

  const env = {
    DB: db,
    TRINITY_VAULT_KEY: FAKE_VAULT_MASTER_KEY,
    GOOGLE_AI_STUDIO_API_KEY: { get: async () => { storeReads++; return FAKE_AIZA_KEY; } },
    TRINITY_MASTER_GOOGLE: { get: async () => { storeReads++; return FAKE_AIZA_KEY_2; } },
    GEMINI_API_KEY: FAKE_AIZA_KEY,
    GEMINI_MODEL: 'models/gemini-2.5-flash'
  };

  const status = await getAiStudioBridgeStatus(env, 'owner@auru.space');

  assert.equal(storeReads, 0, 'status handler must NEVER call .get() on Secrets Store bindings');
  assert.equal(status.bridge, 'google-ai-studio');
  assert.equal(status.endpoint, GOOGLE_AI_STUDIO_BASE_URL);
  assert.equal(status.configured, true);
  assert.equal(status.live_verified, false);
  assert.equal(status.secret_values_accessed, false);
  assert.equal(status.default_model, 'gemini-2.5-flash');
  assert.deepEqual(status.sources, {
    google_ai_studio_secret_store: true,
    google_ai_studio_worker_secret: false,
    gemini_worker_secret: true,
    trinity_master_google_store: true,
    encrypted_vault: true
  });
  assert.deepEqual(status.capabilities, ['models', 'generate', 'stream', 'co_create', 'sessions', 'mcp']);
  assert.doesNotMatch(JSON.stringify(status), new RegExp(FAKE_AIZA_KEY));
  assert.doesNotMatch(JSON.stringify(status), new RegExp(FAKE_AIZA_KEY_2));

  // Unconfigured environment reports configured: false cleanly
  const emptyStatus = await getAiStudioBridgeStatus({});
  assert.equal(emptyStatus.configured, false);
  assert.equal(emptyStatus.live_verified, false);
  assert.equal(emptyStatus.secret_values_accessed, false);
  assert.equal(emptyStatus.default_model, AI_STUDIO_DEFAULT_MODELS[0]);
});

// ============================================================================
// Group 2: 3-layer credential resolution (resolveAiStudioCredential)
// ============================================================================
test('Group 2: resolveAiStudioCredential enforces 3-layer precedence and fails closed on errors/malformed tokens', async () => {
  const db = createInMemoryD1();
  const stored = await storeSecret(
    { DB: db, TRINITY_VAULT_KEY: FAKE_VAULT_MASTER_KEY },
    'owner@auru.space',
    { provider: 'google_ai_studio', name: 'Vault AI Studio', secret: FAKE_AQ_KEY }
  );

  // Layer 1: explicit Vault secretId takes highest precedence
  const explicit = await resolveAiStudioCredential(
    {
      DB: db,
      TRINITY_VAULT_KEY: FAKE_VAULT_MASTER_KEY,
      GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY
    },
    { ownerId: 'owner@auru.space', secretId: stored.id }
  );
  assert.deepEqual(explicit, {
    apiKey: FAKE_AQ_KEY,
    source: 'encrypted-vault',
    binding: `vault:${stored.id}`
  });

  // Layer 2: Worker string secret takes precedence over Secrets Store (.get() called 0 times)
  let storeReads = 0;
  const workerPref = await resolveAiStudioCredential({
    GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY,
    TRINITY_MASTER_GOOGLE: { get: async () => { storeReads++; return FAKE_AIZA_KEY_2; } }
  });
  assert.deepEqual(workerPref, {
    apiKey: FAKE_AIZA_KEY,
    source: 'worker-secret',
    binding: 'GOOGLE_AI_STUDIO_API_KEY'
  });
  assert.equal(storeReads, 0);

  // Layer 3a: Secrets Store binding on GOOGLE_AI_STUDIO_API_KEY
  const studioStore = await resolveAiStudioCredential({
    GOOGLE_AI_STUDIO_API_KEY: { get: async () => `  ${FAKE_AIZA_KEY_2}  ` }
  });
  assert.deepEqual(studioStore, {
    apiKey: FAKE_AIZA_KEY_2,
    source: 'secrets-store',
    binding: 'GOOGLE_AI_STUDIO_API_KEY'
  });

  // Layer 3b: Secrets Store binding on TRINITY_MASTER_GOOGLE
  const masterStore = await resolveAiStudioCredential({
    TRINITY_MASTER_GOOGLE: { get: async () => FAKE_AIZA_KEY }
  });
  assert.deepEqual(masterStore, {
    apiKey: FAKE_AIZA_KEY,
    source: 'secrets-store',
    binding: 'TRINITY_MASTER_GOOGLE'
  });

  // Layer 4: Encrypted D1 Vault fallback when no Worker/Secrets Store keys exist
  const vaultFallback = await resolveAiStudioCredential({
    DB: db,
    TRINITY_VAULT_KEY: FAKE_VAULT_MASTER_KEY
  });
  assert.deepEqual(vaultFallback, {
    apiKey: FAKE_AQ_KEY,
    source: 'encrypted-vault',
    binding: 'ops_secret_vault:google_ai_studio'
  });

  // Throwing bindings and malformed tokens fail closed without throwing or leaking secrets
  const failedClosed = await resolveAiStudioCredential({
    GOOGLE_AI_STUDIO_API_KEY: 'not-a-valid-gemini-token',
    GEMINI_API_KEY: { get: async () => { throw new Error(`boom-${FAKE_AIZA_KEY}`); } },
    TRINITY_MASTER_GOOGLE: { get: async () => 'short-garbage' }
  });
  assert.deepEqual(failedClosed, { apiKey: null, source: null, binding: null });
});

// ============================================================================
// Group 3: Secret redaction (redactAiStudioSecret)
// ============================================================================
test('Group 3: redactAiStudioSecret strips AIza, AQ., x-goog-api-key headers, and key/api_key URL params', () => {
  const sample = [
    `Key1: ${FAKE_AIZA_KEY}`,
    `Key2: ${FAKE_AQ_KEY}`,
    `Header: x-goog-api-key: super-secret-header-token`,
    `URL1: https://generativelanguage.googleapis.com/v1beta/models?key=raw-query-secret&alt=json`,
    `URL2: https://example.invalid/test?foo=1&api_key=another-query-secret`
  ].join('\n');

  const redacted = redactAiStudioSecret(sample);
  assert.doesNotMatch(redacted, new RegExp(FAKE_AIZA_KEY));
  assert.doesNotMatch(redacted, new RegExp(FAKE_AQ_KEY.replace('.', '\\.')));
  assert.doesNotMatch(redacted, /super-secret-header-token/);
  assert.doesNotMatch(redacted, /raw-query-secret/);
  assert.doesNotMatch(redacted, /another-query-secret/);
  assert.match(redacted, /\[REDACTED_GOOGLE_API_KEY\]/);
  assert.match(redacted, /\[REDACTED\]/);
  assert.equal(redactAiStudioSecret(null), '');
});

// ============================================================================
// Group 4: Model discovery (listAiStudioModels)
// ============================================================================
test('Group 4: listAiStudioModels sends x-goog-api-key header only, uses redirect manual, picks recommended model, and decodes ErrorInfo', async () => {
  const captured = [];
  const fetcher = async (url, init) => {
    captured.push({ url: String(url), init });
    return Response.json({
      models: [
        {
          name: 'models/embedding-001',
          displayName: 'Embedding 001',
          supportedGenerationMethods: ['embedContent']
        },
        {
          name: 'models/gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          inputTokenLimit: 1048576,
          outputTokenLimit: 8192,
          supportedGenerationMethods: ['generateContent']
        },
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          inputTokenLimit: 1048576,
          outputTokenLimit: 65536,
          supportedGenerationMethods: ['generateContent', 'countTokens']
        }
      ]
    });
  };

  const res = await listAiStudioModels({ GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY }, { fetcher, pageSize: 50 });

  assert.equal(res.ok, true);
  assert.equal(res.verified, true);
  assert.equal(res.source, 'worker-secret');
  assert.equal(res.total, 3);
  assert.equal(res.recommended_model, 'gemini-2.5-flash');
  assert.equal(res.receipt.status, 'success');
  assert.equal(res.receipt.tool, 'google_ai_studio');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, `${GOOGLE_AI_STUDIO_BASE_URL}/models?pageSize=50`);
  assert.equal(captured[0].url.includes('key='), false, 'API key must NEVER appear in query string');
  assert.equal(captured[0].init.headers['x-goog-api-key'], FAKE_AIZA_KEY);
  assert.equal(captured[0].init.redirect, 'manual');

  // ErrorInfo decoding & secret redaction on HTTP 401 and 429
  for (const [status, reason] of [[401, 'API_KEY_INVALID'], [429, 'RATE_LIMIT_EXCEEDED']]) {
    const errRes = await listAiStudioModels(
      { GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY },
      {
        fetcher: async () => Response.json(
          {
            error: {
              code: status,
              message: `Request failed for key ${FAKE_AIZA_KEY} at ?key=${FAKE_AIZA_KEY}`,
              status: status === 401 ? 'UNAUTHENTICATED' : 'RESOURCE_EXHAUSTED',
              details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }]
            }
          },
          { status }
        )
      }
    );
    assert.equal(errRes.ok, false);
    assert.equal(errRes.verified, false);
    assert.equal(errRes.status, status);
    assert.equal(errRes.error_reason, reason);
    assert.match(errRes.error, new RegExp(reason));
    assert.doesNotMatch(errRes.error, new RegExp(FAKE_AIZA_KEY));
    assert.equal(errRes.receipt.status, 'failed');
  }
});

// ============================================================================
// Group 5: Live verification (verifyAiStudioConnection)
// ============================================================================
test('Group 5: verifyAiStudioConnection requires BOTH model discovery and generateContent probe', async () => {
  const calls = [];
  const successFetcher = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (String(url).includes('/models?')) {
      return Response.json({
        models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
      });
    }
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1, totalTokenCount: 5 }
    });
  };

  const ok = await verifyAiStudioConnection({ GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY }, { fetcher: successFetcher });
  assert.equal(ok.ok, true);
  assert.equal(ok.connected, true);
  assert.equal(ok.verified, true);
  assert.equal(ok.model, 'gemini-2.5-flash');
  assert.equal(ok.models_count, 1);
  assert.equal(ok.source, 'worker-secret');
  assert.equal(ok.receipt.status, 'success');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.generationConfig.maxOutputTokens, 8);
  assert.equal(calls[1].body.generationConfig.temperature, 0);

  // Fails closed if discovery succeeds but generateContent probe fails with HTTP 403
  const failingProbeFetcher = async (url) => {
    if (String(url).includes('/models?')) {
      return Response.json({
        models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
      });
    }
    return Response.json(
      { error: { code: 403, message: 'Forbidden', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_SERVICE_BLOCKED' }] } },
      { status: 403 }
    );
  };

  const failed = await verifyAiStudioConnection({ GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY }, { fetcher: failingProbeFetcher });
  assert.equal(failed.ok, false);
  assert.equal(failed.connected, false);
  assert.equal(failed.verified, false);
  assert.equal(failed.models_count, 1);
  assert.match(failed.error, /API_KEY_SERVICE_BLOCKED/);
  assert.equal(failed.receipt.status, 'failed');
});

// ============================================================================
// Group 6: Content generation (standard, SSE stream, 404/400 cascade, 401/403/429/500 fail-closed)
// ============================================================================
test('Group 6: generateAiStudioContent handles standard JSON, SSE streaming, 404 cascade, and strict 401/403/429/500 fail-closed', async () => {
  // 6a: Standard generation
  const stdRes = await generateAiStudioContent(
    { GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY },
    { prompt: 'Summarize Trinity architecture.', model: 'gemini-2.5-flash', temperature: 0.2, maxOutputTokens: 256 },
    {
      fetcher: async (url, init) => {
        assert.equal(url, `${GOOGLE_AI_STUDIO_BASE_URL}/models/gemini-2.5-flash:generateContent`);
        assert.equal(init.headers['x-goog-api-key'], FAKE_AIZA_KEY);
        assert.equal(init.redirect, 'manual');
        return Response.json({
          candidates: [{ content: { parts: [{ text: 'Trinity is a Cloudflare Worker AI platform.' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 9, totalTokenCount: 19 }
        });
      }
    }
  );
  assert.equal(stdRes.ok, true);
  assert.equal(stdRes.provider, 'google-ai-studio');
  assert.equal(stdRes.model, 'gemini-2.5-flash');
  assert.equal(stdRes.text, 'Trinity is a Cloudflare Worker AI platform.');
  assert.equal(stdRes.finishReason, 'STOP');
  assert.deepEqual(stdRes.usage, { inputTokens: 10, outputTokens: 9, totalTokens: 19 });
  assert.ok(stdRes.latency_ms >= 0);
  assert.equal(stdRes.receipt.status, 'success');

  // 6b: SSE streaming
  const sseBody = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n';
  const streamRes = await generateAiStudioContent(
    { GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY },
    { prompt: 'Stream hello', model: 'gemini-2.5-flash', stream: true },
    {
      fetcher: async (url, init) => {
        assert.equal(url, `${GOOGLE_AI_STUDIO_BASE_URL}/models/gemini-2.5-flash:streamGenerateContent?alt=sse`);
        assert.equal(init.headers['x-goog-api-key'], FAKE_AIZA_KEY);
        return new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
    }
  );
  assert.equal(streamRes.ok, true);
  assert.equal(streamRes.provider, 'google-ai-studio');
  assert.ok(streamRes.streamResponse instanceof Response);
  assert.equal(await streamRes.streamResponse.text(), sseBody);

  // 6c: HTTP 404 model compatibility cascade (e.g., gemini-3.8-flash -> discovered gemini-2.5-flash)
  const cascadeUrls = [];
  const cascadeRes = await generateAiStudioContent(
    { GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY, GEMINI_MODEL: 'gemini-3.8-flash' },
    { prompt: 'Test fallback' },
    {
      fetcher: async (url) => {
        cascadeUrls.push(String(url));
        if (String(url).includes('gemini-3.8-flash:generateContent')) {
          return Response.json({ error: { code: 404, message: 'Model models/gemini-3.8-flash is not found' } }, { status: 404 });
        }
        if (String(url).includes('/models?')) {
          return Response.json({
            models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
          });
        }
        if (String(url).includes('gemini-2.5-flash:generateContent')) {
          return Response.json({
            candidates: [{ content: { parts: [{ text: 'Fallback succeeded.' }] }, finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 }
          });
        }
        return Response.json({ error: { message: 'unexpected' } }, { status: 500 });
      }
    }
  );
  assert.equal(cascadeRes.ok, true);
  assert.equal(cascadeRes.model, 'gemini-2.5-flash');
  assert.equal(cascadeRes.text, 'Fallback succeeded.');
  assert.equal(cascadeUrls.length, 3);

  // 6d: HTTP 401, 403, 429, 500 MUST fail closed without masking or falling back
  for (const status of [401, 403, 429, 500]) {
    let fetchCalls = 0;
    const errRes = await generateAiStudioContent(
      { GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY },
      { prompt: 'Do not mask auth/quota/server errors', model: 'gemini-2.5-flash' },
      {
        fetcher: async () => {
          fetchCalls++;
          return Response.json({ error: { code: status, message: `Upstream error ${status}` } }, { status });
        }
      }
    );
    assert.equal(errRes.ok, false);
    assert.equal(errRes.status, status);
    assert.equal(fetchCalls, 1, `HTTP ${status} must fail closed immediately without retrying other models`);
    assert.equal(errRes.receipt.status, 'failed');
  }
});

// ============================================================================
// Group 7: Multi-turn collaborative co-creation (D1 ops_memory, KV fallback, 12-turn cap, EN/SK policy)
// ============================================================================
test('Group 7: coCreateWithAiStudio persists bounded 12-turn sessions in D1 & KV, enforces EN internal / SK user directive, and fails closed when unconfigured', async () => {
  // 7a: Fail-closed when unconfigured (allow_edge_fallback: false)
  const unconfigured = await coCreateWithAiStudio({}, { task: 'Navrhni API endpoint' });
  assert.equal(unconfigured.ok, false);
  assert.equal(unconfigured.language_policy.internal_work, 'en');
  assert.equal(unconfigured.language_policy.user_communication, 'sk');
  assert.match(unconfigured.error, /not configured/i);
  assert.equal(unconfigured.receipt.status, 'failed');
  assert.ok(unconfigured._evidence.receipt_id);

  // 7b: Multi-turn persistence in D1 ops_memory + English internal prompts + Slovak synthesis directive + artifact extraction
  const db = createInMemoryD1();
  const seenPayloads = [];
  const mockFetcher = async (_url, init) => {
    const body = JSON.parse(init.body);
    seenPayloads.push(body);
    const turnIdx = seenPayloads.length;
    return Response.json({
      candidates: [{
        content: {
          parts: [{
            text: [
              '===INTERNAL_ANALYSIS===',
              `Turn ${turnIdx} English architectural review completed cleanly.`,
              '===USER_REPLY===',
              `Krok ${turnIdx}: Spoločný návrh z Trinity a Google AI Studio je pripravený.`,
              '===ARTIFACT:javascript===',
              `export const turn = ${turnIdx};`
            ].join('\n')
          }]
        },
        finishReason: 'STOP'
      }],
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 30, totalTokenCount: 70 }
    });
  };

  const envD1 = { DB: db, GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY };

  const turn1 = await coCreateWithAiStudio(
    envD1,
    { session_id: 'bridge-demo', task: 'Navrhni nový modul pre Trinity', mode: 'build_artifact' },
    { fetcher: mockFetcher }
  );
  assert.equal(turn1.ok, true);
  assert.equal(turn1.session_id, 'bridge-demo');
  assert.equal(turn1.turn, 1);
  assert.equal(turn1.mode, 'build_artifact');
  assert.deepEqual(turn1.language_policy, { internal_work: 'en', user_communication: 'sk' });
  assert.match(turn1.trinity_plan, /\[Trinity Co-Creation Plan/);
  assert.match(seenPayloads[0].systemInstruction.parts[0].text, /strictly in English/i);
  assert.match(seenPayloads[0].systemInstruction.parts[0].text, /strictly in natural Slovak/i);
  assert.match(turn1.final_reply, /Krok 1:/);
  assert.deepEqual(turn1.artifact, { type: 'javascript', content: 'export const turn = 1;' });
  assert.equal(turn1._evidence.effect, 'mutation');
  assert.equal(turn1.receipt.status, 'success');

  // Verify English reply_language override
  const turn2En = await coCreateWithAiStudio(
    envD1,
    { session_id: 'bridge-demo', task: 'Add validation rules', mode: 'review', reply_language: 'en' },
    { fetcher: mockFetcher }
  );
  assert.equal(turn2En.ok, true);
  assert.equal(turn2En.turn, 2);
  assert.deepEqual(turn2En.language_policy, { internal_work: 'en', user_communication: 'en' });
  assert.match(seenPayloads[1].systemInstruction.parts[0].text, /clear, natural English/i);
  // Prior turn context was forwarded into contents
  assert.ok(seenPayloads[1].contents.length >= 3);

  // Run 12 more turns (14 total) and confirm persisted session is strictly bounded to 12 turns
  for (let i = 3; i <= 14; i++) {
    const t = await coCreateWithAiStudio(
      envD1,
      { session_id: 'bridge-demo', task: `Follow-up iteration ${i}`, mode: 'pair' },
      { fetcher: mockFetcher }
    );
    assert.equal(t.ok, true);
    assert.equal(t.turn, i);
  }

  const persistedSession = await getAiStudioSession(envD1, 'bridge-demo');
  assert.ok(persistedSession);
  assert.equal(persistedSession.turns.length, 12, 'persisted session history must be bounded to last 12 turns');
  assert.equal(persistedSession.turns[0].turn, 3);
  assert.equal(persistedSession.turns[11].turn, 14);

  const listed = await listAiStudioSessions(envD1, 10);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].session_id, 'bridge-demo');
  assert.equal(listed.items[0].turns_count, 12);

  // 7c: KV Mastermind fallback when D1 is absent
  const kv = createInMemoryKV();
  const envKV = { Mastermind: kv, GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY };
  const kvTurn = await coCreateWithAiStudio(
    envKV,
    { session_id: 'kv-session-1', task: 'Vymysli 3 nápady', mode: 'brainstorm' },
    { fetcher: mockFetcher }
  );
  assert.equal(kvTurn.ok, true);
  assert.equal(kvTurn._evidence.effect, 'mutation');
  const kvLoaded = await getAiStudioSession(envKV, 'kv-session-1');
  assert.equal(kvLoaded?.turns.length, 1);
  const kvListed = await listAiStudioSessions(envKV, 10);
  assert.equal(kvListed.items.length, 1);
  assert.equal(kvListed.items[0].session_id, 'kv-session-1');
});

// ============================================================================
// Group 8: Alignment tests (secret-vault, env-vault, ai-providers, gemini-gem-agent)
// ============================================================================
test('Group 8: Vault, env-vault, ai-providers, and gemini-gem-agent align with GOOGLE_AI_STUDIO_API_KEY and Secrets Store', async () => {
  // 8a: secretInputSchema accepts 'google_ai_studio'
  const parsed = secretInputSchema.parse({
    provider: 'google_ai_studio',
    name: 'AI Studio Production Key',
    secret: FAKE_AIZA_KEY
  });
  assert.equal(parsed.provider, 'google_ai_studio');

  // 8b: PROVIDER_ENV_KEYS.gemini includes GOOGLE_AI_STUDIO_API_KEY & getProviderSecret resolves it
  assert.ok(PROVIDER_ENV_KEYS.gemini.includes('GOOGLE_AI_STUDIO_API_KEY'));
  assert.equal(await getProviderSecret({ GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY }, 'gemini'), FAKE_AIZA_KEY);
  assert.equal(await getProviderSecret({ GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY }, 'google_ai_studio'), FAKE_AIZA_KEY);

  // 8c: resolveProviderSecret supports 'google_ai_studio' across Worker Secret & Secrets Store
  assert.equal(await resolveProviderSecret({ GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY }, 'google_ai_studio'), FAKE_AIZA_KEY);
  assert.equal(
    await resolveProviderSecret({ TRINITY_MASTER_GOOGLE: { get: async () => FAKE_AIZA_KEY_2 } }, 'google_ai_studio'),
    FAKE_AIZA_KEY_2
  );

  // 8d: listAIProviders & getConfiguredAIProvider recognize GOOGLE_AI_STUDIO_API_KEY (metadata-only for Secrets Store)
  const db = createInMemoryD1();
  let reads = 0;
  const storeEnv = {
    DB: db,
    GEMINI_MODEL: 'gemini-2.5-flash',
    GOOGLE_AI_STUDIO_API_KEY: { get: async () => { reads++; return FAKE_AIZA_KEY; } }
  };
  const listed = await listAIProviders(storeEnv, 'owner@auru.space');
  const geminiEntry = listed.items.find(p => p.id === 'gemini');
  assert.equal(geminiEntry.configured, true);
  assert.equal(geminiEntry.secret_source, 'secrets-store');
  assert.equal(reads, 0, 'listAIProviders must not invoke .get() on GOOGLE_AI_STUDIO_API_KEY binding');

  const resolvedConfig = await getConfiguredAIProvider(storeEnv, 'gemini');
  assert.equal(resolvedConfig.apiKey, FAKE_AIZA_KEY);
  assert.equal(resolvedConfig.model, 'models/gemini-2.5-flash');
  assert.equal(reads, 1);

  const stringEnv = { DB: db, GEMINI_MODEL: 'gemini-2.5-flash', GOOGLE_AI_STUDIO_API_KEY: FAKE_AIZA_KEY_2 };
  const listedStr = await listAIProviders(stringEnv, 'owner@auru.space');
  assert.equal(listedStr.items.find(p => p.id === 'gemini').secret_source, 'worker-secret');

  // 8e: gemini-gem-agent.js works with Secrets Store TRINITY_MASTER_GOOGLE and GOOGLE_AI_STUDIO_API_KEY
  let agentReads = 0;
  let capturedKeyHeader = null;
  const agentOut = await executeGeminiGemAgent(
    {
      GEMINI_MODEL: 'gemini-2.5-flash',
      TRINITY_MASTER_GOOGLE: { get: async () => { agentReads++; return FAKE_AIZA_KEY; } }
    },
    'Skontroluj stav architektúry.',
    {
      tools: false,
      fetcher: async (_url, init) => {
        capturedKeyHeader = init.headers['x-goog-api-key'];
        return Response.json({
          candidates: [{ content: { parts: [{ text: 'Architektúra bola overená cez Secrets Store.' }] } }],
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10 }
        });
      }
    }
  );
  assert.equal(agentOut.success, true);
  assert.equal(agentOut.tier, 'gemini-native');
  assert.equal(agentOut.provider, 'gemini');
  assert.equal(agentReads, 1);
  assert.equal(capturedKeyHeader, FAKE_AIZA_KEY);
  assert.match(agentOut.result, /Secrets Store/);
});
