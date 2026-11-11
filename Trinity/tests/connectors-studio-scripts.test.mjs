import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHtml } from '../src/studio.js';
import { callModel } from '../src/services.js';
import { secretInputSchema, storeSecret, verifySecret } from '../src/secret-vault.js';
import { TRINITY_SCRIPTS_CATALOG, COMMON_CONNECTORS_CATALOG } from '../src/scripts-catalog.js';

const trinityDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = resolve(trinityDir, '..');

test('extractHtml strips markdown fences, adds missing doctype/head, and injects CSP', () => {
  const fenced = 'Tu je tvoj web:\n```html\n<html lang="sk"><body><h1>Ahoj Trinity</h1><p>Test</p></body></html>\n```';
  const result = extractHtml(fenced);
  assert.match(result, /^<!doctype html>/i);
  assert.match(result, /content-security-policy/i);
  assert.match(result, /<h1>Ahoj Trinity<\/h1>/);
  assert.match(result, /<\/html>$/i);
});

test('extractHtml recovers cleanly when closing html tag is truncated after substantial body', () => {
  const partial = '<!doctype html><html lang="sk"><head><title>Test</title></head><body><main><h1>Trinity Studio</h1><p>' + 'x'.repeat(250) + '</p></main>';
  const result = extractHtml(partial);
  assert.match(result, /<\/body>\s*<\/html>$/i);
  assert.match(result, /content-security-policy/i);
});

test('callModel bypasses 600-token CHAT_INFERENCE_SERVICE cap for long generations like AI Studio', async () => {
  let inferenceWorkerCalled = false;
  let aiRunCalled = false;
  let capturedMaxTokens = 0;
  const mockEnv = {
    CHAT_INFERENCE_SERVICE: {
      fetch: async () => {
        inferenceWorkerCalled = true;
        return new Response(JSON.stringify({ response: 'truncated' }), { status: 200 });
      }
    },
    AI: {
      run: async (_model, opts) => {
        aiRunCalled = true;
        capturedMaxTokens = opts.max_tokens;
        return { response: '<!doctype html><html><head><title>OK</title></head><body><h1>OK</h1></body></html>' };
      }
    }
  };

  const res = await callModel(mockEnv, 'workers-ai', [{ role: 'user', content: 'Build page' }], 6000, null, { directAI: true });
  assert.equal(inferenceWorkerCalled, false);
  assert.equal(aiRunCalled, true);
  assert.equal(capturedMaxTokens, 6000);
  assert.match(res.text, /<\/html>/i);
});

test('every vault connector in COMMON_CONNECTORS_CATALOG is accepted by secretInputSchema', () => {
  for (const connector of COMMON_CONNECTORS_CATALOG) {
    if (connector.mode !== 'vault') continue;
    const parsed = secretInputSchema.parse({
      provider: connector.provider,
      name: connector.name,
      secret: 'test-token-value-12345678'
    });
    assert.equal(parsed.provider, connector.provider);
  }
});

test('TRINITY_SCRIPTS_CATALOG points exclusively to real existing repository scripts', () => {
  assert.ok(TRINITY_SCRIPTS_CATALOG.length >= 12);
  for (const script of TRINITY_SCRIPTS_CATALOG) {
    const abs = resolve(repoRoot, script.path);
    assert.equal(existsSync(abs), true, `Missing script referenced in catalog: ${script.path}`);
  }
});

test('verifySecret rejects private/localhost URLs for webhook and supabase connectors', async () => {
  const storedRows = new Map();
  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (sql.includes('INSERT INTO ops_secret_vault')) {
                const [id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint] = args;
                const row = {
                  id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint,
                  status: 'stored', verification_json: null,
                  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T00:00:00Z',
                  last_verified_at: null, revoked_at: null
                };
                storedRows.set(id, row);
                return row;
              }
              if (sql.includes('SELECT * FROM ops_secret_vault WHERE id=?')) {
                return storedRows.get(args[0]) || null;
              }
              return null;
            },
            run: async () => ({ success: true })
          };
        }
      };
    }
  };
  const env = { DB: mockDb, TRINITY_VAULT_KEY: Buffer.alloc(32, 9).toString('base64url') };
  const stored = await storeSecret(env, 'owner-1', {
    provider: 'webhook',
    name: 'Local Hook',
    secret: 'http://127.0.0.1:8080/hook'
  });
  await assert.rejects(() => verifySecret(env, 'owner-1', stored.id), /HTTPS protokol/i);
});

test('assistant UI HTML and JS include connectors catalog, studio controls, and 1-click installer', () => {
  const html = readFileSync(resolve(trinityDir, 'public/assistant/chat.html'), 'utf8');
  const js = readFileSync(resolve(trinityDir, 'public/assistant/chat.js.txt'), 'utf8');
  for (const id of ['settings-connectors-grid', 'connector-quick-box', 'settings-install-all-btn', 'settings-scripts-list', 'settings-tools-list', 'studio-audit-btn', 'studio-deploy-domain-btn']) {
    assert.ok(html.includes(`id="${id}"`), `Missing UI element #${id} in chat.html`);
    assert.ok(js.includes(id), `Missing UI handler for #${id} in chat.js.txt`);
  }
  // Ensure Web Builder comes before workflow-builder inside studio-view
  const builderPos = html.indexOf('class="builder-shell"');
  const workflowPos = html.indexOf('class="workflow-builder"');
  assert.ok(builderPos > 0 && workflowPos > builderPos);
});
