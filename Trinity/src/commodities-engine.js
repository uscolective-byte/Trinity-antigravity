import { z } from 'zod';
import { HttpError } from './security.js';
import { createPortfolio, listPortfolios, getPortfolio, recordTrade, setQuote } from './trading.js';
import { recordStepDocument } from './trinity-documents.js';

const DESK_STATE_KEY = 'commodity:desk:state:v1';

export const COMMODITY_SECTORS = [
  'all',
  'precious_metals',
  'energy',
  'industrial_metals',
  'agriculture',
  'strategic_digital'
];

export const COMMODITY_SECTOR_LABELS = {
  precious_metals: 'Vzácne a drahé kovy',
  energy: 'Energetické komodity',
  industrial_metals: 'Priemyselné a batériové kovy',
  agriculture: 'Poľnohospodárske komodity a potraviny',
  strategic_digital: 'Strategické a uhlíkové komodity'
};

export const ALL_COMMODITIES = [
  {
    symbol: 'XAU-EUR',
    name: 'Zlato (Gold Spot)',
    sector: 'precious_metals',
    unit: 't oz',
    base_price: 2645.00,
    change_24h_pct: 0.85,
    change_7d_pct: 2.40,
    change_30d_pct: 6.15,
    rsi_14: 61.4,
    volatility_atr_pct: 1.15,
    macd_signal: 'bullish',
    fundamental_drivers: 'Silný dopyt centrálnych bánk, geopolitické zaistenie a ochrana pred infláciou.'
  },
  {
    symbol: 'XAG-EUR',
    name: 'Striebro (Silver Spot)',
    sector: 'precious_metals',
    unit: 't oz',
    base_price: 31.80,
    change_24h_pct: 1.45,
    change_7d_pct: 4.10,
    change_30d_pct: 9.80,
    rsi_14: 64.2,
    volatility_atr_pct: 2.10,
    macd_signal: 'bullish',
    fundamental_drivers: 'Rastúci priemyselný dopyt vo fotovoltike a elektronike spolu so štrukturálnym deficitom ponuky.'
  },
  {
    symbol: 'XPT-EUR',
    name: 'Platina (Platinum)',
    sector: 'precious_metals',
    unit: 't oz',
    base_price: 945.00,
    change_24h_pct: 0.35,
    change_7d_pct: 1.25,
    change_30d_pct: 3.10,
    rsi_14: 53.8,
    volatility_atr_pct: 1.65,
    macd_signal: 'bullish',
    fundamental_drivers: 'Podhodnotený pomer voči zlatu, využitie vo vodíkových palivových článkoch a katalyzátoroch.'
  },
  {
    symbol: 'XPD-EUR',
    name: 'Paládium (Palladium)',
    sector: 'precious_metals',
    unit: 't oz',
    base_price: 990.00,
    change_24h_pct: -0.90,
    change_7d_pct: -2.15,
    change_30d_pct: -4.40,
    rsi_14: 41.2,
    volatility_atr_pct: 2.85,
    macd_signal: 'bearish',
    fundamental_drivers: 'Prechod automobilového priemyslu na elektromobily tlmí dlhodobý dopyt po benzínových katalyzátoroch.'
  },
  {
    symbol: 'BRENT-EUR',
    name: 'Ropa Brent (Crude Oil Brent)',
    sector: 'energy',
    unit: 'bbl',
    base_price: 71.40,
    change_24h_pct: 0.65,
    change_7d_pct: 1.90,
    change_30d_pct: -1.80,
    rsi_14: 52.1,
    volatility_atr_pct: 2.25,
    macd_signal: 'neutral',
    fundamental_drivers: 'Produkčné kvóty OPEC+ vyvažujú mierne spomalenie priemyselného dopytu.'
  },
  {
    symbol: 'WTI-EUR',
    name: 'Ropa WTI (West Texas Intermediate)',
    sector: 'energy',
    unit: 'bbl',
    base_price: 68.20,
    change_24h_pct: 0.55,
    change_7d_pct: 1.65,
    change_30d_pct: -2.10,
    rsi_14: 50.8,
    volatility_atr_pct: 2.35,
    macd_signal: 'neutral',
    fundamental_drivers: 'Stav zásob v USA (EIA) a sezónny dopyt rafinérií držia cenu v rovnovážnom pásme.'
  },
  {
    symbol: 'NGAS-EUR',
    name: 'Zemný plyn (Natural Gas Henry Hub)',
    sector: 'energy',
    unit: 'MMBtu',
    base_price: 2.85,
    change_24h_pct: 2.15,
    change_7d_pct: 5.60,
    change_30d_pct: 11.40,
    rsi_14: 59.5,
    volatility_atr_pct: 3.60,
    macd_signal: 'bullish',
    fundamental_drivers: 'Rastúci export LNG a vyšší odber elektrární pre dátové centrá a vykurovaciu sezónu.'
  },
  {
    symbol: 'TTF-EUR',
    name: 'Európsky plyn TTF (Dutch TTF Gas)',
    sector: 'energy',
    unit: 'MWh',
    base_price: 39.60,
    change_24h_pct: -0.45,
    change_7d_pct: -1.30,
    change_30d_pct: 2.80,
    rsi_14: 48.6,
    volatility_atr_pct: 2.90,
    macd_signal: 'neutral',
    fundamental_drivers: 'Vysoká naplnenosť európskych zásobníkov stabilizuje krátkodobé výkyvy cien.'
  },
  {
    symbol: 'URAN-EUR',
    name: 'Urán U3O8 (Uranium Spot)',
    sector: 'energy',
    unit: 'lb',
    base_price: 76.50,
    change_24h_pct: 1.20,
    change_7d_pct: 3.75,
    change_30d_pct: 8.90,
    rsi_14: 63.0,
    volatility_atr_pct: 1.95,
    macd_signal: 'bullish',
    fundamental_drivers: 'Globálna renesancia jadrovej energetiky a dlhodobé kontrakty pre AI dátové centrá.'
  },
  {
    symbol: 'COPPER-EUR',
    name: 'Meď (High Grade Copper)',
    sector: 'industrial_metals',
    unit: 'mt',
    base_price: 8940.00,
    change_24h_pct: 1.10,
    change_7d_pct: 3.20,
    change_30d_pct: 7.40,
    rsi_14: 60.8,
    volatility_atr_pct: 1.55,
    macd_signal: 'bullish',
    fundamental_drivers: 'Kľúčový kov pre elektrifikáciu sietí, obnoviteľné zdroje, elektromobily a AI infraštruktúru.'
  },
  {
    symbol: 'ALUM-EUR',
    name: 'Hliník (Primary Aluminum)',
    sector: 'industrial_metals',
    unit: 'mt',
    base_price: 2410.00,
    change_24h_pct: 0.40,
    change_7d_pct: 1.50,
    change_30d_pct: 4.10,
    rsi_14: 55.2,
    volatility_atr_pct: 1.40,
    macd_signal: 'bullish',
    fundamental_drivers: 'Energeticky náročná výroba obmedzuje novú ponuku pri stabilnom dopyte v doprave a obaloch.'
  },
  {
    symbol: 'LITH-EUR',
    name: 'Lítium (Lithium Carbonate)',
    sector: 'industrial_metals',
    unit: 'mt',
    base_price: 10450.00,
    change_24h_pct: 1.65,
    change_7d_pct: 3.90,
    change_30d_pct: 5.20,
    rsi_14: 57.4,
    volatility_atr_pct: 2.60,
    macd_signal: 'bullish',
    fundamental_drivers: 'Odraz z cyklického dna po obmedzení ťažby u vysokonákladových producentov a raste úložísk energie.'
  },
  {
    symbol: 'NICKEL-EUR',
    name: 'Nikel (LME Nickel)',
    sector: 'industrial_metals',
    unit: 'mt',
    base_price: 15200.00,
    change_24h_pct: -0.75,
    change_7d_pct: -1.90,
    change_30d_pct: -3.50,
    rsi_14: 43.5,
    volatility_atr_pct: 2.15,
    macd_signal: 'bearish',
    fundamental_drivers: 'Prebytok ponuky z Indonézie vytvára tlak na marže producentov.'
  },
  {
    symbol: 'ZINC-EUR',
    name: 'Zinok (SHG Zinc)',
    sector: 'industrial_metals',
    unit: 'mt',
    base_price: 2860.00,
    change_24h_pct: 0.25,
    change_7d_pct: 0.90,
    change_30d_pct: 2.30,
    rsi_14: 51.9,
    volatility_atr_pct: 1.50,
    macd_signal: 'neutral',
    fundamental_drivers: 'Vyrovnaný dopyt v galvanizácii ocele a infraštruktúrnych projektoch.'
  },
  {
    symbol: 'WHEAT-EUR',
    name: 'Pšenica (Milling Wheat)',
    sector: 'agriculture',
    unit: 'bu',
    base_price: 5.45,
    change_24h_pct: 0.95,
    change_7d_pct: 2.60,
    change_30d_pct: 4.80,
    rsi_14: 58.1,
    volatility_atr_pct: 1.90,
    macd_signal: 'bullish',
    fundamental_drivers: 'Klimatické riziká v hlavných exportných regiónoch podporujú cenu obilnín.'
  },
  {
    symbol: 'CORN-EUR',
    name: 'Kukurica (Yellow Corn)',
    sector: 'agriculture',
    unit: 'bu',
    base_price: 4.18,
    change_24h_pct: 0.30,
    change_7d_pct: 1.10,
    change_30d_pct: 1.95,
    rsi_14: 52.4,
    volatility_atr_pct: 1.60,
    macd_signal: 'neutral',
    fundamental_drivers: 'Stabilný dopyt po krmivách a bioetanole pri priaznivých globálnych zásobách.'
  },
  {
    symbol: 'SOY-EUR',
    name: 'Sója (Soybeans)',
    sector: 'agriculture',
    unit: 'bu',
    base_price: 9.85,
    change_24h_pct: -0.55,
    change_7d_pct: -1.40,
    change_30d_pct: -2.90,
    rsi_14: 44.8,
    volatility_atr_pct: 1.70,
    macd_signal: 'bearish',
    fundamental_drivers: 'Silná úroda v Južnej Amerike zvyšuje globálne exportné zásoby.'
  },
  {
    symbol: 'COFFEE-EUR',
    name: 'Káva Arabica (Coffee C)',
    sector: 'agriculture',
    unit: 'lb',
    base_price: 2.58,
    change_24h_pct: 1.35,
    change_7d_pct: 3.45,
    change_30d_pct: 7.90,
    rsi_14: 62.7,
    volatility_atr_pct: 2.20,
    macd_signal: 'bullish',
    fundamental_drivers: 'Sucho v Brazílii a Vietname znižuje očakávanú úrodu pri neelastickom svetovom dopyte.'
  },
  {
    symbol: 'COCOA-EUR',
    name: 'Kakao (Cocoa Futures)',
    sector: 'agriculture',
    unit: 'mt',
    base_price: 7350.00,
    change_24h_pct: -1.80,
    change_7d_pct: -4.20,
    change_30d_pct: -6.50,
    rsi_14: 38.9,
    volatility_atr_pct: 3.80,
    macd_signal: 'bearish',
    fundamental_drivers: 'Po extrémnom cenovom vrchole dochádza k vyberaniu ziskov a postupnej obnove produkcie v západnej Afrike.'
  },
  {
    symbol: 'SUGAR-EUR',
    name: 'Cukor (Raw Sugar #11)',
    sector: 'agriculture',
    unit: 'lb',
    base_price: 0.21,
    change_24h_pct: 0.45,
    change_7d_pct: 1.20,
    change_30d_pct: 3.10,
    rsi_14: 54.0,
    volatility_atr_pct: 1.85,
    macd_signal: 'neutral',
    fundamental_drivers: 'Pomer spracovania cukrovej trstiny na cukor vs. etanol v Brazílii drží trh v rovnováhe.'
  },
  {
    symbol: 'EUA-EUR',
    name: 'Emisné povolenky CO₂ (EU Carbon Permits)',
    sector: 'strategic_digital',
    unit: 'tCO2',
    base_price: 66.80,
    change_24h_pct: 0.90,
    change_7d_pct: 2.50,
    change_30d_pct: 5.70,
    rsi_14: 58.6,
    volatility_atr_pct: 2.05,
    macd_signal: 'bullish',
    fundamental_drivers: 'Postupné znižovanie stropu emisných kvót v EÚ (Fit for 55) vytvára dlhodobý štrukturálny nedostatok.'
  },
  {
    symbol: 'BTC-EUR',
    name: 'Bitcoin (Digitálna rezervná komodita)',
    sector: 'strategic_digital',
    unit: 'BTC',
    base_price: 63400.00,
    change_24h_pct: 1.60,
    change_7d_pct: 4.30,
    change_30d_pct: 10.20,
    rsi_14: 63.5,
    volatility_atr_pct: 3.10,
    macd_signal: 'bullish',
    fundamental_drivers: 'Pevne obmedzená ponuka 21M mincí po halvingu a inštitucionálna akumulácia cez spotové ETF.'
  }
];

export const commodityAnalyzeSchema = z.object({
  symbol: z.string().trim().max(24).optional().default(''),
  sector: z.enum(COMMODITY_SECTORS).optional().default('all'),
  strategy: z.enum(['conservative', 'balanced', 'growth', 'aggressive']).optional().default('balanced'),
  record_document: z.boolean().optional().default(false)
}).strict();

export const commodityTradeSchema = z.object({
  symbol: z.string().trim().min(2).max(24),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().finite().positive().max(1000000).optional(),
  amount_eur: z.number().finite().positive().max(10000000).optional(),
  sell_all: z.boolean().optional().default(false),
  price: z.number().finite().positive().max(10000000).optional(),
  thesis: z.string().trim().max(2000).optional().default('')
}).strict();

export const commodityAutoInvestSchema = z.object({
  strategy: z.enum(['conservative', 'balanced', 'growth', 'aggressive']).optional().default('balanced'),
  budget_eur: z.number().finite().min(50).max(500000).optional().default(3000),
  sector: z.enum(COMMODITY_SECTORS).optional().default('all'),
  auto_take_profit: z.boolean().optional().default(true),
  max_trades: z.number().int().min(1).max(10).optional().default(4)
}).strict();

function resolveOwnerId(env, actor) {
  return String(actor?.email || actor?.id || env?.TRINITY_OWNER_EMAIL || 'owner@trinity.local').trim().toLowerCase();
}

function normalizeCommoditySymbol(raw) {
  const clean = String(raw || '').trim().toUpperCase();
  if (!clean) return '';
  if (ALL_COMMODITIES.some(c => c.symbol === clean)) return clean;
  const withEur = clean.endsWith('-EUR') ? clean : `${clean}-EUR`;
  if (ALL_COMMODITIES.some(c => c.symbol === withEur)) return withEur;
  const byName = ALL_COMMODITIES.find(c =>
    c.name.toLowerCase().includes(clean.toLowerCase()) ||
    c.symbol.startsWith(clean)
  );
  return byName ? byName.symbol : withEur;
}

function computeTechnicalProfile(commodity, livePrice, strategy = 'balanced') {
  const price = Number((livePrice || commodity.base_price).toFixed(2));
  const sma20 = Number((price / (1 + (commodity.change_7d_pct / 100) * 0.45)).toFixed(2));
  const sma50 = Number((price / (1 + (commodity.change_30d_pct / 100) * 0.55)).toFixed(2));
  const support = Number((price * (1 - (commodity.volatility_atr_pct * 1.8) / 100)).toFixed(2));
  const resistance = Number((price * (1 + (commodity.volatility_atr_pct * 2.2) / 100)).toFixed(2));
  const stopLoss = Number((price * (1 - Math.max(0.025, (commodity.volatility_atr_pct * 1.5) / 100))).toFixed(2));
  const takeProfit = Number((price * (1 + Math.max(0.055, (commodity.volatility_atr_pct * 3.0) / 100))).toFixed(2));

  let score = 50;
  if (commodity.macd_signal === 'bullish') score += 16;
  if (commodity.macd_signal === 'bearish') score -= 18;
  score += Math.max(-15, Math.min(18, commodity.change_7d_pct * 2.8));
  score += Math.max(-12, Math.min(14, commodity.change_30d_pct * 1.1));

  if (commodity.rsi_14 >= 54 && commodity.rsi_14 <= 66) score += 10;
  else if (commodity.rsi_14 > 72) score -= 12;
  else if (commodity.rsi_14 < 42) score -= 10;

  if (strategy === 'conservative' && commodity.volatility_atr_pct > 2.5) score -= 8;
  if (strategy === 'conservative' && commodity.sector === 'precious_metals') score += 8;
  if (strategy === 'growth' && ['industrial_metals', 'energy', 'strategic_digital'].includes(commodity.sector)) score += 6;
  if (strategy === 'aggressive' && commodity.volatility_atr_pct >= 2.0 && commodity.macd_signal === 'bullish') score += 9;

  score = Math.max(5, Math.min(98, Math.round(score)));

  let signal = 'HOLD';
  let signal_label = 'Držať / Čakať';
  if (score >= 78) {
    signal = 'STRONG_BUY';
    signal_label = 'Silný nákup (Strong Buy)';
  } else if (score >= 62) {
    signal = 'BUY';
    signal_label = 'Kúpiť / Akumulovať (Buy)';
  } else if (score <= 32) {
    signal = 'STRONG_SELL';
    signal_label = 'Silný predaj (Strong Sell)';
  } else if (score <= 44) {
    signal = 'SELL';
    signal_label = 'Predať / Vybrať zisk (Sell)';
  }

  const rewardRisk = Number(((takeProfit - price) / Math.max(0.01, price - stopLoss)).toFixed(2));

  return {
    symbol: commodity.symbol,
    name: commodity.name,
    sector: commodity.sector,
    sector_label: COMMODITY_SECTOR_LABELS[commodity.sector] || commodity.sector,
    unit: commodity.unit,
    price_eur: price,
    change_24h_pct: commodity.change_24h_pct,
    change_7d_pct: commodity.change_7d_pct,
    change_30d_pct: commodity.change_30d_pct,
    rsi_14: commodity.rsi_14,
    sma_20: sma20,
    sma_50: sma50,
    macd_signal: commodity.macd_signal,
    volatility_atr_pct: commodity.volatility_atr_pct,
    support_eur: support,
    resistance_eur: resistance,
    stop_loss_eur: stopLoss,
    take_profit_eur: takeProfit,
    reward_risk_ratio: rewardRisk,
    score,
    signal,
    signal_label,
    fundamental_drivers: commodity.fundamental_drivers,
    thesis_sk: `${commodity.name} (${commodity.symbol}): Cena ${price} EUR/${commodity.unit}, trend 7d ${commodity.change_7d_pct >= 0 ? '+' : ''}${commodity.change_7d_pct}%, RSI ${commodity.rsi_14}, MACD ${commodity.macd_signal}. Signál: ${signal_label} (skóre ${score}/100, R:R ${rewardRisk}x). ${commodity.fundamental_drivers}`
  };
}

export async function ensureCommodityPortfolio(env, ownerId) {
  const existing = await listPortfolios(env, ownerId);
  let target = existing.find(p => /komodit|trinity/i.test(p.name)) || existing[0];
  if (!target) {
    target = await createPortfolio(env, ownerId, {
      name: 'Trinity Komoditné & Investičné Portfólio',
      base_currency: 'EUR',
      starting_cash: 25000,
      max_position_pct: 25,
      max_drawdown_pct: 15
    });
  }
  return getPortfolio(env, ownerId, target.id);
}

async function readDeskState(env) {
  if (!env?.Mastermind?.get) return null;
  try {
    const raw = await env.Mastermind.get(DESK_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeDeskState(env, state) {
  if (!env?.Mastermind?.put) return state;
  await env.Mastermind.put(DESK_STATE_KEY, JSON.stringify(state));
  return state;
}

export async function analyzeCommodities(env, actor, rawInput = {}) {
  const input = commodityAnalyzeSchema.parse(rawInput || {});
  const ownerId = resolveOwnerId(env, actor);

  let quoteMap = new Map();
  try {
    const quotesRes = await env.DB.prepare('SELECT symbol, price_cents, as_of, source FROM trading_quotes WHERE owner_id=? AND currency=?')
      .bind(ownerId, 'EUR')
      .all();
    for (const q of (quotesRes?.results || [])) {
      quoteMap.set(q.symbol, Number((q.price_cents / 100).toFixed(2)));
    }
  } catch {}

  let list = ALL_COMMODITIES;
  if (input.sector && input.sector !== 'all') {
    list = list.filter(c => c.sector === input.sector);
  }
  if (input.symbol && input.symbol.trim()) {
    const targetSym = normalizeCommoditySymbol(input.symbol);
    list = list.filter(c => c.symbol === targetSym || c.name.toLowerCase().includes(input.symbol.trim().toLowerCase()));
  }

  const analyzed = list
    .map(c => computeTechnicalProfile(c, quoteMap.get(c.symbol), input.strategy))
    .sort((a, b) => b.score - a.score);

  const topBuys = analyzed.filter(c => c.signal === 'STRONG_BUY' || c.signal === 'BUY').slice(0, 6);
  const topSells = analyzed.filter(c => c.signal === 'STRONG_SELL' || c.signal === 'SELL').slice(0, 4);

  const avgScore = analyzed.length
    ? Math.round(analyzed.reduce((sum, item) => sum + item.score, 0) / analyzed.length)
    : 50;

  const marketRegime = avgScore >= 60
    ? 'Komoditná expanzia & pro-rastový trend (Bullish Expansion)'
    : avgScore <= 42
    ? 'Defenzívna rotácia & korekcia (Defensive Rotation)'
    : 'Selektívny trh – príležitosti vo vzácnych a strategických kovoch';

  const sectorBreakdown = Object.entries(COMMODITY_SECTOR_LABELS).map(([sectorKey, label]) => {
    const sectorItems = analyzed.filter(i => i.sector === sectorKey);
    const sectorAvg = sectorItems.length
      ? Math.round(sectorItems.reduce((s, x) => s + x.score, 0) / sectorItems.length)
      : 0;
    return {
      sector: sectorKey,
      label,
      count: sectorItems.length,
      avg_score: sectorAvg,
      leader: sectorItems[0]?.symbol || null
    };
  });

  if (input.record_document && analyzed.length) {
    await recordStepDocument(env, {
      title: `Komoditná analýza trhu (${input.sector === 'all' ? 'Všetkých 22 komodít' : input.sector})`,
      category: 'commerce',
      step_name: 'commodity_analyze',
      actor: actor?.email || 'Trinity Commodity Analyst',
      summary: `Režim trhu: ${marketRegime}. Top nákupné signály: ${topBuys.map(x => `${x.symbol} (${x.score}/100)`).join(', ') || 'žiadne'}.`,
      content: analyzed.map(x => `- **${x.name} (${x.symbol})**: ${x.price_eur} EUR/${x.unit} | Signál: **${x.signal_label}** (${x.score}/100) | 7d: ${x.change_7d_pct}% | RSI: ${x.rsi_14} | Stop-Loss: ${x.stop_loss_eur} EUR | Take-Profit: ${x.take_profit_eur} EUR\n  - *Téza*: ${x.fundamental_drivers}`).join('\n'),
      tags: ['commodities', 'analysis', input.strategy]
    });
  }

  return {
    ok: true,
    paper_only: true,
    strategy: input.strategy,
    total_commodities: analyzed.length,
    market_regime: marketRegime,
    average_market_score: avgScore,
    top_buys: topBuys,
    top_sells: topSells,
    sectors: sectorBreakdown,
    commodities: analyzed
  };
}

export async function getCommodityDeskOverview(env, actor, { strategy = 'balanced' } = {}) {
  const ownerId = resolveOwnerId(env, actor);
  const [portfolioBundle, marketAnalysis, deskState] = await Promise.all([
    ensureCommodityPortfolio(env, ownerId),
    analyzeCommodities(env, actor, { sector: 'all', strategy }),
    readDeskState(env)
  ]);

  const analysisBySymbol = new Map(marketAnalysis.commodities.map(c => [c.symbol, c]));
  const enrichedPositions = (portfolioBundle.summary.positions || []).map(pos => {
    const intel = analysisBySymbol.get(pos.symbol);
    const pnlPct = pos.average_cost > 0
      ? Number((((pos.last_price - pos.average_cost) / pos.average_cost) * 100).toFixed(2))
      : 0;
    return {
      ...pos,
      name: intel?.name || pos.symbol,
      sector: intel?.sector || pos.asset_type,
      sector_label: intel?.sector_label || 'Komodita',
      unit: intel?.unit || 'ks',
      pnl_pct: pnlPct,
      signal: intel?.signal || 'HOLD',
      signal_label: intel?.signal_label || 'Držať',
      score: intel?.score || 50,
      take_profit_eur: intel?.take_profit_eur || null,
      stop_loss_eur: intel?.stop_loss_eur || null
    };
  });

  return {
    ok: true,
    paper_only: true,
    portfolio: portfolioBundle.portfolio,
    summary: {
      ...portfolioBundle.summary,
      positions: enrichedPositions
    },
    recent_transactions: (portfolioBundle.transactions || []).slice(-20).reverse(),
    market: marketAnalysis,
    desk_state: deskState || {
      autonomous_enabled: true,
      strategy,
      cycles_run: 0,
      last_cycle_at: null,
      last_cycle_summary: 'Autonómny komoditný desk je pripravený na obchodovanie, predaj a investovanie.'
    }
  };
}

export async function executeCommodityTrade(env, actor, rawInput) {
  const input = commodityTradeSchema.parse(rawInput);
  const ownerId = resolveOwnerId(env, actor);
  const portfolioBundle = await ensureCommodityPortfolio(env, ownerId);
  const portfolioId = portfolioBundle.portfolio.id;

  const normalizedSym = normalizeCommoditySymbol(input.symbol);
  const catalogItem = ALL_COMMODITIES.find(c => c.symbol === normalizedSym);
  const intel = catalogItem ? computeTechnicalProfile(catalogItem, input.price) : null;
  const executionPrice = Number((input.price || intel?.price_eur || 100).toFixed(2));

  let finalQuantity = input.quantity;
  if (input.side === 'sell' && input.sell_all) {
    const heldPos = (portfolioBundle.summary.positions || []).find(p => p.symbol === normalizedSym);
    if (!heldPos || heldPos.quantity <= 0) {
      throw new HttpError(409, `V portfóliu nemáš otvorenú pozíciu pre komoditu ${normalizedSym}.`);
    }
    finalQuantity = heldPos.quantity;
  } else if (!finalQuantity && input.amount_eur) {
    finalQuantity = Number((input.amount_eur / executionPrice).toFixed(4));
  }

  if (!finalQuantity || finalQuantity <= 0) {
    throw new HttpError(400, 'Zadaj platné množstvo (quantity), sumu v EUR (amount_eur) alebo sell_all: true.');
  }

  await setQuote(env, ownerId, {
    symbol: normalizedSym,
    currency: 'EUR',
    price: executionPrice,
    source: 'trinity-commodity-desk'
  });

  const thesisText = input.thesis || (intel
    ? `${input.side === 'buy' ? 'Nákup' : 'Predaj'} komodity ${intel.name} (${normalizedSym}) pri cene ${executionPrice} EUR/${intel.unit}. Signál: ${intel.signal_label} (${intel.score}/100).`
    : `${input.side === 'buy' ? 'Nákup' : 'Predaj'} komodity ${normalizedSym} pri cene ${executionPrice} EUR.`);

  const updatedPortfolio = await recordTrade(env, ownerId, portfolioId, {
    symbol: normalizedSym,
    asset_type: 'commodity',
    side: input.side,
    quantity: finalQuantity,
    price: executionPrice,
    fee: Number(Math.max(0.5, executionPrice * finalQuantity * 0.001).toFixed(2)),
    thesis: thesisText,
    source: 'trinity-commodity-desk'
  });

  const notionalEur = Number((finalQuantity * executionPrice).toFixed(2));
  const doc = await recordStepDocument(env, {
    title: `Komoditný obchod: ${input.side === 'buy' ? 'NÁKUP' : 'PREDAJ'} ${normalizedSym} (${notionalEur} EUR)`,
    category: 'commerce',
    step_name: `commodity_${input.side}`,
    actor: actor?.email || 'Trinity Commodity Trader',
    summary: `${input.side === 'buy' ? 'Nakúpené' : 'Predané'} ${finalQuantity} ${intel?.unit || 'ks'} komodity ${intel?.name || normalizedSym} za ${executionPrice} EUR (spolu ${notionalEur} EUR).`,
    content: [
      `### Detail komoditného obchodu`,
      `- **Komodita:** ${intel?.name || normalizedSym} (\`${normalizedSym}\`)`,
      `- **Operácia:** ${input.side === 'buy' ? 'Nákup (BUY / Investícia)' : 'Predaj (SELL / Realizácia)'}`,
      `- **Množstvo:** ${finalQuantity} ${intel?.unit || 'ks'}`,
      `- **Realizačná cena:** ${executionPrice} EUR`,
      `- **Celkový objem obchodu:** ${notionalEur} EUR`,
      `- **Investičná téza:** ${thesisText}`,
      `- **Nový stav portfólia:** Hodnota (Equity): **${updatedPortfolio.summary.equity} EUR** | Voľná hotovosť: **${updatedPortfolio.summary.cash} EUR** | Realizovaný PnL: **${updatedPortfolio.summary.realized_pnl} EUR**`
    ].join('\n'),
    tags: ['commodity', input.side, normalizedSym]
  });

  return {
    ok: true,
    paper_only: true,
    trade: {
      symbol: normalizedSym,
      name: intel?.name || normalizedSym,
      side: input.side,
      quantity: finalQuantity,
      price_eur: executionPrice,
      notional_eur: notionalEur,
      thesis: thesisText
    },
    portfolio_summary: updatedPortfolio.summary,
    document_id: doc?.id || null
  };
}

export async function runAutonomousCommodityDesk(env, actor, rawInput = {}) {
  const input = commodityAutoInvestSchema.parse(rawInput || {});
  const ownerId = resolveOwnerId(env, actor);
  const overview = await getCommodityDeskOverview(env, actor, { strategy: input.strategy });
  const executedTrades = [];

  // 1. Check existing positions for autonomous SELL (when signal is SELL/STRONG_SELL or take_profit reached)
  if (input.auto_take_profit) {
    for (const pos of (overview.summary.positions || [])) {
      if (pos.signal === 'SELL' || pos.signal === 'STRONG_SELL' || pos.pnl_pct >= 8) {
        try {
          const sellRes = await executeCommodityTrade(env, actor, {
            symbol: pos.symbol,
            side: 'sell',
            sell_all: true,
            price: pos.last_price,
            thesis: `Autonómny predaj Trinity (${input.strategy}): Signál ${pos.signal} / zisk ${pos.pnl_pct}% – uzamknutie výsledku a uvoľnenie kapitálu.`
          });
          executedTrades.push(sellRes.trade);
        } catch {}
      }
    }
  }

  // 2. Select top BUY / STRONG_BUY commodities across sectors and invest autonomously
  const refreshedPortfolio = await ensureCommodityPortfolio(env, ownerId);
  const availableCash = Math.max(0, Number(refreshedPortfolio.summary.cash || 0));
  const deployableBudget = Math.min(input.budget_eur, Number((availableCash * 0.85).toFixed(2)));

  const candidates = overview.market.commodities
    .filter(c => (input.sector === 'all' || c.sector === input.sector) && (c.signal === 'STRONG_BUY' || c.signal === 'BUY'))
    .slice(0, input.max_trades);

  if (deployableBudget >= 50 && candidates.length > 0) {
    const totalScore = candidates.reduce((s, c) => s + c.score, 0) || 1;
    for (const candidate of candidates) {
      const weight = candidate.score / totalScore;
      const allocEur = Number((deployableBudget * weight).toFixed(2));
      if (allocEur < 25) continue;
      try {
        const buyRes = await executeCommodityTrade(env, actor, {
          symbol: candidate.symbol,
          side: 'buy',
          amount_eur: allocEur,
          price: candidate.price_eur,
          thesis: `Autonómna investícia Trinity (${input.strategy}): Skóre ${candidate.score}/100 (${candidate.signal_label}), sektor ${candidate.sector_label}. Stop-Loss ${candidate.stop_loss_eur} EUR, Take-Profit ${candidate.take_profit_eur} EUR. ${candidate.fundamental_drivers}`
        });
        executedTrades.push(buyRes.trade);
      } catch {}
    }
  }

  const finalBundle = await ensureCommodityPortfolio(env, ownerId);
  const prevState = await readDeskState(env);
  const nextState = await writeDeskState(env, {
    autonomous_enabled: true,
    strategy: input.strategy,
    cycles_run: Number(prevState?.cycles_run || 0) + 1,
    last_cycle_at: new Date().toISOString(),
    last_cycle_trades: executedTrades.length,
    last_cycle_summary: `Vykonaných ${executedTrades.length} autonómnych komoditných obchodov (${executedTrades.map(t => `${t.side.toUpperCase()} ${t.symbol} (${t.notional_eur} EUR)`).join(', ') || 'žiadne nové obchody'}). Hodnota portfólia: ${finalBundle.summary.equity} EUR.`
  });

  const doc = await recordStepDocument(env, {
    title: `Autonómny komoditný investičný cyklus (${input.strategy.toUpperCase()}) – ${executedTrades.length} obchodov`,
    category: 'commerce',
    step_name: 'commodity_auto_invest',
    actor: actor?.email || 'Trinity Autonomous Commodity Desk',
    summary: nextState.last_cycle_summary,
    content: [
      `### Súhrn autonómneho komoditného cyklu Trinity`,
      `- **Stratégia:** \`${input.strategy}\``,
      `- **Režim trhu:** ${overview.market.market_regime} (priemerné skóre ${overview.market.average_market_score}/100)`,
      `- **Vykonané obchody (${executedTrades.length}):**`,
      ...(executedTrades.length
        ? executedTrades.map(t => `  - **${t.side.toUpperCase()} ${t.name} (\`${t.symbol}\`)**: ${t.quantity} j. @ ${t.price_eur} EUR = **${t.notional_eur} EUR** — *${t.thesis}*`)
        : ['  - Žiadne nové obchody v tomto cykle.']),
      `- **Aktuálna hodnota portfólia (Equity):** **${finalBundle.summary.equity} EUR**`,
      `- **Voľná hotovosť (Cash):** **${finalBundle.summary.cash} EUR**`,
      `- **Hodnota komoditných pozícií:** **${finalBundle.summary.market_value} EUR**`
    ].join('\n'),
    tags: ['commodities', 'autonomous-investing', input.strategy]
  });

  return {
    ok: true,
    paper_only: true,
    strategy: input.strategy,
    market_regime: overview.market.market_regime,
    trades_executed: executedTrades,
    portfolio_summary: finalBundle.summary,
    desk_state: nextState,
    document_id: doc?.id || null
  };
}
