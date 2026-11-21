/**
 * @module TRINITY_OMNI_CORE
 * @subsystem INBOUND_WEBHOOKS_AND_DIRECT_LINKS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Univerzálny prijímač prichádzajúcich webhookov a linkových prepojení
 * bez nutnosti generovať manuálne API kľúče v externých aplikáciách.
 */

import { recordRequestAudit } from './ledger-middleware.js';
import { telegramToken } from './telegram-bridge.js';
import { handleViberWebhook } from './viber-bridge.js';

/**
 * Spracuje prichádzajúci webhook z ľubovoľného externého zdroja.
 * @param {Request} request
 * @param {object} env
 * @param {object} ctx
 * @param {string} source - Názov zdroja (github, stripe, make, n8n, discord, generic, atď.)
 */
export async function handleInboundWebhook(request, env, ctx, source = 'generic') {
  const url = new URL(request.url);
  const normalizedSource = String(source || 'generic').toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (normalizedSource === 'viber') {
    return handleViberWebhook(request, env, ctx);
  }

  // 1. GET požiadavky: Verifikácia webhooku (napr. Meta hub.challenge alebo Health Ping)
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
      instructions: 'Pošli HTTP POST s JSON alebo formulárovými dátami na tento endpoint pre okamžité spracovanie.'
    }, { status: 200 });
  }

  // 2. POST požiadavky: Prijatie dát
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

    // 3. Asynchrónny audit do Sovereign Ledgeru (neblokujúci)
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

    // 4. Uloženie poslednej udalosti do KV pre rýchly prístup
    const kv = env.Mastermind || env.TRINITY_KV || env.TRINITY_CONTEXT;
    if (kv && ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil((async () => {
        try {
          await kv.put(`webhook:${normalizedSource}:latest`, JSON.stringify({
            event_id: eventId,
            timestamp,
            source: normalizedSource,
            payload: typeof payload === 'object' ? payload : { text: rawText }
          }), { expirationTtl: 604800 }); // 7 dní
        } catch {}
      })());
    }

    // 5. Asynchrónna notifikácia na Telegram (ak je nastavený bot a používateľ)
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

  return Response.json({ ok: false, error: 'Metóda nie je povolená' }, { status: 405 });
}
