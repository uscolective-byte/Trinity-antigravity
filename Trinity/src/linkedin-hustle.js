/**
 * @module TRINITY_OMNI_CORE
 * @subsystem HUSTLE_AND_LINKEDIN_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Hustle revenue workspace, ethical AppSec/coding AI deal engine, and real LinkedIn OAuth/REST API connector.
 * Complies strictly with Truth Policy 2.1 — zero fabricated revenue, zero fake LinkedIn posts, encrypted token storage only.
 */
import { z } from 'zod';
import { HttpError } from './security.js';
import { resolveProviderSecret, storeSecret } from './secret-vault.js';
import { createTrinityDocument } from './trinity-documents.js';

export const DEFAULT_HUSTLE_OFFERS = Object.freeze([
  {
    id: 'hustle-web-fullstack',
    name: 'Full-Stack Kódovanie & Web na kľúč',
    category: 'coding',
    price_eur: 490,
    delivery_days: 5,
    description: 'Moderný responzívny web alebo SaaS aplikácia, API integrácie, Cloudflare Edge nasadenie a základné SEO.'
  },
  {
    id: 'hustle-appsec-audit',
    name: 'Etický Bezpečnostný Audit & Hardening (AppSec)',
    category: 'appsec',
    price_eur: 390,
    delivery_days: 3,
    description: 'Autorizovaný audit zdrojového kódu, OWASP Top 10 kontrola (auth, XSS, SQLi, SSRF, únik tajomstiev) + konkrétne opravy.'
  },
  {
    id: 'hustle-ai-automation',
    name: 'AI Automatizácia & Vlastný AI Agent',
    category: 'automation',
    price_eur: 690,
    delivery_days: 7,
    description: 'Návrh a nasadenie AI asistenta pre firmu, napojenie na CRM, webhooky, e-mail, Telegram/WhatsApp alebo LinkedIn workflow.'
  },
  {
    id: 'hustle-code-sprint',
    name: 'Rýchly Code Fix, Refactoring & Platobné Brány',
    category: 'coding',
    price_eur: 190,
    delivery_days: 2,
    description: 'Oprava kritických chýb, zrýchlenie aplikácie alebo napojenie platobných brán (SEPA QR, Revolut, PayPal, Stripe, MT5).'
  }
]);

export function validateLinkedInUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password || parsed.hash) return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== 'linkedin.com' && host !== 'www.linkedin.com') return null;
  return parsed.href;
}

export const linkedInConfigSchema = z.object({
  profile_url: z.string().trim().max(300).optional().transform((v) => (v ? v : undefined)),
  headline: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
  author_urn: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  client_id: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  access_token: z.string().trim().min(12).max(4096).optional()
}).strict();

export const linkedInPostSchema = z.object({
  text: z.string().trim().min(10).max(3000),
  share_url: z.string().trim().url().max(500).optional(),
  share_title: z.string().trim().max(160).optional(),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC'),
  publish_live: z.boolean().default(false)
}).strict();

export const hustleLeadSchema = z.object({
  client_name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).optional().default(''),
  linkedin_url: z.string().trim().max(300).optional().transform((v) => (v ? v : undefined)),
  service_id: z.string().trim().max(80).default('hustle-web-fullstack'),
  value_eur: z.number().finite().min(1).max(1000000),
  notes: z.string().trim().max(1000).optional().default('')
}).strict();

export const hustleLeadStageSchema = z.object({
  stage: z.enum(['lead', 'contacted', 'proposal', 'won', 'paid', 'lost']),
  payment_ref: z.string().trim().max(200).optional()
}).strict();

export const hustleTaskSchema = z.object({
  mode: z.enum(['code', 'appsec_audit', 'linkedin_post', 'linkedin_dm', 'proposal']).default('code'),
  prompt: z.string().trim().min(5).max(4000),
  target_client: z.string().trim().max(160).optional().default(''),
  offer_id: z.string().trim().max(80).optional().default('hustle-web-fullstack'),
  checkout_url: z.string().trim().max(500).optional().default('')
}).strict();

const readyHustleDbs = new WeakSet();
async function ensureHustleTables(env) {
  if (!env?.DB?.prepare || readyHustleDbs.has(env.DB)) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_hustle_linkedin (
      owner_id TEXT PRIMARY KEY,
      profile_url TEXT,
      headline TEXT,
      author_urn TEXT,
      profile_name TEXT,
      profile_email TEXT,
      client_id TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      last_verified_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_hustle_leads (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      company TEXT,
      linkedin_url TEXT,
      service_id TEXT NOT NULL,
      value_cents INTEGER NOT NULL,
      stage TEXT NOT NULL DEFAULT 'lead',
      payment_ref TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_hustle_posts (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'linkedin',
      text TEXT NOT NULL,
      share_url TEXT,
      visibility TEXT NOT NULL DEFAULT 'PUBLIC',
      status TEXT NOT NULL DEFAULT 'draft',
      remote_post_id TEXT,
      error_message TEXT,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
  readyHustleDbs.add(env.DB);
}

async function resolveLinkedInToken(env) {
  try {
    const token = await resolveProviderSecret(env, 'linkedin');
    if (typeof token === 'string' && token.trim().length >= 12) return token.trim();
  } catch {}
  const direct = env?.LINKEDIN_ACCESS_TOKEN || env?.LINKEDIN_TOKEN;
  if (direct && typeof direct.get === 'function') {
    try {
      const val = await direct.get();
      if (typeof val === 'string' && val.trim().length >= 12) return val.trim();
    } catch {}
  } else if (typeof direct === 'string' && direct.trim().length >= 12) {
    return direct.trim();
  }
  return null;
}

function presentLinkedIn(row, hasToken) {
  return {
    configured: Boolean(row?.profile_url || row?.author_urn || hasToken),
    has_token: Boolean(hasToken),
    verified: Boolean(row?.verified && hasToken),
    profile_url: row?.profile_url || null,
    headline: row?.headline || null,
    author_urn: row?.author_urn || null,
    profile_name: row?.profile_name || null,
    profile_email: row?.profile_email || null,
    client_id: row?.client_id || null,
    last_verified_at: row?.last_verified_at || null,
    updated_at: row?.updated_at || null,
    share_intent_base: 'https://www.linkedin.com/sharing/share-offsite/'
  };
}

export async function getLinkedInStatus(env, ownerId = 'admin') {
  await ensureHustleTables(env);
  let row = null;
  if (env?.DB?.prepare) {
    row = await env.DB.prepare('SELECT * FROM ops_hustle_linkedin WHERE owner_id=?').bind(ownerId).first();
    if (!row && ownerId !== 'admin') {
      row = await env.DB.prepare('SELECT * FROM ops_hustle_linkedin WHERE owner_id=?').bind('admin').first();
    }
  }
  const hasToken = Boolean(await resolveLinkedInToken(env));
  return presentLinkedIn(row, hasToken);
}

export async function saveLinkedInConfig(env, ownerId = 'admin', input = {}) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  await ensureHustleTables(env);
  const data = linkedInConfigSchema.parse(input);
  const existing = await env.DB.prepare('SELECT * FROM ops_hustle_linkedin WHERE owner_id=?').bind(ownerId).first();

  let profileUrl = Object.hasOwn(input, 'profile_url') ? (data.profile_url || null) : (existing?.profile_url || null);
  if (profileUrl) {
    const valid = validateLinkedInUrl(profileUrl);
    if (!valid) throw new HttpError(400, 'LinkedIn URL musí začínať https://www.linkedin.com/ alebo https://linkedin.com/.');
    profileUrl = valid;
  }

  let authorUrn = Object.hasOwn(input, 'author_urn') ? (data.author_urn || null) : (existing?.author_urn || null);
  if (authorUrn && !/^urn:li:(?:person|organization):[A-Za-z0-9_-]{3,80}$/.test(authorUrn)) {
    throw new HttpError(400, 'Neplatný formát LinkedIn Author URN (očakáva sa urn:li:person:... alebo urn:li:organization:...).');
  }

  const headline = Object.hasOwn(input, 'headline') ? (data.headline || null) : (existing?.headline || null);
  const clientId = Object.hasOwn(input, 'client_id') ? (data.client_id || null) : (existing?.client_id || null);

  let tokenStoredInVault = false;
  if (data.access_token) {
    if (typeof env.TRINITY_VAULT_KEY !== 'string') {
      throw new HttpError(503, 'Trezor tajomstiev nemá TRINITY_VAULT_KEY. Nastav LINKEDIN_ACCESS_TOKEN cez Cloudflare Secrets Store alebo nakonfiguruj TRINITY_VAULT_KEY.');
    }
    await storeSecret(env, ownerId, {
      provider: 'linkedin',
      name: 'linkedin_oauth_access_token',
      secret: data.access_token
    });
    tokenStoredInVault = true;
  }

  await env.DB.prepare(`
    INSERT INTO ops_hustle_linkedin(owner_id, profile_url, headline, author_urn, client_id, updated_at)
    VALUES(?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(owner_id) DO UPDATE SET
      profile_url=excluded.profile_url,
      headline=excluded.headline,
      author_urn=excluded.author_urn,
      client_id=excluded.client_id,
      updated_at=datetime('now')
  `).bind(ownerId, profileUrl, headline, authorUrn, clientId).run();

  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('hustle_linkedin_config_updated',?)")
    .bind(JSON.stringify({ owner_id: ownerId, has_profile_url: Boolean(profileUrl), token_stored_in_vault: tokenStoredInVault, updated_at: new Date().toISOString() })).run().catch(() => {});

  const status = await getLinkedInStatus(env, ownerId);
  return { ...status, token_stored_in_vault: tokenStoredInVault };
}

export async function verifyLinkedInConnection(env, ownerId = 'admin', { fetchImpl = globalThis.fetch } = {}) {
  await ensureHustleTables(env);
  const token = await resolveLinkedInToken(env);
  if (!token) {
    return {
      ok: false,
      verified: false,
      status: 'missing_credentials',
      error: 'Chýba LinkedIn OAuth Access Token. Ulož ho v tabe Hustle -> LinkedIn (zašifruje sa do Secret Vaultu) alebo ako LINKEDIN_ACCESS_TOKEN.',
      linkedin: await getLinkedInStatus(env, ownerId)
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  try {
    // OpenID Connect /v2/userinfo (preferred in LinkedIn OAuth 2.0)
    let res = await fetchImpl('https://api.linkedin.com/v2/userinfo', {
      headers,
      signal: AbortSignal.timeout(15000)
    });

    let profileName = null;
    let profileEmail = null;
    let authorUrn = null;

    if (res.ok) {
      const data = await res.json();
      if (data?.sub) authorUrn = `urn:li:person:${data.sub}`;
      profileName = data?.name || [data?.given_name, data?.family_name].filter(Boolean).join(' ') || null;
      profileEmail = data?.email || null;
    } else {
      // Fallback to legacy /v2/me for r_liteprofile tokens
      const meRes = await fetchImpl('https://api.linkedin.com/v2/me', {
        headers: { ...headers, 'X-Restli-Protocol-Version': '2.0.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (!meRes.ok) {
        return {
          ok: false,
          verified: false,
          status: 'provider_rejected',
          http_status: res.status,
          error: `LinkedIn API odmietlo token (HTTP ${res.status} / ${meRes.status}). Skontroluj platnosť a oprávnenia (openid, profile, w_member_social).`,
          linkedin: await getLinkedInStatus(env, ownerId)
        };
      }
      const me = await meRes.json();
      if (me?.id) authorUrn = `urn:li:person:${me.id}`;
      profileName = [me?.localizedFirstName, me?.localizedLastName].filter(Boolean).join(' ') || null;
    }

    const nowIso = new Date().toISOString();
    if (env?.DB?.prepare) {
      await env.DB.prepare(`
        INSERT INTO ops_hustle_linkedin(owner_id, author_urn, profile_name, profile_email, verified, last_verified_at, updated_at)
        VALUES(?, ?, ?, ?, 1, ?, datetime('now'))
        ON CONFLICT(owner_id) DO UPDATE SET
          author_urn=COALESCE(excluded.author_urn, ops_hustle_linkedin.author_urn),
          profile_name=COALESCE(excluded.profile_name, ops_hustle_linkedin.profile_name),
          profile_email=COALESCE(excluded.profile_email, ops_hustle_linkedin.profile_email),
          verified=1,
          last_verified_at=excluded.last_verified_at,
          updated_at=datetime('now')
      `).bind(ownerId, authorUrn, profileName, profileEmail, nowIso).run();
    }

    return {
      ok: true,
      verified: true,
      status: 'live_verified',
      verified_at: nowIso,
      linkedin: await getLinkedInStatus(env, ownerId)
    };
  } catch (err) {
    return {
      ok: false,
      verified: false,
      status: 'network_error',
      error: `Overenie LinkedIn zlyhalo: ${err?.message || 'sieťová chyba'}`,
      linkedin: await getLinkedInStatus(env, ownerId)
    };
  }
}

export async function publishLinkedInPost(env, ownerId = 'admin', input = {}, { fetchImpl = globalThis.fetch } = {}) {
  await ensureHustleTables(env);
  const data = linkedInPostSchema.parse(input);
  const postId = `li-post-${crypto.randomUUID().slice(0, 8)}`;

  const savePost = async (status, remoteId = null, errMsg = null, publishedAt = null) => {
    if (!env?.DB?.prepare) return;
    await env.DB.prepare(`
      INSERT INTO ops_hustle_posts(id, owner_id, platform, text, share_url, visibility, status, remote_post_id, error_message, published_at)
      VALUES(?, ?, 'linkedin', ?, ?, ?, ?, ?, ?, ?)
    `).bind(postId, ownerId, data.text, data.share_url || null, data.visibility, status, remoteId, errMsg, publishedAt).run();
  };

  if (!data.publish_live) {
    await savePost('draft');
    return {
      ok: true,
      published: false,
      status: 'draft',
      post_id: postId,
      share_intent_url: data.share_url
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.share_url)}`
        : 'https://www.linkedin.com/feed/?shareActive=true',
      message: 'Príspevok bol uložený ako návrh (draft). Na LinkedIn zatiaľ NEBOL zverejnený.'
    };
  }

  const token = await resolveLinkedInToken(env);
  let status = await getLinkedInStatus(env, ownerId);
  if (!token) {
    await savePost('draft', null, 'missing_linkedin_token');
    return {
      ok: false,
      published: false,
      status: 'missing_credentials',
      post_id: postId,
      error: 'Chýba LinkedIn Access Token. Príspevok bol uložený iba ako draft a NEBOL publikovaný na LinkedIn.'
    };
  }

  if (!status.author_urn) {
    const check = await verifyLinkedInConnection(env, ownerId, { fetchImpl });
    if (check.ok && check.linkedin?.author_urn) {
      status = check.linkedin;
    }
  }

  if (!status.author_urn) {
    await savePost('draft', null, 'missing_author_urn');
    return {
      ok: false,
      published: false,
      status: 'missing_author_urn',
      post_id: postId,
      error: 'Nepodarilo sa určiť LinkedIn Author URN (urn:li:person:...). Over spojenie alebo zadaj Author URN.'
    };
  }

  const shareContent = {
    shareCommentary: { text: data.text },
    shareMediaCategory: data.share_url ? 'ARTICLE' : 'NONE',
    ...(data.share_url
      ? {
          media: [
            {
              status: 'READY',
              originalUrl: data.share_url,
              title: { text: data.share_title || 'Trinity Sovereign AI & Engineering' }
            }
          ]
        }
      : {})
  };

  const payload = {
    author: status.author_urn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': data.visibility
    }
  };

  try {
    const res = await fetchImpl('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const body = await res.json().catch(() => ({}));
    const remoteId = res.headers?.get?.('x-restli-id') || body?.id || null;

    if (!res.ok || !remoteId) {
      const errMsg = body?.message || `LinkedIn API vrátilo HTTP ${res.status}`;
      await savePost('failed', null, errMsg);
      return {
        ok: false,
        published: false,
        status: 'provider_rejected',
        http_status: res.status,
        post_id: postId,
        error: `Publikovanie na LinkedIn zlyhalo: ${errMsg}`
      };
    }

    const publishedAt = new Date().toISOString();
    await savePost('published', remoteId, null, publishedAt);

    await createTrinityDocument(env, ownerId, {
      title: `LinkedIn príspevok publikovaný (${remoteId})`,
      category: 'commerce',
      step_name: 'hustle_linkedin_post',
      summary: `Príspevok úspešne publikovaný na LinkedIn (${remoteId}).`,
      content: `## LinkedIn príspevok\n\n- Remote ID: \`${remoteId}\`\n- Autor: \`${status.author_urn}\`\n- Čas: ${publishedAt}\n\n${data.text}`
    }).catch(() => {});

    return {
      ok: true,
      published: true,
      status: 'published',
      post_id: postId,
      remote_post_id: remoteId,
      published_at: publishedAt,
      _evidence: { effect: 'mutation', actions: ['linkedin_publish'], receipt_id: `linkedin:${remoteId}` }
    };
  } catch (err) {
    await savePost('failed', null, err?.message || 'network_error');
    return {
      ok: false,
      published: false,
      status: 'network_error',
      post_id: postId,
      error: `Chyba pri odosielaní na LinkedIn: ${err?.message || 'neznáma chyba'}`
    };
  }
}

export async function addHustleLead(env, ownerId = 'admin', input = {}) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  await ensureHustleTables(env);
  const data = hustleLeadSchema.parse(input);
  let liUrl = null;
  if (data.linkedin_url) {
    liUrl = validateLinkedInUrl(data.linkedin_url);
    if (!liUrl) throw new HttpError(400, 'Neplatný LinkedIn odkaz pre klienta (vyžaduje https://www.linkedin.com/...).');
  }
  const id = `LEAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const valueCents = Math.round(data.value_eur * 100);
  await env.DB.prepare(`
    INSERT INTO ops_hustle_leads(id, owner_id, client_name, company, linkedin_url, service_id, value_cents, stage, notes)
    VALUES(?, ?, ?, ?, ?, ?, ?, 'lead', ?)
  `).bind(id, ownerId, data.client_name, data.company || null, liUrl, data.service_id, valueCents, data.notes || null).run();

  return {
    ok: true,
    lead: {
      id,
      client_name: data.client_name,
      company: data.company || null,
      linkedin_url: liUrl,
      service_id: data.service_id,
      value_eur: Number((valueCents / 100).toFixed(2)),
      stage: 'lead',
      payment_ref: null,
      notes: data.notes || null
    }
  };
}

export async function updateHustleLeadStage(env, ownerId = 'admin', leadId, input = {}) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  await ensureHustleTables(env);
  const data = hustleLeadStageSchema.parse(input);
  const existing = await env.DB.prepare('SELECT * FROM ops_hustle_leads WHERE id=? AND owner_id=?').bind(leadId, ownerId).first();
  if (!existing) throw new HttpError(404, 'Lead neexistuje.');
  if (data.stage === 'paid' && (!data.payment_ref || data.payment_ref.trim().length < 3)) {
    throw new HttpError(400, 'Pre označenie obchodu ako zaplateného (paid) zadaj dôkaz / referenciu platby (Truth Policy 2.1).');
  }

  await env.DB.prepare(`
    UPDATE ops_hustle_leads
    SET stage=?, payment_ref=COALESCE(?, payment_ref), updated_at=datetime('now')
    WHERE id=? AND owner_id=?
  `).bind(data.stage, data.payment_ref || null, leadId, ownerId).run();

  return {
    ok: true,
    id: leadId,
    stage: data.stage,
    payment_ref: data.payment_ref || existing.payment_ref || null
  };
}

export async function deleteHustleLead(env, ownerId = 'admin', leadId) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  await ensureHustleTables(env);
  const res = await env.DB.prepare('DELETE FROM ops_hustle_leads WHERE id=? AND owner_id=?').bind(leadId, ownerId).run();
  if ((res?.meta?.changes ?? 0) === 0) throw new HttpError(404, 'Lead neexistuje.');
  return { ok: true, id: leadId, deleted: true };
}

export async function getHustleOverview(env, ownerId = 'admin') {
  await ensureHustleTables(env);
  const linkedin = await getLinkedInStatus(env, ownerId);

  let leads = [];
  let posts = [];
  if (env?.DB?.prepare) {
    leads = (await env.DB.prepare('SELECT * FROM ops_hustle_leads WHERE owner_id=? ORDER BY updated_at DESC LIMIT 50').bind(ownerId).all()).results || [];
    posts = (await env.DB.prepare('SELECT * FROM ops_hustle_posts WHERE owner_id=? ORDER BY created_at DESC LIMIT 25').bind(ownerId).all()).results || [];
  }

  const mappedLeads = leads.map((l) => ({
    id: l.id,
    client_name: l.client_name,
    company: l.company || null,
    linkedin_url: l.linkedin_url || null,
    service_id: l.service_id,
    value_eur: Number(((l.value_cents || 0) / 100).toFixed(2)),
    stage: l.stage,
    payment_ref: l.payment_ref || null,
    notes: l.notes || null,
    created_at: l.created_at,
    updated_at: l.updated_at
  }));

  const verifiedEarnedCents = leads
    .filter((l) => l.stage === 'paid' && l.payment_ref)
    .reduce((sum, l) => sum + (l.value_cents || 0), 0);

  const activePipelineCents = leads
    .filter((l) => ['lead', 'contacted', 'proposal', 'won'].includes(l.stage))
    .reduce((sum, l) => sum + (l.value_cents || 0), 0);

  const publishedPostsCount = posts.filter((p) => p.status === 'published').length;

  return {
    ok: true,
    metrics: {
      verified_earned_eur: Number((verifiedEarnedCents / 100).toFixed(2)),
      pipeline_eur: Number((activePipelineCents / 100).toFixed(2)),
      leads_count: mappedLeads.length,
      published_posts_count: publishedPostsCount,
      draft_posts_count: posts.filter((p) => p.status === 'draft').length
    },
    linkedin,
    offers: DEFAULT_HUSTLE_OFFERS,
    leads: mappedLeads,
    posts,
    truth_policy: 'Overený zárobok počíta výlučne obchody v stave paid s dôkazom platby. Príspevky sa na LinkedIn publikujú až po overení OAuth tokenu a tvojom kliknutí na Publikovať.'
  };
}

const HUSTLE_SYSTEM_PROMPTS = Object.freeze({
  code: 'Si Hustle Trinity — elitný full-stack softvérový architekt a vývojár pre Basterixa. Píšeš čistý, priamo nasaditeľný produkčný kód (JS/TS/HTML/CSS/Python/SQL/Cloudflare Workers) bez zbytočných omáčok, vždy po slovensky v komentároch/popise a pripravený na fakturáciu klientovi.',
  appsec_audit: 'Si Hustle Trinity — etický AppSec špecialista a bezpečnostný audítor. Vykonávaš výlučne legálny, autorizovaný obranný bezpečnostný audit (OWASP Top 10, kontrola autentifikácie, XSS, SQLi, SSRF, únik tajomstiev, bezpečnostné hlavičky) a poskytuješ konkrétne hardening patche. Nikdy nepíšeš škodlivý kód ani návody na neautorizované útoky.',
  linkedin_post: 'Si Hustle Trinity — B2B copywriter pre LinkedIn. Napíš pútavý, autentický, odborný LinkedIn príspevok po slovensky (max 1800 znakov) bez prázdnych fráz a bez vymyslených čísel tržieb. Pridaj jasnú výzvu k akcii (CTA) a relevantné hashtagy.',
  linkedin_dm: 'Si Hustle Trinity — B2B obchodný stratég. Napíš krátku, personalizovanú, neinvazívnu správu pre LinkedIn (max 600 znakov) po slovensky, ktorá ponúka konkrétnu technickú hodnotu (web, AppSec audit, AI automatizácia) bez spamu a bez falošných sľubov.',
  proposal: 'Si Hustle Trinity — technický obchodník. Priprav jasnú, profesionálnu cenovú ponuku po slovensky: rozsah dodávky, technický stack, harmonogram, cenu v EUR a ďalší krok na zaplatenie.'
});

export async function runHustleTrinityTask(env, ownerId = 'admin', input = {}) {
  const data = hustleTaskSchema.parse(input);
  const offer = DEFAULT_HUSTLE_OFFERS.find((o) => o.id === data.offer_id) || DEFAULT_HUSTLE_OFFERS[0];
  const systemPrompt = HUSTLE_SYSTEM_PROMPTS[data.mode] || HUSTLE_SYSTEM_PROMPTS.code;

  const userPrompt = [
    `Režim: ${data.mode}`,
    `Služba: ${offer.name} (${offer.price_eur} EUR, dodanie ~${offer.delivery_days} dní)`,
    data.target_client ? `Cieľový klient / firma: ${data.target_client}` : '',
    data.checkout_url ? `Platobný / kontaktný link: ${data.checkout_url}` : '',
    `Zadanie: ${data.prompt}`
  ].filter(Boolean).join('\n');

  let output = null;
  let modelUsed = null;
  let aiGenerated = false;

  if (env?.AI?.run) {
    try {
      const model = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
      const aiRes = await env.AI.run(model, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1400,
        temperature: data.mode === 'code' || data.mode === 'appsec_audit' ? 0.2 : 0.6
      });
      const text = aiRes?.response || aiRes?.choices?.[0]?.message?.content || '';
      if (typeof text === 'string' && text.trim().length > 0) {
        output = text.trim();
        modelUsed = model;
        aiGenerated = true;
      }
    } catch {}
  }

  if (!output) {
    // Honest deterministic structured brief when live LLM binding is unavailable
    if (data.mode === 'linkedin_post') {
      output = `Hľadáš spoľahlivého partnera na ${offer.name}?\n\nZadanie: ${data.prompt}\n\n✅ Čo dodám:\n• ${offer.description}\n• Orientačná cena balíka: ${offer.price_eur} EUR (dodanie do ${offer.delivery_days} pracovných dní)\n• Transparentné overenie výsledkov bez prázdnych sľubov\n\n${data.checkout_url ? `📩 Priamy odkaz na objednávku / kontakt: ${data.checkout_url}\n\n` : '📩 Napíš mi priamo správu tu na LinkedIn a dohodneme krátky call.\n\n'}#webdevelopment #appsec #ai #automatizacia #freelance`;
    } else if (data.mode === 'linkedin_dm') {
      output = `Ahoj${data.target_client ? ` ${data.target_client}` : ''}, všimol som si váš projekt (${data.prompt}). Venujem sa službe ${offer.name} (${offer.price_eur} EUR). Ak by vám pomohol rýchly nezáväzný technický pohľad alebo konkrétny návrh riešenia, rád pošlem krátky prehľad.${data.checkout_url ? ` Info: ${data.checkout_url}` : ''}`;
    } else if (data.mode === 'appsec_audit') {
      output = `## Etický AppSec Audit & Hardening Checklist\n\n**Rozsah (iba autorizované ciele):** ${data.prompt}\n**Služba:** ${offer.name} (${offer.price_eur} EUR)\n\n1. **Autentifikácia a oprávnenia (OWASP A01/A07):** Overenie serverových tokenov, ochrana admin/owner rout, zákaz dôvery klientskym hlavičkám.\n2. **Injekcie & XSS (OWASP A03):** Parametrizované SQL dotazy, escapovanie HTML/JS v šablónach, prísna CSP hlavička.\n3. **Tajomstvá & SSRF (OWASP A02/A10):** Kontrola git histórie na API kľúče, šifrované uloženie tokenov, blokovanie privátnych IP/metadata endpointov.\n4. **Výstup pre klienta:** Zoznam nálezov podľa závažnosti (P0–P2) + overené patche a regresné testy.`;
    } else {
      output = `## Technický návrh & Dodávka (${offer.name})\n\n**Zadanie:** ${data.prompt}\n**Balík:** ${offer.name} · **${offer.price_eur} EUR** (~${offer.delivery_days} dní)\n${data.target_client ? `**Klient:** ${data.target_client}\n` : ''}\n### Plán realizácie\n1. Technická špecifikácia a architektúra\n2. Implementácia čistého kódu + bezpečnostné kontroly\n3. Automatizované testy a nasadenie do produkcie\n${data.checkout_url ? `\n**Platobný odkaz:** ${data.checkout_url}` : ''}`;
    }
    modelUsed = 'deterministic-template (Workers AI unavailable)';
  }

  return {
    ok: true,
    mode: data.mode,
    ai_generated: aiGenerated,
    model: modelUsed,
    offer,
    output,
    can_publish_to_linkedin: data.mode === 'linkedin_post',
    generated_at: new Date().toISOString()
  };
}
