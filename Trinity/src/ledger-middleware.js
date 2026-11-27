/**
 * TRINITY OMNI-CORE - Sovereign Ledger Audit Middleware & Endpoint Handlers
 * Automatic request auditing, block-chain integrity verification, and ledger querying.
 */

import { SovereignLedgerEngine } from './sovereign-ledger-mmr.js';

const AUDITED_PATHS = [
  '/api/assistant/evolution/run',
  '/api/assistant/self-improvement',
  '/api/assistant/system/self-evolve',
  '/api/system/actions',
  '/api/system/actions/claim',
  '/api/execute-privileged',
  '/api/bridge/execute',
  '/api/pc-bridge',
  '/api/mcp/invoke',
  '/api/assistant/domains/environments/deploy',
  '/api/assistant/domains/register',
  '/api/assistant/wallet/terminal/charge',
  '/api/assistant/wallet/terminal/payout',
  '/api/assistant/wallet/terminal/confirm',
  '/api/assistant/wallet/mt5/order',
  '/api/assistant/hustle/linkedin/post',
  '/api/assistant/hustle/leads'
];

export function shouldAuditRequest(pathname, method) {
  if (!pathname) return false;
  if (pathname.startsWith('/api/audit-ledger')) return false;
  if (method === 'OPTIONS' || method === 'HEAD') return false;
  return AUDITED_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function resolveLedgerDatabase(env) {
  return env?.DB || env?.TRINITY_D1 || env?.rea || null;
}

export function resolveVerifiedActor(user) {
  if (!user || typeof user !== 'object') return null;
  const candidate = user.username || user.email || user.id || user.actor;
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return null;
}

export function extractActorFromRequest(_request, user = null) {
  const verified = resolveVerifiedActor(user);
  if (verified) {
    return verified;
  }
  return 'unauthenticated';
}

export async function recordRequestAudit({ request, response, env, ctx, pathname, method, durationMs, errorMessage = null, user = null, actor: explicitActor = null }) {
  const db = resolveLedgerDatabase(env);
  if (!db) {
    console.warn('[LEDGER AUDIT] No D1 binding (DB / TRINITY_D1) is available; skipping automatic audit write.');
    return null;
  }

  const ledger = new SovereignLedgerEngine(env, db);
  const actor = (typeof explicitActor === 'string' && explicitActor.trim().length > 0)
    ? explicitActor.trim()
    : extractActorFromRequest(request, user);
  const statusCode = response ? response.status : 500;
  const outcome = !errorMessage && statusCode >= 200 && statusCode < 400 ? 'SUCCESS' : 'FAILURE';
  const operation = `HTTP_${method.toUpperCase()}_${pathname.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')}`;

  const payload = {
    method: method.toUpperCase(),
    pathname,
    statusCode,
    outcome,
    durationMs,
    userAgent: request.headers.get('User-Agent') || 'unknown',
    cfRay: request.headers.get('CF-Ray') || null,
    error: errorMessage || null
  };

  const writePromise = ledger.appendRecord({
    actor,
    operation,
    payload
  }).catch((err) => {
    console.error('[LEDGER AUDIT ERROR] Automatic write to Sovereign Ledger failed:', err.message);
    return null;
  });

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(writePromise);
    return null;
  }

  return await writePromise;
}

export async function handleAuditLedgerRoutes(request, env, url, user = null) {
  const verifiedActor = resolveVerifiedActor(user);
  if (!verifiedActor) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Sign in to Trinity.'
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = resolveLedgerDatabase(env);
  if (!db) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'D1 database for Sovereign Ledger is not bound in this environment.'
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const ledger = new SovereignLedgerEngine(env, db);

  if (url.pathname === '/api/audit-ledger/verify' && request.method === 'GET') {
    const verification = await ledger.verifyChainIntegrity();
    return new Response(
      JSON.stringify({
        success: Boolean(verification.valid),
        timestamp: new Date().toISOString(),
        verification
      }),
      {
        status: verification.valid ? 200 : 409,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  if (url.pathname === '/api/audit-ledger' && request.method === 'GET') {
    const rawLimit = Number(url.searchParams.get('limit') || '50');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500) : 50;

    try {
      const rowsResult = await db
        .prepare(
          `SELECT block_id, timestamp, actor, operation, previous_hash, current_hash, payload
           FROM trinity_sovereign_ledger_v3
           ORDER BY block_id DESC
           LIMIT ?`
        )
        .bind(limit)
        .all();

      const blocks = (rowsResult?.results || []).map((row) => {
        let parsedPayload = row.payload;
        try {
          parsedPayload = JSON.parse(row.payload);
        } catch (_) {
          // Preserve raw string if payload is not valid JSON
        }
        return {
          blockId: row.block_id,
          timestamp: row.timestamp,
          actor: row.actor,
          operation: row.operation,
          previousHash: row.previous_hash,
          currentHash: row.current_hash,
          payload: parsedPayload
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          count: blocks.length,
          limit,
          blocks
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to read blocks from Sovereign Ledger: ${err.message}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (url.pathname === '/api/audit-ledger/append' && request.method === 'POST') {
    if (!['admin', 'owner'].includes(user?.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Táto operácia je dostupná iba správcovi Trinity.'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const actor = verifiedActor;
      const operation = typeof body?.operation === 'string' && body.operation.trim() ? body.operation.trim() : null;
      const payload = body?.payload ?? {};

      if (!operation) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parameter "operation" is required.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const appended = await ledger.appendRecord({ actor, operation, payload });
      return new Response(
        JSON.stringify({
          success: true,
          record: appended
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Write to Sovereign Ledger failed: ${err.message}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return null;
}
