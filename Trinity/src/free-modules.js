/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module free-modules.js (Trinity/src/free-modules.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity Free Internet Modules & Open-Data Engine
 * Provides verified, live, and 100% factual data from free public internet sources.
 * No simulations or fabricated numbers, in compliance with Truth Policy 2.0.
 */

const USER_AGENT = 'TrinityAssistant/11.0 (+https://auru.space; contact@auru.space)';

export const FREE_MODULES_CATALOG = [
  {
    id: 'weather',
    name: 'Open-Meteo Meteorology',
    category: 'Environment',
    icon: '🌤',
    description: 'Live temperature, humidity, wind, precipitation, and weather forecast for any city worldwide.',
    provider: 'Open-Meteo & WMO',
    license: 'Open Data (CC BY 4.0)',
    rate_limit: 'No API key required, 10,000 requests/day',
    status: 'active'
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia & Wikimedia Knowledge',
    category: 'Encyclopedia & Facts',
    icon: '📖',
    description: 'Verified encyclopedic articles, summaries, definitions, and references from Slovak and global Wikipedia.',
    provider: 'Wikimedia Foundation',
    license: 'CC BY-SA 4.0',
    rate_limit: 'No API key required, public REST API',
    status: 'active'
  },
  {
    id: 'dns_doh',
    name: 'Cloudflare DNS over HTTPS (DoH)',
    category: 'Network & Security',
    icon: '🛡',
    description: 'Cryptographically verified real-time DNS record lookup (A, AAAA, MX, TXT, CNAME) and domain status checks.',
    provider: 'Cloudflare 1.1.1.1 DoH',
    license: 'Public resolver service',
    rate_limit: 'No API key required, global anycast network',
    status: 'active'
  },
  {
    id: 'crypto_markets',
    name: 'DefiLlama On-Chain & Crypto Markets',
    category: 'Finance & Web3',
    icon: '🪙',
    description: 'Real spot prices of crypto assets, blockchain TVL, and protocol data without intermediary fees.',
    provider: 'DefiLlama Open API',
    license: 'Open Data',
    rate_limit: 'No API key required, real-time indexer',
    status: 'active'
  },
  {
    id: 'tech_news',
    name: 'Hacker News Tech Radar',
    category: 'Technology & AI',
    icon: '⚡',
    description: 'Latest stories, discussions, and innovations from the global technology scene.',
    provider: 'Y Combinator / Hacker News Firebase',
    license: 'Public API',
    rate_limit: 'No API key required, official read endpoint',
    status: 'active'
  },
  {
    id: 'world_bank',
    name: 'World Bank Global Economy',
    category: 'Macroeconomics',
    icon: '🌐',
    description: 'Official macroeconomic statistics: GDP, growth, inflation, population, and emissions across countries.',
    provider: 'World Bank Open Data',
    license: 'CC BY-4.0 Open Data',
    rate_limit: 'No API key required, official REST endpoint',
    status: 'active'
  }
];

export async function fetchWeather(query, { fetchImpl = globalThis.fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return { available: false, reason: 'Please provide a city or location name.' };

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=sk`;
    const geoRes = await fetchImpl(geoUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!geoRes.ok) {
      return { available: false, reason: `Geocoding failed (HTTP ${geoRes.status})`, query: q };
    }

    const geoData = await geoRes.json();
    if (!geoData.results || !geoData.results.length) {
      return { available: false, reason: `Location "${q}" was not found in the geocoding database.`, query: q };
    }

    const place = geoData.results[0];
    const { latitude, longitude, name, country, elevation } = place;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const weatherRes = await fetchImpl(weatherUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!weatherRes.ok) {
      return { available: false, reason: `Weather service unavailable (HTTP ${weatherRes.status})`, query: q };
    }

    const data = await weatherRes.json();
    return {
      available: true,
      location: {
        name,
        country: country || place.country_code,
        latitude,
        longitude,
        elevation
      },
      current: {
        temperature_c: data.current?.temperature_2m,
        humidity_pct: data.current?.relative_humidity_2m,
        precipitation_mm: data.current?.precipitation,
        wind_speed_kmh: data.current?.wind_speed_10m,
        time: data.current?.time
      },
      daily_forecast: {
        dates: data.daily?.time || [],
        temp_max_c: data.daily?.temperature_2m_max || [],
        temp_min_c: data.daily?.temperature_2m_min || [],
        precipitation_sum_mm: data.daily?.precipitation_sum || []
      },
      source: 'Open-Meteo & WMO',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Connection error while querying meteorology service.', query: q };
  }
}

export async function fetchWikipedia(query, { lang = 'sk', fetchImpl = globalThis.fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return { available: false, reason: 'Please provide a search term or topic.' };

  const language = ['sk', 'en', 'cz', 'de', 'fr'].includes(lang) ? lang : 'sk';
  try {
    const wikiUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}`;
    const res = await fetchImpl(wikiUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (res.status === 404) {
      return { available: false, reason: `Article "${q}" was not found on Wikipedia (${language}).`, query: q };
    }
    if (!res.ok) {
      return { available: false, reason: `Wikipedia returned HTTP ${res.status}`, query: q };
    }

    const data = await res.json();
    return {
      available: true,
      title: data.title,
      description: data.description || null,
      extract: data.extract,
      url: data.content_urls?.desktop?.page || null,
      thumbnail: data.thumbnail?.source || null,
      coordinates: data.coordinates || null,
      language,
      source: 'Wikimedia / Wikipedia',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Connection error while querying Wikipedia.', query: q };
  }
}

export async function resolveDns(domain, type = 'A', { fetchImpl = globalThis.fetch } = {}) {
  const d = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!d || !d.includes('.')) return { available: false, reason: 'Please provide a valid domain name (e.g., auru.space).' };

  const validTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
  const recordType = validTypes.includes(type.toUpperCase()) ? type.toUpperCase() : 'A';

  try {
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=${encodeURIComponent(recordType)}`;
    const res = await fetchImpl(dohUrl, {
      headers: {
        'Accept': 'application/dns-json',
        'User-Agent': USER_AGENT
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { available: false, reason: `DoH resolver failed (HTTP ${res.status})`, domain: d };
    }

    const data = await res.json();
    const answers = (data.Answer || []).map(a => ({
      name: a.name,
      type: recordType,
      ttl_seconds: a.TTL,
      data: a.data
    }));

    return {
      available: true,
      domain: d,
      type: recordType,
      status: data.Status === 0 ? 'NOERROR' : `RCODE_${data.Status}`,
      dnssec_validated: Boolean(data.AD),
      answers,
      source: 'Cloudflare 1.1.1.1 DoH',
      verified_truth: true,
      queried_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Connection error while querying DNS resolver.', domain: d };
  }
}

export async function fetchCryptoMarkets(coins = ['bitcoin', 'ethereum', 'solana'], { fetchImpl = globalThis.fetch } = {}) {
  const validCoins = (Array.isArray(coins) ? coins : [coins])
    .map(c => String(c).trim().toLowerCase())
    .filter(Boolean);

  if (!validCoins.length) return { available: false, reason: 'Please provide at least one cryptocurrency.' };

  try {
    const keys = validCoins.map(c => `coingecko:${c}`).join(',');
    const url = `https://coins.llama.fi/prices/current/${keys}`;
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { available: false, reason: `DefiLlama API returned HTTP ${res.status}` };
    }

    const data = await res.json();
    const resultCoins = [];

    for (const c of validCoins) {
      const item = data.coins?.[`coingecko:${c}`];
      if (item) {
        resultCoins.push({
          id: c,
          symbol: item.symbol,
          price_usd: item.price,
          confidence: item.confidence,
          timestamp: item.timestamp ? new Date(item.timestamp * 1000).toISOString() : null
        });
      }
    }

    return {
      available: true,
      count: resultCoins.length,
      coins: resultCoins,
      source: 'DefiLlama Open API',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Connection error while querying market data.' };
  }
}

export async function fetchTechNews(limit = 10, { fetchImpl = globalThis.fetch } = {}) {
  const maxStories = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

  try {
    const topUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const topRes = await fetchImpl(topUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!topRes.ok) {
      return { available: false, reason: `Hacker News API returned HTTP ${topRes.status}` };
    }

    const ids = (await topRes.json()).slice(0, maxStories);
    const storyPromises = ids.map(async id => {
      try {
        const itemRes = await fetchImpl(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(5000)
        });
        if (!itemRes.ok) return null;
        const item = await itemRes.json();
        return {
          id: item.id,
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          by: item.by,
          score: item.score,
          comments_count: item.descendants || 0,
          published_at: item.time ? new Date(item.time * 1000).toISOString() : null
        };
      } catch {
        return null;
      }
    });

    const stories = (await Promise.all(storyPromises)).filter(Boolean);
    return {
      available: true,
      count: stories.length,
      stories,
      source: 'Hacker News (Y Combinator)',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Failed to fetch technology news.' };
  }
}

export async function fetchWorldBankIndicator(countryCode = 'SVK', indicator = 'NY.GDP.MKTP.CD', { fetchImpl = globalThis.fetch } = {}) {
  const c = String(countryCode || 'SVK').trim().toUpperCase();
  const ind = String(indicator || 'NY.GDP.MKTP.CD').trim();

  try {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(c)}/indicator/${encodeURIComponent(ind)}?format=json&date=2020:2026`;
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { available: false, reason: `World Bank API returned HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
      return { available: false, reason: `No data available for country ${c} and indicator ${ind}.` };
    }

    const records = json[1].filter(r => r.value != null).map(r => ({
      year: r.date,
      value: r.value,
      country_name: r.country?.value || c,
      indicator_name: r.indicator?.value || ind
    }));

    return {
      available: true,
      country_code: c,
      indicator: ind,
      indicator_name: records[0]?.indicator_name || ind,
      country_name: records[0]?.country_name || c,
      records,
      source: 'World Bank Open Data',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Connection error while querying World Bank API.' };
  }
}
