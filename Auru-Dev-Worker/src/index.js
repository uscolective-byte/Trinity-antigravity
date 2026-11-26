/**
 * @module AURU_DEV_WORKER
 * @description Standalone Cloudflare Worker for auru.dev, separated from main Trinity (auru.space).
 * Serves the clean Obsidian & Champagne Atelier UI and proxies allowlisted API routes
 * privately to TRINITY_CORE via Cloudflare Service Binding RPC (fail-closed 503 when unbound).
 */

import { INDEX_HTML } from './assets/index-html.js';
import { ATELIER_CSS } from './assets/atelier-css.js';
import { APP_JS } from './assets/app-js.js';
import { MANIFEST_JSON, SW_JS, TETRAKIS_EMBLEM_SVG } from './assets/static-assets.js';

const SERVICE_VERSION = '1.0.0';

const ALLOWED_PROXY_PREFIXES = [
  '/api/',
  '/pay/',
  '/tetrakis-logo.png',
  '/legal',
  '/terms',
  '/privacy',
  '/aup',
  '/license'
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Trinity-Host': 'auru.dev',
  'X-Worker-Role': 'auru-dev-standalone'
};

const HTML_CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com data:; " +
  "img-src 'self' data: blob: https:; " +
  "connect-src 'self' https:; " +
  "base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...extraHeaders
    }
  });
}

function deploymentMeta(env) {
  const meta = env?.CF_VERSION_METADATA;
  if (!meta) return null;
  return {
    id: meta.id || null,
    tag: meta.tag || null,
    timestamp: meta.timestamp || null
  };
}

function isAllowedProxyPath(pathname) {
  return ALLOWED_PROXY_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix
  );
}

async function handleProbe(pathname, env) {
  const bound = Boolean(env?.TRINITY_CORE && typeof env.TRINITY_CORE.fetch === 'function');
  let coreHealth = null;
  if (bound) {
    try {
      const res = await env.TRINITY_CORE.fetch(new Request('https://trinity-core.internal/health'));
      coreHealth = res.ok ? await res.json().catch(() => ({ ok: true })) : { ok: false, status: res.status };
    } catch (err) {
      coreHealth = { ok: false, error: err?.message || 'RPC error' };
    }
  }

  const basePayload = {
    ok: true,
    service: 'AuruDev',
    version: env?.VERSION || SERVICE_VERSION,
    environment: env?.ENVIRONMENT || 'production',
    domain: 'auru.dev',
    separated_from_trinity: true,
    trinity_core_bound: bound,
    trinity_core_origin: env?.TRINITY_CORE_ORIGIN || 'https://auru.space',
    source: {
      repository: env?.TRINITY_GITHUB_REPO || 'uscolective-byte/Trinity-antigravity',
      branch: env?.TRINITY_GITHUB_BRANCH || 'main'
    },
    deployment: deploymentMeta(env),
    truth_mode: 'evidence-required'
  };

  if (pathname === '/ready') {
    const ready = bound && Boolean(coreHealth?.ok);
    return json(
      {
        ...basePayload,
        ok: ready,
        ready,
        core_status: coreHealth || { ok: false, reason: 'TRINITY_CORE binding not configured' }
      },
      ready ? 200 : 503
    );
  }

  return json({
    ...basePayload,
    core_status: coreHealth || { ok: false, reason: 'TRINITY_CORE binding not configured' }
  });
}

async function proxyToTrinityCore(request, url, env) {
  if (!env?.TRINITY_CORE || typeof env.TRINITY_CORE.fetch !== 'function') {
    return json(
      {
        ok: false,
        error: 'TRINITY_CORE service binding is not configured on auru-dev Worker.',
        truth_mode: 'evidence-required',
        separated_from_trinity: true
      },
      503
    );
  }

  const forwardUrl = new URL(url.pathname + url.search, 'https://trinity-core.internal');
  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Auru-Dev-Proxy', '1');

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    const upstream = await env.TRINITY_CORE.fetch(new Request(forwardUrl.toString(), init));
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('X-Trinity-Core-Proxied', 'true');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: 'TRINITY_CORE RPC request failed: ' + (err?.message || 'unknown error'),
        truth_mode: 'evidence-required'
      },
      502
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && ['/health', '/api/health', '/ready'].includes(path)) {
      return handleProbe(path, env);
    }

    if (request.method === 'GET' && (path === '/' || path === '/index.html' || path === '/chat')) {
      return new Response(INDEX_HTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Security-Policy': HTML_CSP,
          ...SECURITY_HEADERS
        }
      });
    }

    if (request.method === 'GET' && path === '/atelier.css') {
      return new Response(ATELIER_CSS, {
        status: 200,
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate',
          ...SECURITY_HEADERS
        }
      });
    }

    if (request.method === 'GET' && path === '/app.js') {
      return new Response(APP_JS, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate',
          ...SECURITY_HEADERS
        }
      });
    }

    if (request.method === 'GET' && path === '/manifest.json') {
      return new Response(MANIFEST_JSON, {
        status: 200,
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          ...SECURITY_HEADERS
        }
      });
    }

    if (request.method === 'GET' && path === '/sw.js') {
      return new Response(SW_JS, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate',
          ...SECURITY_HEADERS
        }
      });
    }

    if (request.method === 'GET' && path === '/tetrakis-emblem.svg') {
      return new Response(TETRAKIS_EMBLEM_SVG, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          ...SECURITY_HEADERS
        }
      });
    }

    if (isAllowedProxyPath(path)) {
      return proxyToTrinityCore(request, url, env);
    }

    return json(
      {
        ok: false,
        error: 'Not found on standalone auru-dev Worker.',
        path
      },
      404
    );
  }
};
