import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';

const WORKER_DIR = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = resolve(WORKER_DIR, '..');

function parseJsonc(raw) {
  return JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
}

test('Auru-Dev-Worker serves Obsidian & Champagne Atelier UI with strict CSP and zero TON leaks', async () => {
  const res = await worker.fetch(new Request('https://auru.dev/'), {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.equal(res.headers.get('x-worker-role'), 'auru-dev-standalone');
  assert.match(res.headers.get('content-security-policy') || '', /fonts\.googleapis\.com/);
  assert.match(res.headers.get('content-security-policy') || '', /fonts\.gstatic\.com/);

  const html = await res.text();
  assert.match(html, /Auru Dev · Obsidian Atelier/);
  assert.match(html, /Tetrakis Space · \$TTK/);
  assert.match(html, /\/tetrakis-logo\.png/);
  assert.equal(/\.ton-|--ton-|TON Space|Tonkeeper/i.test(html), false, 'UI must contain zero TON branding');

  const cssRes = await worker.fetch(new Request('https://auru.dev/atelier.css'), {});
  assert.equal(cssRes.status, 200);
  const css = await cssRes.text();
  assert.match(css, /--bg-deep:\s*#09090b/);
  assert.match(css, /--gold:\s*#d6b676/);
  assert.match(css, /\[data-theme="light"\]/);

  const jsRes = await worker.fetch(new Request('https://auru.dev/app.js'), {});
  assert.equal(jsRes.status, 200);
  const js = await jsRes.text();
  assert.match(js, /\/api\/assistant\/chat/);
  assert.match(js, /\/api\/assistant\/crypto\/tetrakis/);
  assert.match(js, /\/api\/assistant\/ai-studio\/co-create/);
});

test('Auru-Dev-Worker fails closed (503) on /ready and /api/* when TRINITY_CORE binding is absent', async () => {
  const health = await worker.fetch(new Request('https://auru.dev/health'), {});
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.service, 'AuruDev');
  assert.equal(healthBody.separated_from_trinity, true);
  assert.equal(healthBody.trinity_core_bound, false);

  const ready = await worker.fetch(new Request('https://auru.dev/ready'), {});
  assert.equal(ready.status, 503);
  const readyBody = await ready.json();
  assert.equal(readyBody.ready, false);

  const apiRes = await worker.fetch(new Request('https://auru.dev/api/assistant/session'), {});
  assert.equal(apiRes.status, 503);
  const apiBody = await apiRes.json();
  assert.equal(apiBody.separated_from_trinity, true);
});

test('Auru-Dev-Worker proxies allowlisted /api/* routes via TRINITY_CORE RPC and blocks unknown paths', async () => {
  const calls = [];
  const mockEnv = {
    ENVIRONMENT: 'production',
    TRINITY_CORE: {
      async fetch(req) {
        calls.push({ url: req.url, method: req.method, forwardedHost: req.headers.get('X-Forwarded-Host') });
        const u = new URL(req.url);
        if (u.pathname === '/health') return Response.json({ ok: true, service: 'Trinity' });
        return Response.json({ ok: true, proxied: u.pathname });
      }
    }
  };

  const ready = await worker.fetch(new Request('https://auru.dev/ready'), mockEnv);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).ready, true);

  const apiRes = await worker.fetch(new Request('https://auru.dev/api/assistant/crypto/tetrakis'), mockEnv);
  assert.equal(apiRes.status, 200);
  assert.equal(apiRes.headers.get('x-trinity-core-proxied'), 'true');
  assert.equal(calls.at(-1).forwardedHost, 'auru.dev');

  const notFound = await worker.fetch(new Request('https://auru.dev/unknown-path'), mockEnv);
  assert.equal(notFound.status, 404);
});

test('Wrangler domain separation: auru.dev belongs exclusively to Auru-Dev-Worker and auru.space to Trinity', () => {
  const auruCfg = parseJsonc(readFileSync(resolve(WORKER_DIR, 'wrangler.jsonc'), 'utf8'));
  const trinityCfg = parseJsonc(readFileSync(resolve(REPO_ROOT, 'Trinity/wrangler.jsonc'), 'utf8'));

  assert.equal(auruCfg.name, 'auru-dev');
  assert.deepEqual(auruCfg.routes, [{ pattern: 'auru.dev', custom_domain: true }]);
  assert.equal(auruCfg.d1_databases, undefined, 'Auru-Dev-Worker must not share mutable D1 bindings');

  assert.equal(trinityCfg.name, 'trinity');
  assert.deepEqual(trinityCfg.routes, [{ pattern: 'auru.space', custom_domain: true }]);
  assert.equal(
    trinityCfg.routes.some((r) => r.pattern === 'auru.dev'),
    false,
    'Main Trinity Worker must not route auru.dev after separation'
  );
});
