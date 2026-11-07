import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeFastChatInput,
  evaluateSafeArithmetic,
  matchFastChatEdge,
  handleFastChatEdge
} from '../src/fast-chat.js';
import chatInferenceWorker, {
  createStreamingSanitizer,
  sliceContextSafely,
  CIRCUIT_BREAKER_CONFIG
} from '../services/chat-inference.js';
import { recordAuditLog, listAuditLogs } from '../src/audit-ledger.js';
import {
  verifyBridgeSecret,
  createDesktopCommanderHandler
} from '../../scripts/desktop-commander-bridge/bridge.js';
import { runPreDeployCheck } from '../../scripts/pre-deploy-check.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trinityDir = path.resolve(__dirname, '..');

function parseJsonc(raw) {
  return JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
}

test('Module 1: Hermetická konfigurácia Wrangler (Staging vs Production)', () => {
  const config = parseJsonc(fs.readFileSync(path.join(trinityDir, 'wrangler.jsonc'), 'utf8'));
  const prod = config.env.production;
  const staging = config.env.staging;

  assert.equal(prod.vars.ENVIRONMENT, 'production');
  assert.equal(prod.vars.STRICT_MODE, 'true');
  assert.equal(prod.vars.DEBUG_LOGGING, 'false');
  assert.equal(prod.vars.ENABLE_EXPERIMENTAL_MODELS, 'false');

  assert.equal(staging.vars.ENVIRONMENT, 'staging');
  assert.equal(staging.vars.STRICT_MODE, 'false');
  assert.equal(staging.vars.DEBUG_LOGGING, 'true');
  assert.equal(staging.vars.ENABLE_EXPERIMENTAL_MODELS, 'true');

  assert.equal(prod.d1_databases.find((d) => d.binding === 'DB')?.database_name, 'trinity-v03');
  assert.equal(staging.d1_databases.find((d) => d.binding === 'DB')?.database_name, 'trinity-development');

  assert.ok(prod.kv_namespaces.some((k) => k.binding === 'TRINITY_KV_PROD'));
  assert.ok(staging.kv_namespaces.some((k) => k.binding === 'TRINITY_KV_STAGING'));

  for (const binding of ['PROFILE_SERVICE', 'CORE_SERVICE', 'DISPATCHER_SERVICE', 'AI_INFERENCE_SERVICE']) {
    assert.ok(prod.services.some((s) => s.binding === binding), `Prod missing ${binding}`);
    assert.ok(staging.services.some((s) => s.binding === binding), `Staging missing ${binding}`);
  }
});

test('Module 2: Fast-Chat Router, NFD Normalizácia, Safe Arithmetic & X-Trinity-Route', async () => {
  assert.equal(normalizeFastChatInput('  Kto je Majiteľ?!  '), 'kto je majitel');
  assert.equal(normalizeFastChatInput('Aké mám domény?'), 'ake mam domeny');

  assert.equal(evaluateSafeArithmetic('5+5'), 10);
  assert.equal(evaluateSafeArithmetic('12 * 8'), 96);
  assert.equal(evaluateSafeArithmetic('(10 + 5) * 2'), 30);
  assert.equal(evaluateSafeArithmetic('10 / 0'), null);
  assert.equal(evaluateSafeArithmetic('process.exit(1)'), null);

  const ownerMatch = matchFastChatEdge('Kto je majiteľ?');
  assert.ok(ownerMatch);
  assert.equal(ownerMatch.category, 'identity_ring0');
  assert.match(ownerMatch.reply, /Ivan Sabo \(Basterix/);

  const domainMatch = matchFastChatEdge('Aké mám domény?');
  assert.ok(domainMatch);
  assert.equal(domainMatch.category, 'system_fleet_domains');
  assert.match(domainMatch.reply, /47/);
  assert.match(domainMatch.reply, /auru\.space/);
  assert.match(domainMatch.reply, /auru\.dev/);

  const mathRes = await handleFastChatEdge('12*8');
  assert.ok(mathRes);
  assert.equal(mathRes.status, 200);
  assert.equal(mathRes.headers.get('X-Trinity-Route'), 'fast-chat-edge');
  const mathBody = await mathRes.json();
  assert.equal(mathBody.result, 96);
});

test('Module 3: System Instruction Pinning, 3-Tier Circuit Breaker & SSE Leak Filter', async () => {
  // 1. System Instruction Pinning at index 0
  const messages = [
    { role: 'system', content: 'Osobnosť Trinity Ring 0' },
    ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `Správa ${i + 1}` }))
  ];
  const sliced = sliceContextSafely(messages, 40000, 5);
  assert.equal(sliced[0].role, 'system');
  assert.equal(sliced[0].content, 'Osobnosť Trinity Ring 0');
  assert.equal(sliced.length, 5);

  // 2. Stateful Circuit Breaker: 3 failures on Tier 1 in 60s -> skips Tier 1 on 4th call
  let tier1Calls = 0;
  let tier2Calls = 0;
  const mockEnv = {
    AI: {
      async run(model) {
        if (model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast') {
          tier1Calls++;
          throw new Error('504 Gateway Timeout');
        }
        if (model === '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b') {
          tier2Calls++;
          return { response: 'Odpoveď z Tier 2' };
        }
        return { response: 'Odpoveď z Tier 3' };
      }
    }
  };

  const makeReq = (text) =>
    new Request('https://auru.space/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }], stream: false })
    });

  assert.equal(CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD, 3);
  for (let i = 0; i < 3; i++) {
    const res = await chatInferenceWorker.fetch(makeReq(`Test ${i + 1}`), mockEnv);
    const body = await res.json();
    assert.equal(body.model_used, '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b');
  }
  assert.equal(tier1Calls, 3);

  // 4th call: Circuit breaker is OPEN for Tier 1, so Tier 1 is not even called!
  const fourthRes = await chatInferenceWorker.fetch(makeReq('Test 4'), mockEnv);
  const fourthBody = await fourthRes.json();
  assert.equal(fourthBody.model_used, '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b');
  assert.equal(tier1Calls, 3, 'Tier 1 must be skipped while circuit breaker is open');
  assert.equal(tier2Calls, 4);

  // 3. Sliding-window SSE Leak Filter across chunk boundaries
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sseLines = [
    `data: ${JSON.stringify({ response: 'Čistá odpoveď pre Basterixa.' })}\n\n`,
    `data: ${JSON.stringify({ response: 'Únik INTERNAL_API_' })}\n\n`,
    `data: ${JSON.stringify({ response: 'SECRET v druhom chunku' })}\n\n`,
    `data: [DONE]\n\n`
  ];
  const readable = new ReadableStream({
    start(controller) {
      for (const c of sseLines) controller.enqueue(encoder.encode(c));
      controller.close();
    }
  });
  const filteredStream = readable.pipeThrough(createStreamingSanitizer());
  const reader = filteredStream.getReader();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  assert.match(output, /Čistá odpoveď pre Basterixa/);
  assert.ok(!output.includes('SECRET v druhom chunku'));
});

test('Module 4: Asynchrónny D1 Audit Ledger (ctx.waitUntil & audit_logs)', async () => {
  const sql = fs.readFileSync(path.join(trinityDir, 'migrations', '0057_audit_logs_ledger.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_logs/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs\(timestamp\)/i);

  const rows = [];
  let waitedPromise = null;
  const mockEnv = {
    ENVIRONMENT: 'production',
    DB: {
      prepare(query) {
        return {
          bind(...args) {
            return {
              async run() {
                if (query.startsWith('INSERT INTO audit_logs')) {
                  rows.push({
                    id: args[0],
                    actor: args[1],
                    environment: args[2],
                    action: args[3],
                    payload: args[4],
                    timestamp: args[5]
                  });
                }
                return { success: true };
              },
              async all() {
                return { results: rows.slice(0, args[0]) };
              }
            };
          },
          async run() {
            return { success: true };
          }
        };
      }
    }
  };
  const mockCtx = {
    waitUntil(promise) {
      waitedPromise = promise;
    }
  };

  const receipt = recordAuditLog(mockEnv, mockCtx, {
    actor: 'Basterix',
    action: 'DOMAIN_ISOLATION_LOCK',
    payload: { prod: 'auru.space', staging: 'auru.dev' }
  });
  assert.equal(receipt.dispatched, true);
  assert.ok(waitedPromise);
  await waitedPromise;

  const stored = await listAuditLogs(mockEnv, 10);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].actor, 'Basterix');
  assert.equal(stored[0].action, 'DOMAIN_ISOLATION_LOCK');
});

test('Module 5 & 6: Desktop Commander Bridge X-Trinity-Bridge-Secret & Pre-Deploy Check', async () => {
  assert.equal(verifyBridgeSecret('top-secret-ring0', 'top-secret-ring0'), true);
  assert.equal(verifyBridgeSecret('wrong', 'top-secret-ring0'), false);

  const handler = createDesktopCommanderHandler({ secret: 'top-secret-ring0' });

  // Unauthorized request
  let statusCode = 0;
  let responseBody = '';
  await handler(
    { method: 'GET', url: '/health', headers: {} },
    {
      writeHead(code) { statusCode = code; },
      end(body) { responseBody = body; }
    }
  );
  assert.equal(statusCode, 401);

  // Authorized request
  await handler(
    { method: 'GET', url: '/health', headers: { 'x-trinity-bridge-secret': 'top-secret-ring0' } },
    {
      writeHead(code) { statusCode = code; },
      end(body) { responseBody = body; }
    }
  );
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(responseBody);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.desktop_commander_status, 'online');

  // Pre-deploy check verification
  const checkResult = runPreDeployCheck();
  assert.equal(checkResult.ok, true);
  assert.equal(checkResult.production_d1, 'trinity-v03');
  assert.equal(checkResult.staging_d1, 'trinity-development');
});
