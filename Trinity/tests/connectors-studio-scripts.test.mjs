import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHtml } from '../src/studio.js';
import { callModel } from '../src/services.js';
import { secretInputSchema, storeSecret, verifySecret } from '../src/secret-vault.js';
import { TRINITY_SCRIPTS_CATALOG, COMMON_CONNECTORS_CATALOG } from '../src/scripts-catalog.js';
import { runMultiModelConsensus } from '../src/multi-model-bus.js';
import { renderLandingHtml } from '../src/landing-page.js';
import { TOOL_HELP } from '../src/tools.js';

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

test('assistant UI stylesheets enforce Underground Garage Hip-Hop theme without icon-wiping or light leaks', () => {
  const html = readFileSync(resolve(trinityDir, 'public/assistant/chat.html'), 'utf8');
  const garageCss = readFileSync(resolve(trinityDir, 'public/assistant/garage.css'), 'utf8');
  const builderCss = readFileSync(resolve(trinityDir, 'public/assistant/builder.css'), 'utf8');
  const mobileCss = readFileSync(resolve(trinityDir, 'public/assistant/mobile.css'), 'utf8');

  assert.ok(html.includes('class="garage-ui sovereign-ui"'), 'chat.html should use garage-ui + sovereign-ui classes');
  assert.ok(/UNDERGROUND\s*\/\s*GARAGE\s*\/\s*HIP-HOP/i.test(html), 'chat.html should display Underground Garage Hip-Hop brand subtitle');
  assert.ok(!/content:\s*['"]↗['"]/i.test(garageCss), 'garage.css must not overwrite sidebar icons with arrows');
  assert.ok(garageCss.includes('/garage-v1.webp'), 'garage.css should use the underground garage backdrop');
  assert.ok(garageCss.includes('--trinity-live-primary'), 'garage.css should respect ui-evolution primary CSS var');
  assert.ok(builderCss.includes('[data-theme="light"] .builder-shell'), 'builder.css should support light theme toggle cleanly');
  assert.ok(mobileCss.includes('@media (max-width: 760px)'), 'mobile.css must retain mobile breakpoint');
});

test('Trinity conversation prompts & greetings use warm natural human tone without robotic boilerplate', () => {
  const cognition = readFileSync(resolve(trinityDir, 'src/cognition.js'), 'utf8');
  const engine = readFileSync(resolve(trinityDir, 'src/engine.js'), 'utf8');
  const fastChat = readFileSync(resolve(trinityDir, 'src/fast-chat.js'), 'utf8');

  assert.ok(cognition.includes('Všímaj si náladu, tón a zámer v správe'), 'cognition.js should guide emotional & contextual responsiveness');
  assert.ok(!cognition.includes('Dobrý deň, Sabo. Čo chcete'), 'cognition.js must not contradict tykanie with vykanie examples');
  assert.ok(!engine.includes('vtipkovania a zbytočných úvodov'), 'engine.js system prompt must allow natural warmth and wit');
  assert.ok(fastChat.includes('parťáčka'), 'fast-chat.js should use natural conversational persona');
});

test('runMultiModelConsensus queries providers truthfully without fabricating unconfigured models', async () => {
  const env = {
    AI: {
      async run() {
        return { response: 'Overená odpoveď z Workers AI bez halucinácií.' };
      }
    }
  };
  const result = await runMultiModelConsensus(env, 'Navrhni krátky slogan pre Trinity', {
    providers: ['workers-ai', 'openai', 'gemini']
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempted_count, 3);
  assert.equal(result.responded_count, 1);
  assert.match(result.consensus_text, /Overená odpoveď z Workers AI/);
  const openaiRow = result.responses.find((r) => r.provider === 'openai');
  assert.equal(openaiRow?.ok, false);
  assert.ok(result.receipt?.receiptId);
});

test('renderLandingHtml serves Underground Garage showcase for auru.space and auru.dev and UI exposes consensus & landing', () => {
  const prodHtml = renderLandingHtml({ host: 'auru.space', environment: 'production', version: '12.0.0' });
  const devHtml = renderLandingHtml({ host: 'auru.dev', environment: 'staging', version: '12.0.0' });
  const html = readFileSync(resolve(trinityDir, 'public/assistant/chat.html'), 'utf8');
  const js = readFileSync(resolve(trinityDir, 'public/assistant/chat.js.txt'), 'utf8');

  assert.match(prodHtml, /PRODUCTION LIVE · AURU\.SPACE/);
  assert.match(devHtml, /STAGING LAB · AURU\.DEV/);
  assert.ok(prodHtml.includes('/garage-v1.webp') && prodHtml.includes('#d4ff2a'));
  assert.ok(typeof TOOL_HELP.multi_model_consensus === 'string');
  assert.ok(html.includes('id="plus-opt-tool-consensus"') && js.includes('plus-opt-tool-consensus'));
  assert.ok(html.includes('id="plus-opt-tool-landing"') && js.includes('plus-opt-tool-landing'));
});
