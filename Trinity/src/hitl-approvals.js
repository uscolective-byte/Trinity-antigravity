/**
 * @module TRINITY_OMNI_CORE
 * @subsystem HUMAN_IN_THE_LOOP_APPROVALS
 * @author Basterix (Root Architect)
 * @license TRINITY-COMMERCIAL-2.0
 * @description Human-in-the-Loop (HITL) mobilné schvaľovanie cez Telegram inline tlačidlá, e-mail (Resend)
 * a chránenú webovú stránku (/approve/:id) pre citlivé akcie a programatické vydávanie kľúčov/licencií.
 */
import { z } from 'zod';
import { hash, equal, HttpError } from './security.js';
import { createApiKey } from './api-keys.js';
import { issueLicenseGrant } from './compliance-shield.js';
import { approveSystemAction, rejectSystemAction } from './system-actions.js';
import { storeSecret, resolveProviderSecret } from './secret-vault.js';

export const HITL_ACTION_TYPES = [
  'provision_trinity_api_key',
  'issue_license',
  'provision_cloudflare_token',
  'provision_openai_project_key',
  'system_action',
  'custom_operation'
];

export const createHitlRequestSchema = z.object({
  action_type: z.enum(HITL_ACTION_TYPES).default('custom_operation'),
  title: z.string().trim().min(3).max(160),
  rationale: z.string().trim().min(3).max(1500),
  payload: z.record(z.string(), z.unknown()).default({}),
  ttl_minutes: z.number().int().min(1).max(1440).default(30)
}).strict();

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ownerEmail(env) {
  return String(env?.TRINITY_OWNER_EMAIL || 'saboivan2008@gmail.com').trim().toLowerCase();
}

function parseTelegramAllowedIds(env) {
  return String(env?.TELEGRAM_ALLOWED_USER_IDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^-?\d{3,20}$/.test(x));
}

function sanitizeApprovalRow(row) {
  if (!row) return null;
  let payload = {};
  let result = null;
  try { payload = JSON.parse(row.payload_json || '{}'); } catch {}
  try { result = row.result_json ? JSON.parse(row.result_json) : null; } catch {}
  return {
    id: row.id,
    action_type: row.action_type,
    title: row.title,
    rationale: row.rationale,
    payload,
    requested_by: row.requested_by,
    status: row.status,
    decision_by: row.decision_by || null,
    decision_channel: row.decision_channel || null,
    result,
    error_message: row.error_message || null,
    telegram_chat_id: row.telegram_chat_id || null,
    telegram_message_id: row.telegram_message_id || null,
    expires_at: row.expires_at,
    created_at: row.created_at,
    decided_at: row.decided_at || null,
    executed_at: row.executed_at || null
  };
}

export async function sendTelegramApprovalPrompt(env, record, approveUrl) {
  const token = typeof env?.TELEGRAM_BOT_TOKEN === 'string' ? env.TELEGRAM_BOT_TOKEN.trim() : '';
  const targets = parseTelegramAllowedIds(env);
  if (!token || !targets.length) {
    return { sent: false, reason: !token ? 'Chýba TELEGRAM_BOT_TOKEN' : 'Chýba TELEGRAM_ALLOWED_USER_IDS' };
  }
  const chatId = targets[0];
  const expiresIso = new Date(record.expires_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
  const text =
    `🔐 TRINITY HITL SCHVÁLENIE\n` +
    `• Akcia: ${record.title}\n` +
    `• Typ: ${record.action_type}\n` +
    `• Žiadateľ: ${record.requested_by}\n` +
    `• Účel: ${String(record.rationale || '').slice(0, 500)}\n` +
    `• ID: ${record.id}\n` +
    `• Platné do: ${expiresIso}\n\n` +
    `Vyber akciu nižšie alebo potvrď cez web na auru.space:`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Schváliť & Vykonať', callback_data: `hitl:approve:${record.id}` },
              { text: '❌ Zamietnuť', callback_data: `hitl:reject:${record.id}` }
            ],
            [
              { text: '🌐 Otvoriť v prehliadači', url: approveUrl }
            ]
          ]
        }
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      return { sent: false, reason: `Telegram HTTP ${response.status}` };
    }
    const msgId = data?.result?.message_id || null;
    if (msgId && env?.DB?.prepare) {
      await env.DB.prepare('UPDATE ops_hitl_approvals SET telegram_chat_id=?, telegram_message_id=? WHERE id=?')
        .bind(String(chatId), Number(msgId), record.id)
        .run()
        .catch(() => {});
    }
    return { sent: true, chat_id: String(chatId), message_id: msgId };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'Telegram request failed' };
  }
}

export async function updateTelegramApprovalCard(env, record, summaryText) {
  const token = typeof env?.TELEGRAM_BOT_TOKEN === 'string' ? env.TELEGRAM_BOT_TOKEN.trim() : '';
  const chatId = record?.telegram_chat_id || parseTelegramAllowedIds(env)[0];
  if (!token || !chatId) return { updated: false };
  try {
    if (record?.telegram_message_id) {
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: Number(record.telegram_message_id),
          text: String(summaryText).slice(0, 3900)
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(10000)
      });
      return { updated: true, mode: 'editMessageText' };
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: String(summaryText).slice(0, 3900) }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });
    return { updated: true, mode: 'sendMessage' };
  } catch {
    return { updated: false };
  }
}

export async function sendEmailApprovalNotification(env, record, approveUrl) {
  const resendKey = typeof env?.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  const to = ownerEmail(env);
  if (!resendKey || !to) {
    return { sent: false, reason: !resendKey ? 'RESEND_API_KEY nie je nastavený' : 'Chýba TRINITY_OWNER_EMAIL' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'Trinity HITL <onboarding@resend.dev>',
        to: [to],
        subject: `[Trinity Schválenie] ${record.title}`,
        html: `<div style="font-family:Inter,Arial,sans-serif;background:#09090b;color:#f4f4f5;padding:24px;border-radius:12px;">
          <h2 style="margin:0 0 12px;">🔐 Požiadavka na schválenie akcie</h2>
          <p><strong>Akcia:</strong> ${esc(record.title)}</p>
          <p><strong>Typ:</strong> ${esc(record.action_type)}</p>
          <p><strong>Účel:</strong> ${esc(record.rationale)}</p>
          <p style="margin-top:20px;"><a href="${esc(approveUrl)}" style="background:#f4f4f5;color:#09090b;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Otvoriť schválenie na auru.space ↗</a></p>
        </div>`
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { sent: false, reason: `Resend HTTP ${response.status}` };
    return { sent: true, to };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'Resend failed' };
  }
}

export async function createHitlApproval(env, { requestUrl, requestedBy = 'trinity', input }) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  const data = createHitlRequestSchema.parse(input);
  const id = crypto.randomUUID();
  const rawToken = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
  const tokenHash = await hash(rawToken);
  const expiresAt = Date.now() + data.ttl_minutes * 60_000;

  await env.DB.prepare(
    `INSERT INTO ops_hitl_approvals
      (id, action_type, title, rationale, payload_json, requested_by, status, approval_token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(
    id,
    data.action_type,
    data.title,
    data.rationale,
    JSON.stringify(data.payload || {}),
    String(requestedBy || 'trinity').slice(0, 120),
    tokenHash,
    expiresAt
  ).run();

  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('hitl_approval_requested', ?)")
    .bind(JSON.stringify({ id, action_type: data.action_type, requested_by: requestedBy }))
    .run()
    .catch(() => {});

  const origin = requestUrl ? new URL(requestUrl).origin : 'https://auru.space';
  const approveUrl = `${origin}/approve/${id}`;
  const record = await getHitlApproval(env, id);

  const [telegram, email] = await Promise.all([
    sendTelegramApprovalPrompt(env, record, approveUrl),
    sendEmailApprovalNotification(env, record, approveUrl)
  ]);

  const refreshed = await getHitlApproval(env, id);
  return {
    approval: refreshed,
    approve_url: approveUrl,
    channels: { telegram, email }
  };
}

export async function getHitlApproval(env, id) {
  if (!env?.DB?.prepare) return null;
  const row = await env.DB.prepare('SELECT * FROM ops_hitl_approvals WHERE id=?').bind(id).first();
  if (!row) return null;
  if (row.status === 'pending' && Number(row.expires_at) <= Date.now()) {
    await env.DB.prepare("UPDATE ops_hitl_approvals SET status='expired' WHERE id=? AND status='pending'").bind(id).run().catch(() => {});
    row.status = 'expired';
  }
  return sanitizeApprovalRow(row);
}

export async function listHitlApprovals(env, { limit = 30 } = {}) {
  if (!env?.DB?.prepare) return [];
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  await env.DB.prepare("UPDATE ops_hitl_approvals SET status='expired' WHERE status='pending' AND expires_at<=?").bind(Date.now()).run().catch(() => {});
  const res = await env.DB.prepare('SELECT * FROM ops_hitl_approvals ORDER BY created_at DESC LIMIT ?').bind(safeLimit).all();
  return (res.results || []).map(sanitizeApprovalRow);
}

async function executeApprovedHitlPayload(env, record, actor) {
  const payload = record.payload || {};
  const ownerId = ownerEmail(env);

  if (record.action_type === 'provision_trinity_api_key') {
    const created = await createApiKey(env, ownerId, {
      name: String(payload.name || `HITL Key ${record.id.slice(0, 8)}`).slice(0, 80),
      scopes: Array.isArray(payload.scopes) && payload.scopes.length ? payload.scopes : ['api:invoke'],
      rate_limit_per_minute: Number(payload.rate_limit_per_minute || 60),
      expires_at: payload.expires_at || null
    });
    let vaultId = null;
    if (typeof env.TRINITY_VAULT_KEY === 'string' && env.TRINITY_VAULT_KEY) {
      const stored = await storeSecret(env, ownerId, {
        provider: 'custom',
        name: `trinity-api:${created.name}`,
        secret: created.secret
      });
      vaultId = stored.id;
    }
    return {
      executed: true,
      action_type: record.action_type,
      key_id: created.id,
      key_prefix: created.key_prefix,
      scopes: created.scopes,
      vault_secret_id: vaultId,
      note: 'Trinity API kľúč bol vygenerovaný (hodnota nebola zobrazená v logoch).'
    };
  }

  if (record.action_type === 'issue_license') {
    const grant = await issueLicenseGrant(env, actor || ownerId, {
      subject_id: String(payload.subject_id || ownerId),
      tier: payload.tier || 'pro_studio',
      expires_days: payload.expires_days ?? 365
    });
    return {
      executed: true,
      action_type: record.action_type,
      grant_id: grant.id,
      license_prefix: grant.license_prefix,
      tier: grant.tier,
      subject_id: grant.subject_id,
      expires_at: grant.expires_at
    };
  }

  if (record.action_type === 'provision_openai_project_key') {
    const adminKey =
      (typeof env?.OPENAI_ADMIN_KEY === 'string' && env.OPENAI_ADMIN_KEY.trim()) ||
      (await resolveProviderSecret(env, 'openai_admin').catch(() => null));
    const projectId = String(payload.project_id || env?.OPENAI_PROJECT_ID || '').trim();
    if (!adminKey) {
      throw new HttpError(503, 'Chýba OPENAI_ADMIN_KEY (Organization Admin Key) na programatické vytvorenie projektového OpenAI kľúča.');
    }
    if (!projectId) {
      throw new HttpError(400, 'Chýba payload.project_id (alebo env.OPENAI_PROJECT_ID) pre OpenAI projekt.');
    }
    const keyName = String(payload.name || `trinity-hitl-${record.id.slice(0, 8)}`).slice(0, 64);
    const resp = await fetch(`https://api.openai.com/v1/organization/projects/${encodeURIComponent(projectId)}/api_keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: keyName }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
    const body = await resp.json().catch(() => null);
    if (!resp.ok || !body?.value) {
      throw new HttpError(502, `OpenAI API odmietlo vytvorenie kľúča (HTTP ${resp.status}): ${body?.error?.message || 'over oprávnenia Admin kľúča'}`);
    }
    let vaultId = null;
    if (typeof env.TRINITY_VAULT_KEY === 'string' && env.TRINITY_VAULT_KEY) {
      const stored = await storeSecret(env, ownerId, {
        provider: 'openai',
        name: keyName,
        secret: String(body.value)
      });
      vaultId = stored.id;
    }
    return {
      executed: true,
      action_type: record.action_type,
      openai_key_id: body.id || null,
      key_name: keyName,
      redacted_value: body.redacted_value || null,
      vault_secret_id: vaultId
    };
  }

  if (record.action_type === 'provision_cloudflare_token') {
    const cfToken =
      (typeof env?.CLOUDFLARE_API_TOKEN === 'string' && env.CLOUDFLARE_API_TOKEN.trim()) ||
      (typeof env?.CF_API_TOKEN === 'string' && env.CF_API_TOKEN.trim()) ||
      (await resolveProviderSecret(env, 'cloudflare').catch(() => null));
    if (!cfToken) {
      throw new HttpError(503, 'Chýba CF_API_TOKEN / CLOUDFLARE_API_TOKEN na vytvorenie sub-tokenu.');
    }
    const tokenName = String(payload.name || `trinity-scoped-${record.id.slice(0, 8)}`).slice(0, 80);
    const policies = Array.isArray(payload.policies) && payload.policies.length ? payload.policies : null;
    if (!policies) {
      throw new HttpError(400, 'Chýba payload.policies (zoznam permission groups pre Cloudflare API Token).');
    }
    const resp = await fetch('https://api.cloudflare.com/client/v4/user/tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: tokenName, policies }),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || data?.success !== true || !data?.result?.value) {
      const errMsg = data?.errors?.[0]?.message || `HTTP ${resp.status}`;
      throw new HttpError(502, `Cloudflare API nevytvorilo token: ${errMsg}`);
    }
    let vaultId = null;
    if (typeof env.TRINITY_VAULT_KEY === 'string' && env.TRINITY_VAULT_KEY) {
      const stored = await storeSecret(env, ownerId, {
        provider: 'cloudflare',
        name: tokenName,
        secret: String(data.result.value)
      });
      vaultId = stored.id;
    }
    return {
      executed: true,
      action_type: record.action_type,
      cf_token_id: data.result.id,
      token_name: tokenName,
      vault_secret_id: vaultId
    };
  }

  if (record.action_type === 'system_action') {
    const actionId = payload.system_action_id;
    if (!actionId) throw new HttpError(400, 'Chýba payload.system_action_id.');
    const approved = await approveSystemAction(env, String(actionId), actor || ownerId);
    return {
      executed: true,
      action_type: record.action_type,
      system_action_id: approved.id,
      system_action_status: approved.status
    };
  }

  return {
    executed: true,
    action_type: 'custom_operation',
    approved_payload: payload,
    note: 'Vlastná operácia bola schválená vlastníkom Trinity.'
  };
}

export async function decideAndExecuteHitlApproval(env, { id, decision, actor = 'owner', channel = 'web' }) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  const normalizedDecision = String(decision || '').toLowerCase();
  if (!['approve', 'reject'].includes(normalizedDecision)) {
    throw new HttpError(400, 'Neplatné rozhodnutie (povoľuje sa iba approve alebo reject).');
  }

  const now = Date.now();
  const targetStatus = normalizedDecision === 'approve' ? 'executing' : 'rejected';
  const claimed = await env.DB.prepare(
    `UPDATE ops_hitl_approvals
     SET status=?, decision_by=?, decision_channel=?, decided_at=datetime('now')
     WHERE id=? AND status='pending' AND expires_at > ?
     RETURNING *`
  ).bind(targetStatus, actor, channel, id, now).first();

  if (!claimed) {
    const existing = await getHitlApproval(env, id);
    if (!existing) throw new HttpError(404, 'Požiadavka na schválenie neexistuje.');
    throw new HttpError(409, `Požiadavka už bola spracovaná alebo vypršala (stav: ${existing.status}).`);
  }

  const record = sanitizeApprovalRow(claimed);

  if (normalizedDecision === 'reject') {
    if (record.action_type === 'system_action' && record.payload?.system_action_id) {
      await rejectSystemAction(env, String(record.payload.system_action_id), actor).catch(() => {});
    }
    await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('hitl_approval_rejected', ?)")
      .bind(JSON.stringify({ id, action_type: record.action_type, decision_by: actor, channel }))
      .run()
      .catch(() => {});
    await updateTelegramApprovalCard(
      env,
      record,
      `❌ ZAMIETNUTÉ (${channel})\n• Akcia: ${record.title}\n• Schvaľovateľ: ${actor}\n• ID: ${record.id}`
    );
    return await getHitlApproval(env, id);
  }

  try {
    const execResult = await executeApprovedHitlPayload(env, record, actor);
    await env.DB.prepare(
      `UPDATE ops_hitl_approvals
       SET status='executed', result_json=?, error_message=NULL, executed_at=datetime('now')
       WHERE id=?`
    ).bind(JSON.stringify(execResult), id).run();

    await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('hitl_approval_executed', ?)")
      .bind(JSON.stringify({ id, action_type: record.action_type, decision_by: actor, channel }))
      .run()
      .catch(() => {});

    await updateTelegramApprovalCard(
      env,
      record,
      `✅ SCHVÁLENÉ & VYKONANÉ (${channel})\n• Akcia: ${record.title}\n• Schvaľovateľ: ${actor}\n• Výsledok: ${execResult.note || execResult.key_prefix || execResult.license_prefix || execResult.openai_key_id || 'Hotovo'}\n• ID: ${record.id}`
    );
    return await getHitlApproval(env, id);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `UPDATE ops_hitl_approvals
       SET status='failed', error_message=?, executed_at=datetime('now')
       WHERE id=?`
    ).bind(errMessage.slice(0, 800), id).run();

    await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('hitl_approval_failed', ?)")
      .bind(JSON.stringify({ id, action_type: record.action_type, error: errMessage.slice(0, 300) }))
      .run()
      .catch(() => {});

    await updateTelegramApprovalCard(
      env,
      record,
      `⚠️ SCHVÁLENÉ, ALE VYKONANIE ZLYHALO (${channel})\n• Akcia: ${record.title}\n• Chyba: ${errMessage.slice(0, 400)}\n• ID: ${record.id}`
    );
    return await getHitlApproval(env, id);
  }
}

export async function verifyHitlAccessToken(env, id, suppliedToken) {
  if (!suppliedToken || !env?.DB?.prepare) return false;
  const row = await env.DB.prepare('SELECT approval_token_hash FROM ops_hitl_approvals WHERE id=?').bind(id).first();
  if (!row?.approval_token_hash) return false;
  const digest = await hash(String(suppliedToken));
  return await equal(digest, String(row.approval_token_hash));
}

export function renderHitlApproveHtml({ record = null, host = 'auru.space', authenticatedOwner = false, ownerMail = '', message = '', error = '' } = {}) {
  const safeHost = esc(host);
  const title = record ? esc(record.title) : 'Trinity · Autorizačná brána';
  const statusLabels = {
    pending: 'Čaká na potvrdenie vlastníka',
    executing: 'Práve sa vykonáva',
    executed: 'Schválené a úspešne vykonané',
    rejected: 'Zamietnuté vlastníkom',
    failed: 'Schválené, ale vykonanie zlyhalo',
    expired: 'Platnosť požiadavky vypršala'
  };

  let bodyHtml = '';
  if (!authenticatedOwner) {
    bodyHtml = `<div class="card">
      <div class="eyebrow">HUMAN-IN-THE-LOOP AUTORIZÁCIA</div>
      <h1>Vyžaduje sa prihlásenie vlastníka</h1>
      <p class="lead">Prístup k schvaľovaniu citlivých akcií na doméne <strong>${safeHost}</strong> má výlučne vlastník Trinity (${esc(ownerMail)}).</p>
      <div class="actions">
        <a class="btn primary" href="/">Prihlásiť sa do Trinity Studio</a>
      </div>
    </div>`;
  } else if (!record) {
    bodyHtml = `<div class="card">
      <div class="eyebrow">HITL AUTORIZÁCIA</div>
      <h1>Požiadavka sa nenašla</h1>
      <p class="lead">${esc(error || 'Zadané ID požiadavky v D1 databáze neexistuje.')}</p>
      <div class="actions"><a class="btn" href="/#settings">Späť do Governance</a></div>
    </div>`;
  } else {
    const canDecide = record.status === 'pending';
    bodyHtml = `<div class="card">
      <div class="eyebrow">HUMAN-IN-THE-LOOP · ${esc(record.action_type)}</div>
      <h1>${esc(record.title)}</h1>
      <div class="status-pill status-${esc(record.status)}">${esc(statusLabels[record.status] || record.status)}</div>
      ${message ? `<div class="notice ok">${esc(message)}</div>` : ''}
      ${error || record.error_message ? `<div class="notice err">${esc(error || record.error_message)}</div>` : ''}
      <dl class="meta">
        <dt>Účel požiadavky</dt><dd>${esc(record.rationale)}</dd>
        <dt>Žiadateľ</dt><dd>${esc(record.requested_by)}</dd>
        <dt>Parametre (JSON)</dt><dd><code>${esc(JSON.stringify(record.payload || {}))}</code></dd>
        <dt>ID akcie</dt><dd><code>${esc(record.id)}</code></dd>
        ${record.decision_by ? `<dt>Rozhodol</dt><dd>${esc(record.decision_by)} (${esc(record.decision_channel || 'web')})</dd>` : ''}
        ${record.result ? `<dt>Výsledok vykonania</dt><dd><code>${esc(JSON.stringify(record.result))}</code></dd>` : ''}
      </dl>
      ${canDecide ? `<form method="POST" action="/api/approve/${esc(record.id)}" class="actions">
        <button type="submit" name="decision" value="approve" class="btn primary">✅ Schváliť &amp; Vykonať</button>
        <button type="submit" name="decision" value="reject" class="btn danger">❌ Zamietnuť</button>
      </form>` : `<div class="actions"><a class="btn" href="/#settings">Späť do Trinity Governance</a></div>`}
    </div>`;
  }

  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark;}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;}
  .card{width:100%;max-width:560px;background:#141418;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.5);}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a1a1aa;margin-bottom:8px;}
  h1{margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em;}
  .lead{color:#a1a1aa;font-size:14px;line-height:1.6;}
  .status-pill{display:inline-block;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;margin-bottom:16px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);}
  .status-pending{color:#fbbf24;border-color:rgba(251,191,36,0.35);}
  .status-executed{color:#34d399;border-color:rgba(52,211,153,0.35);}
  .status-rejected,.status-failed,.status-expired{color:#f87171;border-color:rgba(248,113,113,0.35);}
  .notice{padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:14px;border:1px solid rgba(255,255,255,0.1);}
  .notice.ok{background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.35);color:#6ee7b7;}
  .notice.err{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.35);color:#fca5a5;}
  dl.meta{margin:0 0 20px;display:grid;gap:10px;}
  dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717a;}
  dd{margin:2px 0 0;font-size:14px;color:#e4e4e7;word-break:break-word;}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:rgba(255,255,255,0.06);padding:3px 6px;border-radius:6px;display:inline-block;max-width:100%;overflow-wrap:anywhere;}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;}
  .btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:10px;font-size:14px;font-weight:600;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#f4f4f5;text-decoration:none;cursor:pointer;}
  .btn.primary{background:#f4f4f5;color:#09090b;border-color:#f4f4f5;}
  .btn.danger{background:rgba(239,68,68,0.15);color:#fca5a5;border-color:rgba(239,68,68,0.4);}
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
