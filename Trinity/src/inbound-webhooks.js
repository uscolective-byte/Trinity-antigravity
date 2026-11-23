/**
 * @module TRINITY_OMNI_CORE
 * @subsystem INBOUND_WEBHOOKS_AND_DIRECT_LINKS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Universal receiver for inbound webhooks and direct link integrations
 * without requiring manual API keys in external applications.
 */

import { recordRequestAudit } from './ledger-middleware.js';
import { telegramToken } from './telegram-bridge.js';
import { handleViberWebhook } from './viber-bridge.js';

/**
 * Process an inbound webhook from any external source.
 * @param {Request} request
 * @param {object} env
 * @param {object} ctx
 * @param {string} source - Source name (github, stripe, make, n8n, discord, generic, etc.)
 */
export async function handleInboundWebhook(request, env, ctx, source = 'generic') {
  const url = new URL(request.url);
  const normalizedSource = String(source || 'generic').toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (normalizedSource === 'viber') {
    return handleViberWebhook(request, env, ctx);
  }

  // 1. GET requests: Webhook verification (e.g., Meta hub.challenge or Health Ping)
  if (request.method === 'GET') {
    const hubChallenge = url.searchParams.get('hub.challenge');
    if (hubChallenge) {
      return new Response(hubChallenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    return Response.json({
      ok: true,
      service: 'Trinity Inbound Webhook Hub',
      source: normalizedSource,
      status: 'ready',
      endpoint: `https://${url.hostname}/api/v1/webhooks/${normalizedSource}`,
      instructions: 'Send an HTTP POST with JSON or form data to this endpoint for immediate processing.'
    }, { status: 200 });
  }

  // 2. POST requests: Payload ingestion
  if (request.method === 'POST') {
    let payload = null;
    let rawText = '';

    try {
      rawText = await request.text();
      if (rawText && rawText.trim()) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = { text: rawText };
        }
      } else {
        payload = {};
      }
    } catch (err) {
      payload = { error: String(err?.message || err) };
    }

    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // 3. Asynchronous audit into Sovereign Ledger (non-blocking)
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil((async () => {
        try {
          if (typeof recordRequestAudit === 'function') {
            await recordRequestAudit({
              request,
              response: { status: 200 },
              env,
              ctx,
              pathname: `/api/v1/webhooks/${normalizedSource}`,
              method: 'POST',
              durationMs: 5
            });
          }
        } catch (auditErr) {
          console.error('[WEBHOOK AUDIT ERROR]', auditErr);
        }
      })());
    }

    // 4. Persist latest event in KV for quick inspection
    const kv = env.Mastermind || env.TRINITY_KV || env.TRINITY_CONTEXT;
    if (kv && ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil((async () => {
        try {
          await kv.put(`webhook:${normalizedSource}:latest`, JSON.stringify({
            event_id: eventId,
            timestamp,
            source: normalizedSource,
            payload: typeof payload === 'object' ? payload : { text: rawText }
          }), { expirationTtl: 604800 }); // 7 days
        } catch {}
      })());
    }

    // 5. Asynchronous Telegram notification to the owner (user-facing message stays in Slovak)
    const tgBotToken = telegramToken(env);
    const tgUserId = env.TELEGRAM_ALLOWED_USER_IDS || '8358735041';
    if (tgBotToken && tgUserId && ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil((async () => {
        try {
          let summary = '';
          if (typeof payload === 'object') {
            const previewKeys = Object.keys(payload).slice(0, 5).join(', ');
            summary = `Kľúče: ${previewKeys}`;
          } else {
            summary = String(rawText).slice(0, 120);
          }

          const messageText = `🔔 *[Trinity Webhook: ${normalizedSource.toUpperCase()}]*\n` +
            `Prijatá nová udalosť o ${new Date().toLocaleTimeString('sk-SK')}.\n` +
            `ID: \`${eventId.slice(0, 8)}\`\n` +
            `Obsah: ${summary}`;

          await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgUserId.split(',')[0].trim(),
              text: messageText,
              parse_mode: 'Markdown'
            })
          });
        } catch (tgErr) {
          console.error('[WEBHOOK TELEGRAM NOTIFY ERROR]', tgErr);
        }
      })());
    }

    return Response.json({
      ok: true,
      event_id: eventId,
      source: normalizedSource,
      received_at: timestamp,
      status: 'PROCESSED'
    }, { status: 200 });
  }

  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}
