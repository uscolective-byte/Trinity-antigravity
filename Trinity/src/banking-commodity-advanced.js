/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Advanced commodity price alerts, SEPA EPC QR invoicing, and aggregated net worth module (Trinity/src/banking-commodity-advanced.js).
 */
import { z } from 'zod';
import { HttpError } from './security.js';
import { ALL_COMMODITIES, getCommodityDeskOverview } from './commodities-engine.js';
import { getWallet } from './wallet.js';
import { listDomains } from './domains.js';
import { buildEpcPayload, generateQrSvg } from './wallet-terminals.js';
import { sendTelegramAlert } from './domain-desk-advanced.js';
import { recordStepDocument } from './trinity-documents.js';
import { getMarketSeries } from './market-data.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const priceAlertSchema = z.object({
  symbol: z.string().trim().min(2).max(20),
  condition: z.enum(['above', 'below', 'cross_support', 'cross_resistance']),
  target_price: z.number().min(0.0001).max(10000000),
  notify_channel: z.enum(['telegram', 'chat', 'all']).default('telegram')
}).strict();

export const invoiceGenerateSchema = z.object({
  client_name: z.string().trim().min(2).max(120),
  client_email: z.string().email().optional(),
  amount_eur: z.number().min(0.01).max(1000000),
  item_description: z.string().trim().min(3).max(300),
  variable_symbol: z.string().trim().max(10).optional(),
  iban: z.string().trim().min(15).max(34).optional(),
  bic: z.string().trim().max(11).optional()
}).strict();

// ----------------------------------------------------
// 1. SMART COMMODITY PRICE ALERTS & SUPPORT/RESISTANCE
// ----------------------------------------------------

export function calculateSupportResistance(commodity) {
  const rawPrice = commodity?.live_price_eur ?? commodity?.price_eur ?? commodity?.price;
  if (typeof rawPrice !== 'number' || !Number.isFinite(rawPrice) || rawPrice <= 0) {
    return { support: null, resistance: null, live_price_unavailable: true };
  }
  // Standard pivot calculation using volatility band around verified live price
  const support = Math.round(rawPrice * 0.96 * 100) / 100;
  const resistance = Math.round(rawPrice * 1.04 * 100) / 100;
  return { support, resistance, live_price_unavailable: false };
}

async function resolveLiveCommodityPrice(env, symbol, { liveQuotes = null, fetchImpl = null, fetchLive = true } = {}) {
  if (liveQuotes && typeof liveQuotes === 'object') {
    const key = Object.keys(liveQuotes).find(k => k.toLowerCase() === symbol.toLowerCase());
    if (key !== undefined) {
      const entry = liveQuotes[key];
      if (typeof entry === 'number' && Number.isFinite(entry) && entry > 0) {
        return { available: true, price: entry, currency: 'EUR', source: 'live-quote' };
      }
      if (entry && typeof entry === 'object' && entry.available !== false && typeof entry.price === 'number' && Number.isFinite(entry.price) && entry.price > 0) {
        return { available: true, price: entry.price, currency: entry.currency || 'EUR', source: entry.source || 'live-quote' };
      }
      return { available: false, reason: 'live_price_unavailable' };
    }
  }

  if (!fetchLive) {
    return { available: false, reason: 'live_price_unavailable' };
  }

  try {
    const series = await getMarketSeries(env, symbol, { fetchImpl });
    if (series?.available && typeof series.price === 'number' && Number.isFinite(series.price) && series.price > 0) {
      return {
        available: true,
        price: series.price,
        currency: series.currency || 'EUR',
        source: series.source || 'market-data'
      };
    }
    return { available: false, reason: series?.reason || 'live_price_unavailable' };
  } catch (err) {
    return { available: false, reason: err?.message || 'live_price_unavailable' };
  }
}

export async function createPriceAlert(env, actor = 'admin', input, options = {}) {
  const parsed = priceAlertSchema.parse(input);
  const comm = ALL_COMMODITIES.find(c => c.symbol.toLowerCase() === parsed.symbol.toLowerCase());
  if (!comm) throw new HttpError(404, `Commodity with symbol ${parsed.symbol} not found.`);

  const liveQuotes = options.liveQuotes || (typeof options.live_price_eur === 'number' ? { [comm.symbol]: options.live_price_eur } : null);
  const quote = await resolveLiveCommodityPrice(env, comm.symbol, {
    liveQuotes,
    fetchImpl: options.fetchImpl,
    fetchLive: options.fetchLive ?? Boolean(options.fetchImpl)
  });

  const currentPrice = quote.available ? quote.price : null;
  const { support, resistance } = currentPrice !== null
    ? calculateSupportResistance({ ...comm, price_eur: currentPrice })
    : { support: null, resistance: null };
  const alertId = `alt-p-${crypto.randomUUID()}`;

  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO commodity_price_alerts(
        id, symbol, condition, target_price, current_price, support_level, resistance_level, notify_channel, status
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      alertId,
      comm.symbol,
      parsed.condition,
      parsed.target_price,
      currentPrice,
      support,
      resistance,
      parsed.notify_channel
    ).run();
  }

  return {
    success: true,
    alert_id: alertId,
    symbol: comm.symbol,
    condition: parsed.condition,
    target_price: parsed.target_price,
    current_price: currentPrice,
    support_level: support,
    resistance_level: resistance,
    live_price_status: quote.available ? 'live' : 'live_price_unavailable',
    price_source: quote.available ? quote.source : null,
    status: 'active'
  };
}

export async function listPriceAlerts(env) {
  if (!env.DB) return { alerts: [] };
  const rows = (await env.DB.prepare(`
    SELECT id, symbol, condition, target_price, current_price, support_level, resistance_level, notify_channel, status, triggered_at, created_at 
    FROM commodity_price_alerts 
    ORDER BY created_at DESC LIMIT 50
  `).all()).results || [];
  return { alerts: rows };
}

export async function checkPriceAlerts(env, { notify = true, liveQuotes = null, fetchImpl = null, fetchLive = true } = {}) {
  if (!env.DB) return { success: false, triggered_count: 0, alerts: [], skipped_count: 0, skipped: [] };

  const activeAlerts = (await env.DB.prepare("SELECT * FROM commodity_price_alerts WHERE status = 'active'").all()).results || [];
  const triggered = [];
  const skipped = [];

  for (const alt of activeAlerts) {
    const comm = ALL_COMMODITIES.find(c => c.symbol.toLowerCase() === alt.symbol.toLowerCase());
    if (!comm) continue;

    const quote = await resolveLiveCommodityPrice(env, comm.symbol, { liveQuotes, fetchImpl, fetchLive });
    if (!quote.available) {
      skipped.push({
        alert_id: alt.id,
        symbol: comm.symbol,
        status: 'live_price_unavailable',
        reason: quote.reason || 'Live market price quote is unavailable.'
      });
      continue;
    }

    const price = quote.price;
    const currency = quote.currency || 'EUR';
    let isBreached = false;
    let reason = '';

    if (alt.condition === 'above' && price >= alt.target_price) {
      isBreached = true;
      reason = `${comm.symbol} price rose above target level: ${price} ${currency} >= ${alt.target_price} ${currency}`;
    } else if (alt.condition === 'below' && price <= alt.target_price) {
      isBreached = true;
      reason = `${comm.symbol} price dropped below target level: ${price} ${currency} <= ${alt.target_price} ${currency}`;
    } else if (alt.condition === 'cross_support' && alt.support_level && price <= alt.support_level) {
      isBreached = true;
      reason = `${comm.symbol} price crossed below support level: ${price} ${currency} <= ${alt.support_level} ${currency}`;
    } else if (alt.condition === 'cross_resistance' && alt.resistance_level && price >= alt.resistance_level) {
      isBreached = true;
      reason = `${comm.symbol} price broke above resistance level: ${price} ${currency} >= ${alt.resistance_level} ${currency}`;
    }

    if (isBreached) {
      triggered.push({ alert: alt, reason, price, currency, source: quote.source });
      await env.DB.prepare(`
        UPDATE commodity_price_alerts 
        SET status = 'triggered', current_price = ?, triggered_at = datetime('now')
        WHERE id = ?
      `).bind(price, alt.id).run().catch(() => {});

      if (notify) {
        const msg = `🔔 <b>SMART PRICE ALERT: ${escapeHtml(comm.name)} (${escapeHtml(comm.symbol)})</b>\n\n${escapeHtml(reason)}\nVerified market price: <b>${escapeHtml(price)} ${escapeHtml(currency)}</b> (${escapeHtml(quote.source)})\n\n<i>Trinity Commodity Desk Watchdog</i>`;
        await sendTelegramAlert(env, msg).catch(() => {});
      }
    }
  }

  return {
    success: true,
    status: skipped.length > 0 && triggered.length === 0 ? 'live_price_unavailable' : 'checked',
    total_active: activeAlerts.length,
    triggered_count: triggered.length,
    triggered,
    skipped_count: skipped.length,
    skipped
  };
}

// ----------------------------------------------------
// 2. AUTOMATED SEPA EPC QR INVOICE GENERATOR
// ----------------------------------------------------

export async function generateInvoiceWithSepaQr(env, actor = 'admin', input) {
  const parsed = invoiceGenerateSchema.parse(input);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const randomBuf = new Uint32Array(1);
  crypto.getRandomValues(randomBuf);
  const invoiceSuffix = String(1000 + (randomBuf[0] % 9000));
  const invoiceNumber = `${year}${month}${invoiceSuffix}`;
  const variableSymbol = parsed.variable_symbol || invoiceNumber.replace(/\D/g, '').slice(-10);

  // Require an explicit or environment-configured IBAN (fail closed — never emit placeholder IBAN)
  const iban = String(parsed.iban || env?.SEPA_IBAN || env?.TRINITY_SEPA_IBAN || env?.BANK_IBAN || '').trim();
  if (!iban || iban.length < 15 || iban.length > 34) {
    throw new HttpError(400, 'SEPA IBAN is required: provide iban in the request or configure SEPA_IBAN / TRINITY_SEPA_IBAN.');
  }
  const bic = String(parsed.bic || env?.SEPA_BIC || env?.TRINITY_SEPA_BIC || '').trim();
  const recipientName = String(env?.SEPA_RECIPIENT_NAME || 'Ivan Sabo (Basterix) · Auru Platform').trim();
  const paypalBusiness = String(env?.PAYPAL_BUSINESS_EMAIL || 'saboivan2008@gmail.com').trim();
  const revolutUrl = String(env?.REVOLUT_ME_URL || 'https://revolut.me/isabo91').trim();
  const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalBusiness)}&currency_code=EUR&amount=${parsed.amount_eur.toFixed(2)}&item_name=${encodeURIComponent(parsed.item_description)}`;

  const epcPayload = buildEpcPayload({
    iban,
    bic,
    name: recipientName,
    amountEur: parsed.amount_eur,
    remittance: `VS${variableSymbol} ${parsed.item_description.slice(0, 30)}`
  });

  const qrSvg = generateQrSvg(epcPayload, 220);

  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeRecipientName = escapeHtml(recipientName);
  const safeClientName = escapeHtml(parsed.client_name);
  const safeClientEmail = parsed.client_email ? escapeHtml(parsed.client_email) : '';
  const safeItemDescription = escapeHtml(parsed.item_description);
  const safeIban = escapeHtml(iban);
  const safeBic = escapeHtml(bic || 'N/A');
  const safeVariableSymbol = escapeHtml(variableSymbol);
  const safeDate = escapeHtml(now.toLocaleDateString('sk-SK'));

  const htmlInvoice = `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <title>Faktúra č. ${safeInvoiceNumber} · Auru</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px 16px; margin: 0; }
    .invoice-box { max-width: 680px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px; box-shadow: 0 20px 48px rgba(0,0,0,0.4); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { background: rgba(56,189,248,0.15); color: #38bdf8; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 14px; line-height: 1.5; }
    .item-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    .item-table th { text-align: left; border-bottom: 1px solid #475569; padding: 10px 0; color: #94a3b8; font-size: 13px; }
    .item-table td { padding: 12px 0; border-bottom: 1px solid #334155; }
    .total-row { font-size: 20px; font-weight: 800; color: #38bdf8; }
    .sepa-card { background: rgba(255,255,255,0.03); border: 1px solid #475569; border-radius: 12px; padding: 20px; display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; }
    .sepa-details { font-size: 13px; line-height: 1.7; }
    .qr-box { background: #ffffff; padding: 10px; border-radius: 8px; display: inline-block; }
    .print-btn { background: #0284c7; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 20px; }
    @media print { body { background: #fff; color: #000; } .invoice-box { border: none; box-shadow: none; background: #fff; } .print-btn { display: none; } }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <div>
        <span class="badge">OFICIÁLNA FAKTÚRA &amp; DOKLAD</span>
        <h1 style="margin:8px 0 0">Faktúra ${safeInvoiceNumber}</h1>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#94a3b8">Dátum vystavenia</div>
        <b>${safeDate}</b>
      </div>
    </div>

    <div class="parties">
      <div>
        <div style="color:#94a3b8;margin-bottom:4px">DODÁVATEĽ</div>
        <b>${safeRecipientName}</b><br>
        Auru Cloud Platform<br>
        Slovenská republika
      </div>
      <div>
        <div style="color:#94a3b8;margin-bottom:4px">ODBERATEĽ</div>
        <b>${safeClientName}</b><br>
        ${safeClientEmail ? safeClientEmail + '<br>' : ''}
        Platba prevodom / Instant SEPA
      </div>
    </div>

    <table class="item-table">
      <thead>
        <tr><th>Položka / Služba</th><th style="text-align:right">Suma v EUR</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><b>${safeItemDescription}</b></td>
          <td style="text-align:right"><b>${parsed.amount_eur.toFixed(2)} €</b></td>
        </tr>
        <tr>
          <td class="total-row">CELKOM K ÚHRADE:</td>
          <td style="text-align:right" class="total-row">${parsed.amount_eur.toFixed(2)} €</td>
        </tr>
      </tbody>
    </table>

    <div class="sepa-card">
      <div class="sepa-details">
        <b style="color:#38bdf8">Platobné inštrukcie (SEPA Instant / Pay by square):</b><br>
        IBAN: <b>${safeIban}</b><br>
        BIC / SWIFT: <b>${safeBic}</b><br>
        Variabilný symbol: <b>${safeVariableSymbol}</b><br>
        Suma: <b>${parsed.amount_eur.toFixed(2)} EUR</b><br>
        Správa pre príjemcu: <b>VS${safeVariableSymbol} ${safeClientName}</b>
      </div>
      <div class="qr-box">
        ${qrSvg}
      </div>
    </div>

    <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a href="${escapeHtml(paypalUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#ffc439;color:#003087;font-weight:700;font-size:13px;text-decoration:none">💙 Zaplatiť ${parsed.amount_eur.toFixed(2)} € cez PayPal</a>
      <a href="${escapeHtml(revolutUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#38bdf8;color:#0f172a;font-weight:700;font-size:13px;text-decoration:none">⚡ Zaplatiť cez Revolut</a>
    </div>
    <div style="text-align:center">
      <button class="print-btn" onclick="window.print()">🖨️ Tlačiť faktúru / Uložiť ako PDF</button>
    </div>
  </div>
</body>
</html>`;

  const invoiceId = `inv-${crypto.randomUUID()}`;
  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO generated_invoices(
        id, invoice_number, client_name, client_email, amount_eur, variable_symbol, item_description, iban, bic, qr_svg, status
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
    `).bind(
      invoiceId,
      invoiceNumber,
      parsed.client_name,
      parsed.client_email || '',
      parsed.amount_eur,
      variableSymbol,
      parsed.item_description,
      iban,
      bic,
      qrSvg
    ).run().catch(() => {});
  }

  // Document step in Trinity Documents
  await recordStepDocument(env, {
    title: `Generated SEPA Invoice: ${invoiceNumber}`,
    category: 'wallet',
    description: `Issued invoice for ${parsed.client_name} for ${parsed.amount_eur} EUR with SEPA EPC QR code.`,
    details: { invoice_id: invoiceId, invoice_number: invoiceNumber, amount: parsed.amount_eur, variable_symbol: variableSymbol }
  }).catch(() => {});

  return {
    success: true,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    variable_symbol: variableSymbol,
    amount_eur: parsed.amount_eur,
    iban,
    bic,
    qr_svg: qrSvg,
    epc_payload: epcPayload,
    paypal_url: paypalUrl,
    revolut_url: revolutUrl,
    html_invoice: htmlInvoice
  };
}

export async function listGeneratedInvoices(env) {
  if (!env.DB) return { invoices: [] };
  const rows = (await env.DB.prepare(`
    SELECT id, invoice_number, client_name, client_email, amount_eur, variable_symbol, item_description, iban, bic, status, created_at, paid_at
    FROM generated_invoices
    ORDER BY created_at DESC LIMIT 50
  `).all()).results || [];
  return { invoices: rows };
}

// ----------------------------------------------------
// 3. AGGREGATED NET WORTH DASHBOARD
// ----------------------------------------------------

export async function getAggregatedNetWorth(env, actor = 'admin') {
  // 1. Sandbox wallet liquidity (pass actor and read canonical balance field)
  const walletData = await getWallet(env, actor).catch(() => null);
  const rawWalletBalance = walletData?.balance ?? walletData?.balance_eur ?? 0;
  const liquidCash = Number.isFinite(Number(rawWalletBalance)) ? Number(rawWalletBalance) : 0;

  // 2. Paper-trading & commodity equity (never fabricate a fallback 25,000 EUR balance)
  const commDesk = await getCommodityDeskOverview(env, actor).catch(() => null);
  const rawTradingEquity = commDesk?.portfolio?.equity_eur ?? 0;
  const tradingEquity = Number.isFinite(Number(rawTradingEquity)) ? Number(rawTradingEquity) : 0;
  const rawOpenPositions = commDesk?.portfolio?.open_positions_value_eur ?? 0;
  const openPositionsValue = Number.isFinite(Number(rawOpenPositions)) ? Number(rawOpenPositions) : 0;

  // 3. Managed Domain portfolio valuation (only count explicit recorded sale prices; never fabricate 390 EUR baselines)
  const domains = await listDomains(env, {}).catch(() => []);
  let domainPortfolioValue = 0;
  let unpricedDomainsCount = 0;
  for (const d of domains) {
    if (typeof d.sale_price === 'number' && Number.isFinite(d.sale_price) && d.sale_price > 0) {
      domainPortfolioValue += d.sale_price;
    } else {
      unpricedDomainsCount += 1;
    }
  }

  // 4. Combined Recorded Portfolio Value (clearly marked as sandbox/paper + recorded valuations, no fabricated history)
  const totalNetWorth = Math.round((liquidCash + tradingEquity + domainPortfolioValue) * 100) / 100;
  const nowIso = new Date().toISOString();

  const history = [
    { date: nowIso, net_worth: totalNetWorth, verified: true }
  ];

  return {
    success: true,
    real_bank_balance_verified: false,
    synthetic_history: false,
    includes_sandbox_and_paper_balances: true,
    total_net_worth_eur: totalNetWorth,
    breakdown: {
      liquid_cash_eur: liquidCash,
      trading_equity_eur: tradingEquity,
      open_positions_eur: openPositionsValue,
      domain_portfolio_eur: domainPortfolioValue
    },
    counts: {
      domains_count: domains.length,
      unpriced_domains_count: unpricedDomainsCount,
      open_positions_count: commDesk?.portfolio?.open_positions?.length || 0
    },
    history,
    updated_at: nowIso
  };
}
