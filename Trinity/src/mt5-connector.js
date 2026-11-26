/**
 * @module TRINITY_OMNI_CORE
 * @subsystem METATRADER5_WALLET_BRIDGE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description MetaTrader 5 (MT5) wallet & trading account connector supporting MetaApi Cloud REST and custom HTTPS MT5 bridges.
 * Complies strictly with Truth Policy 2.1 — zero fabricated balances, positions, or executions; API tokens are stored encrypted in Secret Vault only.
 */
import { z } from 'zod';
import { HttpError } from './security.js';
import { resolveProviderSecret, storeSecret } from './secret-vault.js';
import { createTrinityDocument } from './trinity-documents.js';

export const MT5_METAAPI_REGIONS = Object.freeze([
  'new-york',
  'london',
  'singapore',
  'vint-hill',
  'tokyo',
  'frankfurt',
  'agiliumtrade'
]);

const optionalStr = (max) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export function validateMt5BridgeUrl(raw) {
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
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^169\.254\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return null;
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

export const mt5ConfigSchema = z.object({
  mode: z.enum(['metaapi', 'bridge']).default('metaapi'),
  broker: optionalStr(120),
  server: optionalStr(120),
  login: optionalStr(40),
  account_id: optionalStr(120),
  region: z.enum(MT5_METAAPI_REGIONS).default('new-york'),
  bridge_url: optionalStr(500),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('EUR'),
  account_type: z.enum(['demo', 'live']).default('demo'),
  allow_trade_execution: z.boolean().default(false),
  api_token: z.string().trim().min(8).max(4096).optional()
}).strict();

export const mt5OrderSchema = z.object({
  symbol: z.string().trim().toUpperCase().min(2).max(24).regex(/^[A-Z0-9._/-]+$/),
  action: z.enum(['ORDER_TYPE_BUY', 'ORDER_TYPE_SELL']),
  volume: z.number().finite().positive().max(100),
  stop_loss: z.number().finite().positive().optional(),
  take_profit: z.number().finite().positive().optional(),
  comment: z.string().trim().max(100).optional(),
  confirm_live_execution: z.boolean().default(false)
}).strict();

const readyMt5Dbs = new WeakSet();
async function ensureMt5Tables(env) {
  if (!env?.DB?.prepare || readyMt5Dbs.has(env.DB)) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ops_wallet_mt5 (
      owner_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'metaapi',
      broker TEXT,
      server TEXT,
      login TEXT,
      account_id TEXT,
      region TEXT NOT NULL DEFAULT 'new-york',
      bridge_url TEXT,
      currency TEXT NOT NULL DEFAULT 'EUR',
      account_type TEXT NOT NULL DEFAULT 'demo',
      allow_trade_execution INTEGER NOT NULL DEFAULT 0,
      last_verified_at TEXT,
      last_snapshot_json TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  readyMt5Dbs.add(env.DB);
}

function maskLogin(login) {
  if (!login) return null;
  const s = String(login).trim();
  if (s.length <= 4) return '••••';
  return `${s.slice(0, 2)}••••${s.slice(-2)}`;
}

function maskAccountId(accountId) {
  if (!accountId) return null;
  const s = String(accountId).trim();
  if (s.length <= 8) return `${s.slice(0, 2)}...${s.slice(-2)}`;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function metaApiBaseUrl(region) {
  if (region === 'agiliumtrade') return 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai';
  return `https://mt-client-api-v1.${encodeURIComponent(region || 'new-york')}.agiliumtrade.ai`;
}

function safeJsonParse(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function resolveMt5Token(env) {
  try {
    const token = await resolveProviderSecret(env, 'metatrader5');
    if (typeof token === 'string' && token.trim().length >= 8) return token.trim();
  } catch {}
  const direct = env?.MT5_API_TOKEN || env?.METAAPI_TOKEN || env?.METATRADER5_TOKEN;
  if (direct && typeof direct.get === 'function') {
    try {
      const val = await direct.get();
      if (typeof val === 'string' && val.trim().length >= 8) return val.trim();
    } catch {}
  } else if (typeof direct === 'string' && direct.trim().length >= 8) {
    return direct.trim();
  }
  return null;
}

function presentMt5Row(row, hasToken) {
  const snapshot = safeJsonParse(row?.last_snapshot_json);
  const mode = row?.mode === 'bridge' ? 'bridge' : 'metaapi';
  const hasEndpoint = mode === 'metaapi' ? Boolean(row?.account_id) : Boolean(row?.bridge_url);
  const configured = Boolean(row && hasEndpoint);
  return {
    configured,
    connected: Boolean(configured && hasToken && snapshot?.verified === true),
    has_token: Boolean(hasToken),
    mode,
    platform: 'MT5',
    broker: row?.broker || null,
    server: row?.server || null,
    login: row?.login || null,
    login_masked: maskLogin(row?.login),
    account_id: row?.account_id || null,
    account_id_masked: maskAccountId(row?.account_id),
    region: row?.region || 'new-york',
    bridge_url: row?.bridge_url || null,
    currency: row?.currency || snapshot?.account?.currency || 'EUR',
    account_type: row?.account_type || 'demo',
    allow_trade_execution: Boolean(row?.allow_trade_execution),
    last_verified_at: row?.last_verified_at || null,
    updated_at: row?.updated_at || null,
    snapshot: snapshot || null,
    truth_policy: 'Overené dáta z MetaTrader 5 API (MetaApi alebo HTTPS MT5 Bridge). Bez overeného spojenia Trinity nikdy nevymýšľa zostatok ani pozície.'
  };
}

export async function getMt5Config(env, ownerId = 'admin') {
  await ensureMt5Tables(env);
  let row = null;
  if (env?.DB?.prepare) {
    row = await env.DB.prepare('SELECT * FROM ops_wallet_mt5 WHERE owner_id=?').bind(ownerId).first();
    if (!row && ownerId !== 'admin') {
      row = await env.DB.prepare('SELECT * FROM ops_wallet_mt5 WHERE owner_id=?').bind('admin').first();
    }
  }
  const token = await resolveMt5Token(env);
  return presentMt5Row(row, Boolean(token));
}

export async function saveMt5Config(env, ownerId = 'admin', input = {}) {
  if (!env?.DB?.prepare) throw new HttpError(503, 'Databáza D1 nie je pripojená.');
  await ensureMt5Tables(env);
  const data = mt5ConfigSchema.parse(input);
  const existing = await env.DB.prepare('SELECT * FROM ops_wallet_mt5 WHERE owner_id=?').bind(ownerId).first();

  const pick = (key, nextVal, fallback) => (Object.hasOwn(input, key) ? (nextVal ?? null) : (fallback ?? null));

  const mode = Object.hasOwn(input, 'mode') ? data.mode : (existing?.mode || data.mode);
  const broker = pick('broker', data.broker, existing?.broker);
  const server = pick('server', data.server, existing?.server);
  const login = pick('login', data.login, existing?.login);
  const accountId = pick('account_id', data.account_id, existing?.account_id);
  const region = Object.hasOwn(input, 'region') ? data.region : (existing?.region || data.region);
  const rawBridgeUrl = pick('bridge_url', data.bridge_url, existing?.bridge_url);
  let bridgeUrl = null;
  if (rawBridgeUrl) {
    bridgeUrl = validateMt5BridgeUrl(rawBridgeUrl);
    if (!bridgeUrl) {
      throw new HttpError(400, 'MT5 Bridge URL musí byť verejná HTTPS adresa bez lokálnych/privátnych IP a prihlasovacích údajov v URL.');
    }
  }
  if (mode === 'metaapi' && !accountId) {
    throw new HttpError(400, 'Pre režim MetaApi Cloud zadaj platné MetaApi Account ID.');
  }
  if (mode === 'bridge' && !bridgeUrl) {
    throw new HttpError(400, 'Pre režim MT5 Bridge zadaj platnú HTTPS adresu tvojho MT5 mosta.');
  }

  const currency = Object.hasOwn(input, 'currency') ? data.currency : (existing?.currency || data.currency);
  const accountType = Object.hasOwn(input, 'account_type') ? data.account_type : (existing?.account_type || data.account_type);
  const allowTrade = Object.hasOwn(input, 'allow_trade_execution')
    ? (data.allow_trade_execution ? 1 : 0)
    : (existing?.allow_trade_execution ?? 0);

  let tokenStoredInVault = false;
  if (data.api_token) {
    if (typeof env.TRINITY_VAULT_KEY !== 'string') {
      throw new HttpError(503, 'Trezor tajomstiev nemá TRINITY_VAULT_KEY. Nastav MT5_API_TOKEN cez Cloudflare Secrets Store alebo nakonfiguruj TRINITY_VAULT_KEY.');
    }
    await storeSecret(env, ownerId, {
      provider: 'metatrader5',
      name: `mt5_${mode}_${accountType}`,
      secret: data.api_token
    });
    tokenStoredInVault = true;
  }

  await env.DB.prepare(`
    INSERT INTO ops_wallet_mt5(
      owner_id, mode, broker, server, login, account_id, region, bridge_url, currency, account_type, allow_trade_execution, updated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(owner_id) DO UPDATE SET
      mode=excluded.mode,
      broker=excluded.broker,
      server=excluded.server,
      login=excluded.login,
      account_id=excluded.account_id,
      region=excluded.region,
      bridge_url=excluded.bridge_url,
      currency=excluded.currency,
      account_type=excluded.account_type,
      allow_trade_execution=excluded.allow_trade_execution,
      updated_at=datetime('now')
  `).bind(ownerId, mode, broker, server, login, accountId, region, bridgeUrl, currency, accountType, allowTrade).run();

  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('wallet_mt5_config_updated',?)")
    .bind(JSON.stringify({ owner_id: ownerId, mode, broker, server, account_type: accountType, allow_trade_execution: Boolean(allowTrade), token_stored_in_vault: tokenStoredInVault, updated_at: new Date().toISOString() })).run().catch(() => {});

  await createTrinityDocument(env, ownerId, {
    title: 'Konfigurácia MetaTrader 5 (MT5) v Peňaženke',
    category: 'commerce',
    step_name: 'wallet_mt5_config',
    summary: `Uložené nastavenie MetaTrader 5 (${mode}, ${accountType}, broker: ${broker || 'neuvedený'}). Token nikdy nie je uložený v nešifrovanom texte.`,
    content: `## MetaTrader 5 (MT5) Konfigurácia\n\n- Režim: \`${mode}\`\n- Typ účtu: \`${accountType}\`\n- Broker: ${broker || '—'}\n- Server: ${server || '—'}\n- Login: \`${maskLogin(login) || '—'}\`\n- Account ID: \`${maskAccountId(accountId) || '—'}\`\n- Región: \`${region}\`\n- Bridge URL: \`${bridgeUrl || '—'}\`\n- Vykonávanie pokynov: ${allowTrade ? 'povolené s explicitným potvrdením' : 'zakázané (len čítanie)'}\n- Čas: ${new Date().toISOString()}\n\nToto je iba konfigurácia pripojenia; pre živé dáta spusti synchronizáciu MT5.`
  }).catch(() => {});

  const result = await getMt5Config(env, ownerId);
  return { ...result, token_stored_in_vault: tokenStoredInVault };
}

function normalizePosition(pos) {
  return {
    id: String(pos.id ?? pos.ticket ?? ''),
    symbol: String(pos.symbol || ''),
    type: String(pos.type || ''),
    volume: Number(pos.volume ?? 0),
    open_price: Number(pos.openPrice ?? pos.open_price ?? 0),
    current_price: Number(pos.currentPrice ?? pos.current_price ?? 0),
    profit: Number(pos.profit ?? 0),
    swap: Number(pos.swap ?? 0),
    commission: Number(pos.commission ?? 0),
    stop_loss: pos.stopLoss ?? pos.stop_loss ?? null,
    take_profit: pos.takeProfit ?? pos.take_profit ?? null,
    time: pos.time || pos.open_time || null
  };
}

function normalizeAccountInfo(raw, fallbackCurrency = 'EUR') {
  const balance = Number(raw?.balance);
  const equity = Number(raw?.equity);
  if (!Number.isFinite(balance) || !Number.isFinite(equity)) {
    throw new Error('MT5 API nevrátilo platné číselné polia balance a equity.');
  }
  return {
    platform: String(raw?.platform || 'mt5').toUpperCase(),
    broker: raw?.broker || null,
    server: raw?.server || null,
    login: raw?.login != null ? String(raw.login) : null,
    name: raw?.name || null,
    currency: String(raw?.currency || fallbackCurrency || 'EUR').toUpperCase(),
    leverage: Number.isFinite(Number(raw?.leverage)) ? Number(raw.leverage) : null,
    balance: Number(balance.toFixed(2)),
    equity: Number(equity.toFixed(2)),
    margin: Number.isFinite(Number(raw?.margin)) ? Number(Number(raw.margin).toFixed(2)) : 0,
    free_margin: Number.isFinite(Number(raw?.freeMargin ?? raw?.free_margin)) ? Number(Number(raw.freeMargin ?? raw.free_margin).toFixed(2)) : 0,
    margin_level: Number.isFinite(Number(raw?.marginLevel ?? raw?.margin_level)) ? Number(Number(raw.marginLevel ?? raw.margin_level).toFixed(2)) : null,
    unrealized_pnl: Number((equity - balance).toFixed(2)),
    type: raw?.type || null
  };
}

export async function fetchMt5AccountSnapshot(env, ownerId = 'admin', { fetchImpl = globalThis.fetch } = {}) {
  const cfg = await getMt5Config(env, ownerId);
  if (!cfg.configured) {
    return {
      ok: false,
      verified: false,
      connected: false,
      status: 'needs_configuration',
      error: 'MetaTrader 5 nie je nakonfigurovaný. Nastav MetaApi Account ID alebo HTTPS MT5 Bridge URL v peňaženke.',
      config: cfg
    };
  }

  const token = await resolveMt5Token(env);
  if (!token) {
    return {
      ok: false,
      verified: false,
      connected: false,
      status: 'missing_credentials',
      error: 'Chýba MT5 API token. Ulož ho do šifrovaného Trezora tajomstiev (provider: metatrader5) alebo cez MT5_API_TOKEN.',
      config: cfg
    };
  }

  const headers = cfg.mode === 'metaapi'
    ? { 'auth-token': token, Accept: 'application/json' }
    : { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const base = cfg.mode === 'metaapi'
    ? `${metaApiBaseUrl(cfg.region)}/users/current/accounts/${encodeURIComponent(cfg.account_id)}`
    : cfg.bridge_url;

  const accountUrl = cfg.mode === 'metaapi' ? `${base}/account-information` : `${base}/account`;
  const positionsUrl = `${base}/positions`;
  const ordersUrl = `${base}/orders`;

  try {
    const [accRes, posRes, ordRes] = await Promise.all([
      fetchImpl(accountUrl, { headers, signal: AbortSignal.timeout(15000) }),
      fetchImpl(positionsUrl, { headers, signal: AbortSignal.timeout(15000) }).catch(() => null),
      fetchImpl(ordersUrl, { headers, signal: AbortSignal.timeout(15000) }).catch(() => null)
    ]);

    if (!accRes.ok) {
      const errText = await accRes.text().catch(() => '');
      return {
        ok: false,
        verified: false,
        connected: false,
        status: 'provider_error',
        http_status: accRes.status,
        error: `MT5 API vrátilo HTTP ${accRes.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`,
        config: cfg
      };
    }

    const rawAccount = await accRes.json();
    const account = normalizeAccountInfo(rawAccount, cfg.currency);
    const rawPositions = posRes && posRes.ok ? await posRes.json().catch(() => []) : [];
    const rawOrders = ordRes && ordRes.ok ? await ordRes.json().catch(() => []) : [];
    const positions = Array.isArray(rawPositions) ? rawPositions.slice(0, 100).map(normalizePosition) : [];
    const orders = Array.isArray(rawOrders) ? rawOrders.slice(0, 100) : [];
    const syncedAt = new Date().toISOString();

    const snapshot = {
      verified: true,
      source: cfg.mode === 'metaapi' ? `MetaApi Cloud (${cfg.region})` : 'MT5 Custom HTTPS Bridge',
      synced_at: syncedAt,
      account,
      positions_count: positions.length,
      open_orders_count: orders.length,
      positions,
      orders
    };

    if (env?.DB?.prepare) {
      await env.DB.prepare(`
        UPDATE ops_wallet_mt5
        SET last_verified_at=?, last_snapshot_json=?, currency=?, broker=COALESCE(?, broker), server=COALESCE(?, server), updated_at=datetime('now')
        WHERE owner_id=?
      `).bind(syncedAt, JSON.stringify(snapshot), account.currency, account.broker, account.server, ownerId).run().catch(() => {});
    }

    return {
      ok: true,
      verified: true,
      connected: true,
      status: 'live_verified',
      synced_at: syncedAt,
      snapshot,
      config: await getMt5Config(env, ownerId)
    };
  } catch (err) {
    return {
      ok: false,
      verified: false,
      connected: false,
      status: 'network_error',
      error: `Spojenie na MT5 zlyhalo: ${err?.message || 'neznáma chyba'}`,
      config: cfg
    };
  }
}

export async function getMt5History(env, ownerId = 'admin', { days = 30, fetchImpl = globalThis.fetch } = {}) {
  const cfg = await getMt5Config(env, ownerId);
  if (!cfg.configured) throw new HttpError(400, 'MetaTrader 5 nie je nakonfigurovaný.');
  const token = await resolveMt5Token(env);
  if (!token) throw new HttpError(503, 'Chýba MT5 API token.');

  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const endIso = new Date().toISOString();
  const startIso = new Date(Date.now() - safeDays * 86400_000).toISOString();

  const headers = cfg.mode === 'metaapi'
    ? { 'auth-token': token, Accept: 'application/json' }
    : { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const url = cfg.mode === 'metaapi'
    ? `${metaApiBaseUrl(cfg.region)}/users/current/accounts/${encodeURIComponent(cfg.account_id)}/history-deals/time/${encodeURIComponent(startIso)}/${encodeURIComponent(endIso)}`
    : `${cfg.bridge_url}/history?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;

  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new HttpError(502, `MT5 história vrátila HTTP ${res.status}.`);
  }
  const deals = await res.json().catch(() => []);
  return {
    ok: true,
    verified: true,
    period_days: safeDays,
    start: startIso,
    end: endIso,
    deals_count: Array.isArray(deals) ? deals.length : 0,
    deals: Array.isArray(deals) ? deals.slice(0, 200) : []
  };
}

export async function prepareMt5TradeOrder(env, ownerId = 'admin', input = {}, { fetchImpl = globalThis.fetch } = {}) {
  const order = mt5OrderSchema.parse(input);
  const cfg = await getMt5Config(env, ownerId);
  if (!cfg.configured) throw new HttpError(400, 'MetaTrader 5 nie je nakonfigurovaný.');

  const proposal = {
    symbol: order.symbol,
    actionType: order.action,
    volume: order.volume,
    ...(order.stop_loss != null ? { stopLoss: order.stop_loss } : {}),
    ...(order.take_profit != null ? { takeProfit: order.take_profit } : {}),
    ...(order.comment ? { comment: order.comment } : {})
  };

  if (!cfg.allow_trade_execution || order.confirm_live_execution !== true) {
    return {
      ok: true,
      executed: false,
      status: 'proposal_only',
      account_type: cfg.account_type,
      allow_trade_execution: cfg.allow_trade_execution,
      proposal,
      message: !cfg.allow_trade_execution
        ? 'MT5 účet je v režime len na čítanie (allow_trade_execution=false). Obchod nebol odoslaný.'
        : 'Obchodný pokyn je pripravený ako návrh. Pre skutočné odoslanie vyžaduje explicitné confirm_live_execution=true.'
    };
  }

  const token = await resolveMt5Token(env);
  if (!token) throw new HttpError(503, 'Chýba MT5 API token pre vykonanie pokynu.');

  const headers = cfg.mode === 'metaapi'
    ? { 'auth-token': token, 'Content-Type': 'application/json', Accept: 'application/json' }
    : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  const url = cfg.mode === 'metaapi'
    ? `${metaApiBaseUrl(cfg.region)}/users/current/accounts/${encodeURIComponent(cfg.account_id)}/trade`
    : `${cfg.bridge_url}/trade`;

  const res = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(proposal),
    signal: AbortSignal.timeout(15000)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      executed: false,
      status: 'broker_rejected',
      http_status: res.status,
      error: body?.message || body?.error || `MT5 broker odmietol pokyn (HTTP ${res.status}).`,
      broker_response: body
    };
  }

  const receiptId = String(body.orderId || body.order_id || body.positionId || body.dealId || crypto.randomUUID());
  if (env?.DB?.prepare) {
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('wallet_mt5_trade_executed',?)")
      .bind(JSON.stringify({ owner_id: ownerId, account_type: cfg.account_type, symbol: order.symbol, action: order.action, volume: order.volume, receipt_id: receiptId, executed_at: new Date().toISOString() })).run().catch(() => {});
  }

  return {
    ok: true,
    executed: true,
    status: 'executed',
    account_type: cfg.account_type,
    receipt_id: receiptId,
    broker_response: body,
    _evidence: { effect: 'mutation', actions: ['mt5_trade'], receipt_id: `mt5:${receiptId}` }
  };
}
