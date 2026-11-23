/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Real market data and technical indicator module (Trinity/src/market-data.js) in TRINITY OMNI-CORE.
 */
// Real market data for the commodity desk. ZERO fabricated, simulated, or default prices.
// Quote and candle source: Yahoo Finance chart endpoint (keyless, delayed / unofficial data).
// USD->EUR FX rate: ECB via frankfurter.app. If a source fails, return available:false with a reason — never estimate.
// All I/O functions accept an optional `fetchImpl` (or read globalThis.fetch at call time) for offline testability.

export const MARKET_DATA_SOURCE_LABEL = 'Yahoo Finance (query1.finance.yahoo.com) – unofficial, delayed source';
export const FX_SOURCE_LABEL = 'ECB via frankfurter';
export const UNVERIFIED_SOURCE_LABEL = 'No verified data source';
export const MARKET_CACHE_TTL_MS = 15 * 60 * 1000;
export const MAX_QUOTE_AGE_DAYS = 10;
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const FX_URL = 'https://api.frankfurter.app/latest?from=USD&to=EUR';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CACHE_PREFIX = 'marketdata:v1:';

// Commodity-to-Yahoo ticker mapping verified via live queries.
// `null` = no verifiable free source found -> commodity is NOT priced, scored, or charted.
export const MARKET_SOURCES = {
  'XAU-EUR': { ticker: 'GC=F', note: 'COMEX Gold (futures), quoted in USD per t oz' },
  'XAG-EUR': { ticker: 'SI=F', note: 'COMEX Silver (futures), USD per t oz' },
  'XPT-EUR': { ticker: 'PL=F', note: 'NYMEX Platinum (futures), USD per t oz' },
  'XPD-EUR': { ticker: 'PA=F', note: 'NYMEX Palladium (futures), USD per t oz' },
  'BRENT-EUR': { ticker: 'BZ=F', note: 'NYMEX Brent Crude (futures), USD per barrel' },
  'WTI-EUR': { ticker: 'CL=F', note: 'NYMEX WTI Crude (futures), USD per barrel' },
  'NGAS-EUR': { ticker: 'NG=F', note: 'NYMEX Henry Hub Natural Gas (futures), USD per MMBtu' },
  'TTF-EUR': { ticker: 'TTF=F', note: 'Dutch TTF Gas (futures), EUR per MWh' },
  'COPPER-EUR': { ticker: 'HG=F', note: 'COMEX Copper (futures), USD per lb' },
  'ALUM-EUR': { ticker: 'ALI=F', note: 'COMEX Aluminum (futures), USD per ton; low liquidity — quotes may be sparse' },
  'WHEAT-EUR': { ticker: 'ZW=F', note: 'CBOT Wheat (futures), USD cents per bushel' },
  'CORN-EUR': { ticker: 'ZC=F', note: 'CBOT Corn (futures), USD cents per bushel' },
  'SOY-EUR': { ticker: 'ZS=F', note: 'CBOT Soybeans (futures), USD cents per bushel' },
  'COFFEE-EUR': { ticker: 'KC=F', note: 'ICE Arabica Coffee (futures), USD cents per lb' },
  'COCOA-EUR': { ticker: 'CC=F', note: 'ICE Cocoa (futures), USD per ton' },
  'SUGAR-EUR': { ticker: 'SB=F', note: 'ICE Sugar #11 (futures), USD cents per lb' },
  'BTC-EUR': { ticker: 'BTC-EUR', note: 'Bitcoin in EUR (cryptocurrency)' },
  'URAN-EUR': null, // Yahoo UX=F only returns an expired contract (Dec-20) with 1 point — unusable
  'LITH-EUR': null, // No verifiable free lithium spot price (LIT is an equity ETF, not spot metal)
  'NICKEL-EUR': null,
  'ZINC-EUR': null, // Yahoo ZNC=F: zero volume and last quote is older than 2 months
  'EUA-EUR': null // CO2.L is an ETC proxy, not spot EUA carbon price — unverified source
};

export function getMarketSource(symbol) {
  const entry = MARKET_SOURCES[symbol];
  return entry ? { symbol, ticker: entry.ticker, note: entry.note, verified_source: true } : { symbol, ticker: null, verified_source: false, reason: UNVERIFIED_SOURCE_LABEL };
}

export const TIMEFRAMES = {
  '1D': { range: '1d', interval: '15m' },
  '1W': { range: '5d', interval: '60m' },
  '1M': { range: '1mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' }
};
export const ANALYSIS_SERIES = { range: '6mo', interval: '1d' };

export function normalizeTimeframe(tf) {
  const key = String(tf || '1D').trim().toUpperCase();
  return TIMEFRAMES[key] ? key : '1D';
}

// ---------- Pure indicators (computed strictly from actual closing prices) ----------

export function sma(values, period) {
  const out = [];
  if (!Array.isArray(values) || period < 1 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
  }
  return out;
}

// EMA with SMA seed; output is end-aligned (length n - period + 1).
export function ema(values, period) {
  if (!Array.isArray(values) || period < 1 || values.length < period) return [];
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [prev];
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Wilder's RSI. First value corresponds to index `period`; output length is n - period.
export function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length <= period) return [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const toRsi = () => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));
  const out = [toRsi()];
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out.push(toRsi());
  }
  return out;
}

// Wilder's ATR; TR_0 = high-low, subsequent TRs include previous close. Output length is n - period + 1.
export function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period) return [];
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [prev];
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out.push(prev);
  }
  return out;
}

// MACD(12,26,9). macd: length n-slow+1; signal/histogram: length macd.length-signal+1 (end-aligned).
export function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const empty = { macd: [], signal: [], histogram: [] };
  if (!Array.isArray(values) || values.length < slow) return empty;
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const offset = fastE.length - slowE.length;
  const line = slowE.map((s, i) => fastE[i + offset] - s);
  const signal = ema(line, signalPeriod);
  if (!signal.length) return { macd: line, signal: [], histogram: [] };
  const lineTail = line.slice(line.length - signal.length);
  return { macd: line, signal, histogram: signal.map((s, i) => lineTail[i] - s) };
}

export const lastOf = arr => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);

// ---------- Network + Cache ----------

function resolveFetch(fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') throw new Error('fetch is not available');
  return f;
}

async function cacheRead(env, key) {
  if (!env?.Mastermind?.get) return null;
  try {
    const raw = await env.Mastermind.get(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const age = Date.now() - Date.parse(parsed?.fetched_at || 0);
    return Number.isFinite(age) && age >= 0 && age <= MARKET_CACHE_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
}

async function cacheWrite(env, key, value) {
  if (!env?.Mastermind?.put) return;
  try {
    await env.Mastermind.put(CACHE_PREFIX + key, JSON.stringify(value), { expirationTtl: Math.round(MARKET_CACHE_TTL_MS / 1000) });
  } catch {
    // Cache is strictly an optimization; write failures do not affect data truthfulness
  }
}

export async function getFxRate({ env, fetchImpl, forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const hit = await cacheRead(env, 'fx:USDEUR');
    if (hit?.rate) return { available: true, rate: hit.rate, date: hit.date, source: FX_SOURCE_LABEL, fetched_at: hit.fetched_at, cached: true };
  }
  try {
    const res = await resolveFetch(fetchImpl)(FX_URL, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { available: false, reason: `USD->EUR FX rate (ECB/frankfurter) unavailable: HTTP ${res.status}` };
    const data = await res.json();
    const rate = Number(data?.rates?.EUR);
    if (!Number.isFinite(rate) || rate <= 0) return { available: false, reason: 'USD->EUR FX rate (ECB/frankfurter) returned an invalid payload' };
    const fx = { rate, date: String(data?.date || ''), fetched_at: new Date().toISOString() };
    await cacheWrite(env, 'fx:USDEUR', fx);
    return { available: true, rate, date: fx.date, source: FX_SOURCE_LABEL, fetched_at: fx.fetched_at, cached: false };
  } catch (e) {
    return { available: false, reason: `USD->EUR FX rate (ECB/frankfurter) unavailable: ${e?.name || 'network error'}` };
  }
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parseYahooChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result) return { ok: false, reason: json?.chart?.error?.description || 'Yahoo Finance returned no data' };
  const meta = result.meta || {};
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const close = num(q.close?.[i]);
    if (close === null || !(close > 0)) continue;
    const open = num(q.open?.[i]) ?? close;
    const high = num(q.high?.[i]) ?? Math.max(open, close);
    const low = num(q.low?.[i]) ?? Math.min(open, close);
    candles.push({ time: new Date(ts[i] * 1000).toISOString(), open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume: num(q.volume?.[i]) });
  }
  const price = num(meta.regularMarketPrice);
  const quoteTimeSec = num(meta.regularMarketTime);
  return {
    ok: true,
    meta: {
      currency: String(meta.currency || ''),
      instrument: String(meta.longName || meta.shortName || meta.symbol || ''),
      instrument_type: String(meta.instrumentType || ''),
      exchange: String(meta.fullExchangeName || meta.exchangeName || ''),
      price,
      quote_time: quoteTimeSec ? new Date(quoteTimeSec * 1000).toISOString() : null
    },
    candles
  };
}

async function fetchYahoo(env, ticker, range, interval, { fetchImpl, forceRefresh }) {
  const key = `yahoo:${ticker}:${range}:${interval}`;
  if (!forceRefresh) {
    const hit = await cacheRead(env, key);
    if (hit?.data) return { ok: true, data: hit.data, fetched_at: hit.fetched_at, cached: true };
  }
  try {
    const url = `${YAHOO_BASE}${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    const res = await resolveFetch(fetchImpl)(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, reason: `Market data source (Yahoo Finance) returned HTTP ${res.status}` };
    const parsed = parseYahooChart(await res.json());
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const fetched_at = new Date().toISOString();
    await cacheWrite(env, key, { fetched_at, data: parsed });
    return { ok: true, data: parsed, fetched_at, cached: false };
  } catch (e) {
    return { ok: false, reason: `Market data source (Yahoo Finance) unavailable: ${e?.name || 'network error'}` };
  }
}

function toEurOrNative(value, nativeCurrency, fx) {
  // USX = USD cents. No other currency conversion is supported — return raw rather than guessing.
  const usd = nativeCurrency === 'USX' ? value / 100 : value;
  if (nativeCurrency === 'EUR') return { value: usd, currency: 'EUR' };
  if (fx?.available) return { value: usd * fx.rate, currency: 'EUR' };
  return { value: usd, currency: 'USD' };
}

function round(v, digits = 6) {
  return Number(Number(v).toFixed(digits));
}

// Returns real candle series and quote for a commodity, or {available:false, reason}. Never fabricates numbers.
export async function getMarketSeries(env, symbol, { range, interval, fetchImpl, forceRefresh = false, fx: fxIn } = {}) {
  const src = getMarketSource(symbol);
  if (!src.verified_source) return { available: false, symbol, reason: UNVERIFIED_SOURCE_LABEL, source: null };
  const r = range || ANALYSIS_SERIES.range;
  const i = interval || ANALYSIS_SERIES.interval;
  const [raw, fx] = await Promise.all([
    fetchYahoo(env, src.ticker, r, i, { fetchImpl, forceRefresh }),
    fxIn ? Promise.resolve(fxIn) : getFxRate({ env, fetchImpl, forceRefresh })
  ]);
  if (!raw.ok) return { available: false, symbol, ticker: src.ticker, reason: raw.reason, source: MARKET_DATA_SOURCE_LABEL };
  const { meta, candles } = raw.data;
  const native = meta.currency;
  if (!['USD', 'USX', 'EUR'].includes(native)) {
    return { available: false, symbol, ticker: src.ticker, reason: `Unsupported source currency (${native || 'unknown'}) – price omitted`, source: MARKET_DATA_SOURCE_LABEL };
  }
  if (!(meta.price > 0) || !meta.quote_time) {
    return { available: false, symbol, ticker: src.ticker, reason: 'Source did not return a valid live quote', source: MARKET_DATA_SOURCE_LABEL };
  }
  const quoteAgeMs = Date.now() - Date.parse(meta.quote_time);
  if (quoteAgeMs > MAX_QUOTE_AGE_DAYS * 86400000) {
    return { available: false, symbol, ticker: src.ticker, reason: `Latest source quote is older than ${MAX_QUOTE_AGE_DAYS} days (${meta.quote_time}) – price omitted`, source: MARKET_DATA_SOURCE_LABEL };
  }
  if (!candles.length) return { available: false, symbol, ticker: src.ticker, reason: 'Source returned no historical candles', source: MARKET_DATA_SOURCE_LABEL };

  const conv = v => toEurOrNative(v, native, fx);
  const priceConv = conv(meta.price);
  const currency = priceConv.currency;
  const mapC = c => ({
    time: c.time,
    open: round(conv(c.open).value),
    high: round(conv(c.high).value),
    low: round(conv(c.low).value),
    close: round(conv(c.close).value),
    volume: c.volume
  });
  const fxInfo = native === 'EUR'
    ? { applied: false, note: 'Source quotes directly in EUR' }
    : fx?.available
      ? { applied: true, rate: fx.rate, date: fx.date, source: fx.source, fetched_at: fx.fetched_at, direction: 'USD→EUR' }
      : { applied: false, available: false, reason: fx?.reason || 'FX rate unavailable', note: 'Prices are shown in native USD without conversion — FX rate was not estimated.' };
  return {
    available: true,
    symbol,
    ticker: src.ticker,
    instrument: meta.instrument,
    exchange: meta.exchange,
    source: MARKET_DATA_SOURCE_LABEL,
    source_note: src.note,
    delayed: meta.instrument_type !== 'CRYPTOCURRENCY',
    delay_note: meta.instrument_type === 'CRYPTOCURRENCY' ? 'Cryptocurrency – near real-time, no SLA guarantee' : 'Futures data is delayed (typically >= 10–15 min)',
    fetched_at: raw.fetched_at,
    cached: raw.cached,
    range: r,
    interval: i,
    native_currency: native === 'USX' ? 'USX (USD cents)' : native,
    currency,
    fx: fxInfo,
    price: round(priceConv.value),
    quote_time: meta.quote_time,
    quote_age_minutes: Math.max(0, Math.round(quoteAgeMs / 60000)),
    candles: candles.map(mapC)
  };
}

// Price change vs. the candle closest to (now - days) — only when such a historical candle actually exists.
export function pctChangeOverDays(candles, price, days, nowMs = Date.now()) {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  const target = nowMs - days * 86400000;
  let ref = null;
  for (const c of candles) {
    if (Date.parse(c.time) <= target) ref = c; else break;
  }
  if (!ref || !(ref.close > 0)) return null;
  return Number((((price - ref.close) / ref.close) * 100).toFixed(2));
}

// Percentage change vs. previous daily close (last candle represents the active session).
export function pctChangeVsPreviousClose(dailyCandles, price) {
  if (!Array.isArray(dailyCandles) || dailyCandles.length < 2) return null;
  const prev = dailyCandles[dailyCandles.length - 2].close;
  if (!(prev > 0)) return null;
  return Number((((price - prev) / prev) * 100).toFixed(2));
}
