/**
 * Trinity Copilot Skill Registry
 * Komplexný zoznam skillov a pluginov pre agenta TrinityCopilotAgent:
 * 1️⃣ Core skilly (validácia, timeout, HTTP status, štruktúra, audit, retry, circuit-breaker, rate-limiting, cache, metriky)
 * 2️⃣ Integrácie s externými službami (Power Platform / Copilot Studio, Web search, Generovanie obrázkov, Text analysis, Výpočty a štatistika, PC Bridge, Git, D1, R2)
 * 3️⃣ Užívateľské skilly (Dialog management, Multilingual support, Fallback, Rich-response formatting, Rate-limited UI feedback, Security & sanitisation)
 */

import {runPracticalTool} from './practical-skills.js';

// In-memory cache a fallback stav circuit-breakeru
const memoryCache = new Map();
const memoryCbState = new Map();
const memoryRateLimits = new Map();
const memorySessions = new Map();

/**
 * 1️⃣ ZÁKLADNÉ SKILLY (CORE)
 */
export const coreSkills = {
  // Validácia vstupu: overí, že query je neprázdny reťazec a prípadne ďalšie parametre
  validateInput: (query, options = {}) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error("Parameter 'query' must be a non-empty string");
    }
    if (options.maxResults !== undefined && (typeof options.maxResults !== 'number' || options.maxResults <= 0)) {
      throw new Error("Parameter 'maxResults' must be a positive number");
    }
    if (options.timeoutMs !== undefined && (typeof options.timeoutMs !== 'number' || options.timeoutMs < 500)) {
      throw new Error("Parameter 'timeoutMs' must be at least 500ms");
    }
    return { valid: true, query: query.trim(), options };
  },

  // Timeout & AbortController: zabránia nekonečnému čakaniu na odpoveď
  withTimeout: async (fnOrPromise, timeoutMs = 8000, externalSignal = null) => {
    const controller = new AbortController();
    let abortedByExternal = false;
    const onExternalAbort = () => {
      abortedByExternal = true;
      controller.abort();
    };
    if (externalSignal) {
      if (externalSignal.aborted) {
        throw new Error('Operation was aborted prior to execution');
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const promise = typeof fnOrPromise === 'function' ? fnOrPromise(controller.signal) : fnOrPromise;
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            if (abortedByExternal) {
              reject(new Error('Operation aborted by user signal'));
            } else {
              reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }
          }, { once: true });
        })
      ]);
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  },

  // Kontrola HTTP statusu: rýchlo odhalí 4xx/5xx chyby
  checkHttpStatus: async (response) => {
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${txt}`);
    }
    return response;
  },

  // Kontrola štruktúry odpovede: zabezpečí, že API vráti očakávané pole/objekt
  checkResponseStructure: (data, requiredFields = []) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response structure: expected an object or array');
    }
    if (Array.isArray(requiredFields) && requiredFields.length > 0) {
      const missing = requiredFields.filter(f => typeof data[f] === 'undefined');
      if (missing.length > 0) {
        throw new Error(`Missing required response field: '${missing.join(', ')}'`);
      }
    }
    return data;
  },

  // Centralizované logovanie: zapisuje chyby a udalosti do konzoly a do D1 tabuľky audit / ops_events
  logAudit: async (env, level, message, details = null) => {
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[TrinityCopilotAgent ${String(level).toUpperCase()}]:`, message, details ? JSON.stringify(details) : '');
    
    const timestamp = new Date().toISOString();
    if (env?.DB) {
      const detailsJson = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
      try {
        await env.DB.prepare("INSERT INTO audit (timestamp, level, message, details) VALUES (datetime('now'), ?, ?, ?)")
          .bind(level, message, detailsJson).run();
      } catch (err) {
        // Ak tabuľka audit ešte neexistuje, fallback na ops_events
        try {
          await env.DB.prepare("INSERT INTO ops_events (action, details) VALUES (?, ?)")
            .bind('copilot_audit', JSON.stringify({ level, message, details, timestamp })).run();
        } catch (_) {}
      }
    }
    return { logged: true, level, message, timestamp };
  },

  // Retry s exponenciálnym backoffom: pri dočasných chybách (502, 503, 504, 429) automaticky zopakuje požiadavku
  withRetry: async (fn, args = [], retries = 3, backoff = 500, retryableStatusCodes = [502, 503, 504, 429]) => {
    let attempt = 0;
    while (true) {
      try {
        return await fn(...args);
      } catch (e) {
        attempt++;
        const statusMatch = e.message?.match(/HTTP\s+(\d{3})/i);
        const status = statusMatch ? parseInt(statusMatch[1], 10) : null;
        
        // Ak ide o trvalú klientsku chybu (okrem 429), neopakuj
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw e;
        }
        if (attempt > retries) {
          throw e;
        }
        const delay = backoff * (2 ** (attempt - 1));
        await new Promise(r => setTimeout(r, delay));
      }
    }
  },

  // Circuit-breaker: po niekoľkých neúspešných pokusoch dočasne “vypne” volanie
  circuitBreaker: {
    async getState(serviceKey, env) {
      let raw = null;
      if (env?.CB_STATE) raw = await env.CB_STATE.get(`cb:${serviceKey}`);
      else if (env?.Mastermind) raw = await env.Mastermind.get(`cb:${serviceKey}`);
      if (raw) {
        try { return JSON.parse(raw); } catch {}
      }
      return memoryCbState.get(serviceKey) || { state: 'CLOSED', failures: 0, lastFailure: 0, nextAttempt: 0 };
    },
    async setState(serviceKey, stateObj, env, ttlSeconds = 300) {
      memoryCbState.set(serviceKey, stateObj);
      const str = JSON.stringify(stateObj);
      if (env?.CB_STATE) await env.CB_STATE.put(`cb:${serviceKey}`, str, { expirationTtl: ttlSeconds });
      else if (env?.Mastermind) await env.Mastermind.put(`cb:${serviceKey}`, str, { expirationTtl: ttlSeconds });
    },
    async check(serviceKey, env, threshold = 5, cooldownMs = 30000) {
      const current = await this.getState(serviceKey, env);
      const now = Date.now();
      if (current.state === 'OPEN') {
        if (now >= current.nextAttempt) {
          current.state = 'HALF_OPEN';
          await this.setState(serviceKey, current, env);
          return true;
        }
        throw new Error(`Circuit-breaker is OPEN for service '${serviceKey}'. Service temporarily paused to protect backend.`);
      }
      return true;
    },
    async recordSuccess(serviceKey, env) {
      const current = { state: 'CLOSED', failures: 0, lastFailure: 0, nextAttempt: 0 };
      await this.setState(serviceKey, current, env);
    },
    async recordFailure(serviceKey, env, threshold = 5, cooldownMs = 30000) {
      const current = await this.getState(serviceKey, env);
      current.failures = (current.failures || 0) + 1;
      current.lastFailure = Date.now();
      if (current.failures >= threshold || current.state === 'HALF_OPEN') {
        current.state = 'OPEN';
        current.nextAttempt = Date.now() + cooldownMs;
      }
      await this.setState(serviceKey, current, env);
    },
    async execute(serviceKey, fn, env, options = {}) {
      const threshold = options.threshold || 5;
      const cooldownMs = options.cooldownMs || 30000;
      await this.check(serviceKey, env, threshold, cooldownMs);
      try {
        const result = await fn();
        await this.recordSuccess(serviceKey, env);
        return result;
      } catch (error) {
        await this.recordFailure(serviceKey, env, threshold, cooldownMs);
        throw error;
      }
    },
    async reset(serviceKey, env) {
      await this.recordSuccess(serviceKey, env);
    }
  },

  // Rate-limiting: ochrana pred prekročením limitov API (napr. 60 req/min)
  rateLimiter: async (key, env, options = { limit: 60, windowSeconds: 60 }) => {
    const limit = options.limit || 60;
    const windowSec = options.windowSeconds || 60;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSec);
    const storageKey = `rate:${key}:${windowStart}`;

    let count = 0;
    if (env?.RATE_LIMIT) {
      const val = await env.RATE_LIMIT.get(storageKey);
      count = val ? parseInt(val, 10) : 0;
      if (count >= limit) {
        throw new Error(`Rate limit exceeded for '${key}'. Maximum ${limit} requests per ${windowSec}s.`);
      }
      await env.RATE_LIMIT.put(storageKey, String(count + 1), { expirationTtl: windowSec * 2 });
    } else if (env?.DB) {
      try {
        const row = await env.DB.prepare('SELECT count FROM ops_limits WHERE key=? AND window=?').bind(key, windowStart).first();
        count = row?.count || 0;
        if (count >= limit) {
          throw new Error(`Rate limit exceeded for '${key}'. Maximum ${limit} requests per ${windowSec}s.`);
        }
        await env.DB.prepare('INSERT INTO ops_limits (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count=count+1, window=?')
          .bind(key, windowStart, windowStart).run();
      } catch (e) {
        if (e.message?.includes('Rate limit')) throw e;
        // In-memory fallback
        count = memoryRateLimits.get(storageKey) || 0;
        if (count >= limit) throw new Error(`Rate limit exceeded for '${key}'. Maximum ${limit} requests per ${windowSec}s.`);
        memoryRateLimits.set(storageKey, count + 1);
      }
    } else {
      count = memoryRateLimits.get(storageKey) || 0;
      if (count >= limit) {
        throw new Error(`Rate limit exceeded for '${key}'. Maximum ${limit} requests per ${windowSec}s.`);
      }
      memoryRateLimits.set(storageKey, count + 1);
    }
    return { allowed: true, count: count + 1, limit, remaining: Math.max(0, limit - (count + 1)) };
  },

  // Caching: ukladá výsledky do KV na krátky čas (30s – 5min)
  cacheGet: async (key, env) => {
    try {
      if (env?.CACHE) {
        const val = await env.CACHE.get(key);
        return val ? JSON.parse(val) : null;
      }
      if (env?.Mastermind) {
        const val = await env.Mastermind.get(key);
        return val ? JSON.parse(val) : null;
      }
    } catch (_) {}
    const mem = memoryCache.get(key);
    if (mem && mem.expiresAt > Date.now()) return mem.value;
    return null;
  },

  cachePut: async (key, data, env, ttlSeconds = 120) => {
    const str = JSON.stringify(data);
    try {
      if (env?.CACHE) {
        await env.CACHE.put(key, str, { expirationTtl: ttlSeconds });
        return true;
      }
      if (env?.Mastermind) {
        await env.Mastermind.put(key, str, { expirationTtl: ttlSeconds });
        return true;
      }
    } catch (_) {}
    memoryCache.set(key, { value: data, expiresAt: Date.now() + (ttlSeconds * 1000) });
    return true;
  },

  // Audit & metriky: zaznamená čas spracovania, status kódu, typ chyby
  recordMetrics: (env, metricName, value = 1, type = 'counter') => {
    if (env?.METRICS) {
      try {
        if (type === 'timing' && typeof env.METRICS.timing === 'function') {
          env.METRICS.timing(metricName, value);
        } else if (typeof env.METRICS.increment === 'function') {
          env.METRICS.increment(metricName, value);
        } else if (typeof env.METRICS.writeDataPoint === 'function') {
          env.METRICS.writeDataPoint({ blobs: [metricName, type], doubles: [value] });
        }
      } catch (_) {}
    }
    return { metric: metricName, value, type, recorded_at: new Date().toISOString() };
  }
};

/**
 * 2️⃣ INTEGRÁCIE S EXTERNÝMI SLUŽBAMI
 */
export const integrationSkills = {
  // Power Platform / Copilot Studio: volanie oficiálneho endpointu Copilot Studio
  callPowerPlatform: async (query, env, options = {}) => {
    const endpoint = options.endpoint || (
      env?.POWER_PLATFORM_URL
        ? `${env.POWER_PLATFORM_URL}/copilotstudio/dataverse-backed/authenticated/bots/${options.botId || env.BOT_ID || 'default-bot'}/conversations?api-version=${env.API_VER || '2022-03-01-preview'}`
        : null
    );

    if (!endpoint) {
      if (options.mock) {
        return {
          conversations: [{
            id: 'mock-conv-' + Date.now(),
            reply: `[Power Platform Demo] Odpoveď na dotaz: "${query}"`,
            created_at: new Date().toISOString()
          }]
        };
      }
      throw new Error('POWER_PLATFORM_URL nie je nakonfigurovaná.');
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 8000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.token || env.POWER_PLATFORM_TOKEN || ''}`
        },
        body: JSON.stringify({ query, ...(options.body || {}) }),
        signal: controller.signal
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${txt}`);
      }

      const data = await resp.json();
      if (!data || (typeof data.conversations === 'undefined' && typeof data.response === 'undefined' && typeof data.reply === 'undefined')) {
        throw new Error('Missing conversations or response field in Copilot Studio response');
      }
      return data.conversations || data.response || data;
    } finally {
      clearTimeout(timeout);
    }
  },

  // Web-search: vyhľadá informácie na internete a vráti relevantné úryvky
  webSearch: async (query, env, options = {}) => {
    if (options.mock) {
      return {
        query,
        results: [
          { title: 'Prehľad: ' + query, url: 'https://example.com/search?q=' + encodeURIComponent(query), snippet: 'Ukážka výsledku vyhľadávania pre ' + query }
        ]
      };
    }
    const token = env?.OLLAMA_API_KEY || (typeof env?.OLLAMA_SECRET === 'string' ? env.OLLAMA_SECRET : null);
    if (!token) {
      return { query, results: [], note: 'Webové vyhľadávanie vyžaduje aktívny kľúč OLLAMA_API_KEY alebo Bing konektor.' };
    }
    const r = await fetch('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: options.maxResults || 3 }),
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error(`Web search HTTP ${r.status}`);
    const data = await r.json();
    return {
      query,
      results: (data.results || []).map(item => ({
        title: item.title,
        url: item.url,
        content: (item.content || '').slice(0, 3000)
      }))
    };
  },

  // Generovanie obrázkov: vytvorí vizuálny výstup cez Workers AI a uloží do R2
  generateImage: async (prompt, env, options = {}) => {
    if (!env?.AI || (!env?.ARTIFACTS && !env?.R2)) {
      if (options.mock) {
        return { id: 'mock-img-id', url: '/media/mock-image.jpg', prompt, mock: true };
      }
      throw new Error('Generovanie obrázkov vyžaduje Workers AI a R2 bucket (ARTIFACTS).');
    }
    const model = env.IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
    const generated = await env.AI.run(model, { prompt });
    let bytes;
    if (typeof generated?.image === 'string') bytes = Uint8Array.from(Buffer.from(generated.image, 'base64'));
    else if (generated instanceof Uint8Array) bytes = generated;
    else if (generated instanceof ArrayBuffer) bytes = new Uint8Array(generated);
    else throw new Error('Generovanie obrázka vrátilo neznámy formát');

    const id = crypto.randomUUID();
    const key = `media/copilot/${id}.jpg`;
    const bucket = env.R2 || env.ARTIFACTS;
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: 'image/jpeg' },
      customMetadata: { prompt: prompt.slice(0, 500), generated_by: 'TrinityCopilotAgent' }
    });
    return { id, key, url: `/api/assistant/media/images/${id}`, prompt };
  },

  // Text-analysis: počet slov, vety, sentiment a extrakcia entít
  analyzeText: (text) => {
    if (typeof text !== 'string') throw new Error('analyzeText requires string input');
    const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
    const characters = [...text].length;
    const withoutUrlsOrEmails = text
      .replace(/https?:\/\/[^\s<>()]+/g, ' ')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, ' ');
    const sentences = withoutUrlsOrEmails.trim() ? withoutUrlsOrEmails.split(/(?<=[.!?])\s+|\s*[.!?]+$/).filter(x => x.trim()).length : 0;
    const readingMinutes = Math.ceil(words.length / 200);

    // Extrakcia entít
    const emails = [...new Set(text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [])];
    const urls = [...new Set((text.match(/https?:\/\/[^\s<>()]+/g) || []).map(u => u.replace(/[.,;!?]+$/, '')))];
    const dates = [...new Set(text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\s?\d{1,2}\.\s?\d{4})\b/g) || [])];

    // Jednoduchá analýza sentimentu
    const posWords = ['super', 'výborn', 'skvel', 'úspešn', 'perfekt', 'dobre', 'good', 'great', 'awesome', 'excellent', 'success', 'happy'];
    const negWords = ['chyba', 'zlyha', 'problém', 'špatn', 'zlý', 'fail', 'error', 'broken', 'bad', 'poor', 'danger', 'warn'];
    const lower = text.toLowerCase();
    let posCount = 0, negCount = 0;
    for (const p of posWords) if (lower.includes(p)) posCount++;
    for (const n of negWords) if (lower.includes(n)) negCount++;

    const sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';
    const score = posCount - negCount;

    return {
      characters,
      words: words.length,
      sentences,
      reading_minutes: readingMinutes,
      entities: { emails, urls, dates },
      sentiment: { label: sentiment, score, positive_signals: posCount, negative_signals: negCount }
    };
  },

  // Výpočty a štatistika
  calculate: (operation, values) => {
    if (!Array.isArray(values) || !values.length) throw new Error('calculate requires non-empty array of numbers');
    if (operation === 'add') return values.reduce((a, b) => a + b, 0);
    if (operation === 'subtract') return values.slice(1).reduce((a, b) => a - b, values[0]);
    if (operation === 'multiply') return values.reduce((a, b) => a * b, 1);
    if (operation === 'divide') {
      if (values.slice(1).includes(0)) throw new Error('Delenie nulou nie je povolené.');
      return values.slice(1).reduce((a, b) => a / b, values[0]);
    }
    if (operation === 'mean') return values.reduce((a, b) => a + b, 0) / values.length;
    throw new Error(`Nepodporovaná operácia: ${operation}`);
  },

  statistics: (values, percentile = null) => {
    return runPracticalTool('statistics', { values, ...(percentile !== null ? { percentile } : {}) });
  },

  // PC Bridge – spúšťanie skriptov na PC s overeným SHA-256 a timeoutom
  pcRunScript: async (command, env, options = {}) => {
    if (!command || typeof command !== 'string') throw new Error('pcRunScript vyžaduje príkaz ako reťazec.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(command));
    const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');

    if (options.mock) {
      return { success: true, sha256, command, stdout: 'Mock script execution OK', stderr: '', exit_code: 0 };
    }

    if (!env?.PC_BRIDGE && !env?.TRINITY_PC_BRIDGE) {
      throw new Error('PC Bridge nie je prepojený alebo dostupný.');
    }

    const bridge = env.PC_BRIDGE || env.TRINITY_PC_BRIDGE;
    const resp = await bridge.fetch('http://pc-bridge/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Command-SHA256': sha256,
        'Authorization': `Bearer ${env.TRINITY_GATEWAY_KEY || ''}`
      },
      body: JSON.stringify({ command, timeout: options.timeoutMs || 15000, cwd: options.cwd || null })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`PC Bridge error HTTP ${resp.status}: ${err}`);
    }
    return await resp.json();
  },

  // Git / CI-CD – commitovanie a PR
  pcGitCommit: async (message, env, options = {}) => {
    return integrationSkills.pcRunScript(`git commit -m "${message.replace(/"/g, '\\"')}"`, env, options);
  },

  pcGitPr: async (title, head, env, options = {}) => {
    const cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" --head "${head}" --body "${(options.body || '').replace(/"/g, '\\"')}"`;
    return integrationSkills.pcRunScript(cmd, env, options);
  },

  // Databáza D1 – perzistentné úložisko
  dbPersist: async (table, data, env) => {
    if (!env?.DB) throw new Error('Databáza D1 nie je dostupná.');
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    await env.DB.prepare(sql).bind(...columns.map(c => data[c])).run();
    return { table, persisted: true };
  },

  dbQuery: async (sql, params = [], env) => {
    if (!env?.DB) throw new Error('Databáza D1 nie je dostupná.');
    const stmt = env.DB.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.all();
  },

  // R2 – úložisko pre súbory a obrázky
  r2Store: async (key, body, contentType = 'application/octet-stream', env) => {
    const bucket = env?.R2 || env?.ARTIFACTS;
    if (!bucket) throw new Error('R2 úložisko nie je dostupné.');
    await bucket.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: { stored_at: new Date().toISOString() }
    });
    return { key, stored: true };
  },

  r2Get: async (key, env) => {
    const bucket = env?.R2 || env?.ARTIFACTS;
    if (!bucket) throw new Error('R2 úložisko nie je dostupné.');
    return await bucket.get(key);
  }
};

/**
 * 3️⃣ UŽÍVATEĽSKÉ SKILLY
 */
export const userSkills = {
  // Dialog-management: udržiava kontext medzi viacerými otázkami (session ID, históriu)
  dialogManagement: {
    async getContext(sessionId, env) {
      if (!sessionId) return [];
      if (env?.DB) {
        try {
          const row = await env.DB.prepare('SELECT history FROM copilot_sessions WHERE session_id=?').bind(sessionId).first();
          if (row?.history) return JSON.parse(row.history);
        } catch (_) {}
      }
      if (env?.CACHE) {
        try {
          const val = await env.CACHE.get(`session:${sessionId}`);
          if (val) return JSON.parse(val);
        } catch (_) {}
      }
      return memorySessions.get(sessionId) || [];
    },

    async saveContext(sessionId, newTurns, env, maxTurns = 12) {
      if (!sessionId) return;
      const current = await this.getContext(sessionId, env);
      const updated = [...current, ...(Array.isArray(newTurns) ? newTurns : [newTurns])].slice(-maxTurns);
      const str = JSON.stringify(updated);

      if (env?.DB) {
        try {
          await env.DB.prepare("INSERT INTO copilot_sessions (session_id, history, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(session_id) DO UPDATE SET history=excluded.history, updated_at=datetime('now')")
            .bind(sessionId, str).run();
        } catch (_) {}
      }
      if (env?.CACHE) {
        try {
          await env.CACHE.put(`session:${sessionId}`, str, { expirationTtl: 86400 });
        } catch (_) {}
      }
      memorySessions.set(sessionId, updated);
      return updated;
    },

    async clearSession(sessionId, env) {
      if (!sessionId) return;
      memorySessions.delete(sessionId);
      if (env?.DB) {
        try {
          await env.DB.prepare('DELETE FROM copilot_sessions WHERE session_id=?').bind(sessionId).run();
        } catch (_) {}
      }
      if (env?.CACHE) {
        try {
          await env.CACHE.delete(`session:${sessionId}`);
        } catch (_) {}
      }
      return { cleared: true, sessionId };
    }
  },

  // Multilingual support: automatické rozpoznanie jazyka a prekladová podpora
  detectLanguage: (text) => {
    if (!text || typeof text !== 'string') return 'sk';
    const lower = text.toLowerCase();
    if (/\b(the|is|are|and|with|for|you|have|this|that|what|how)\b/i.test(lower)) return 'en';
    if (/\b(und|der|die|das|ist|nicht|mit|für|eine)\b/i.test(lower)) return 'de';
    if (/\b(a|je|jsou|se|pro|jak|kdo|kde|co|byl)\b/i.test(lower) && /[ěščřžýáíéůú]/.test(lower) && !/[ôäľŕ]/.test(lower)) return 'cs';
    if (/\b(le|la|les|est|sont|dans|pour|avec|vous)\b/i.test(lower)) return 'fr';
    if (/\b(el|la|los|las|es|son|por|para|con)\b/i.test(lower)) return 'es';
    return 'sk';
  },

  multilingualSupport: (text, targetLang = 'sk') => {
    const detected = userSkills.detectLanguage(text);
    return {
      source_text: text,
      detected_language: detected,
      target_language: targetLang,
      directive: targetLang === 'sk'
        ? 'Odpovedaj prirodzene, jasne a spisovne v slovenčine.'
        : `Answer naturally, clearly and fluently in language code: ${targetLang}.`
    };
  },

  // Fallback & fallback-prompt: keď agent nedokáže odpovedať, vráti preddefinovaný text a ponúkne alternatívy
  fallbackHandler: (query, lastError = null, options = {}) => {
    const lang = userSkills.detectLanguage(query);
    const errMessage = lastError ? (typeof lastError === 'string' ? lastError : lastError.message) : '';

    if (lang === 'en') {
      return {
        type: 'fallback',
        content: `I apologize, but I could not fulfill this request right now (${errMessage || 'Upstream service unavailable'}).`,
        suggestions: [
          'Try rephrasing your question more specifically.',
          'Check system status or connectivity in Settings.',
          'Try running with alternative tool or provider.'
        ],
        query,
        error: errMessage
      };
    }

    return {
      type: 'fallback',
      content: `Prepáč, na tento dotaz sa mi momentálne nepodarilo získať overenú odpoveď (${errMessage || 'Služba je dočasne nedostupná'}).`,
      suggestions: [
        'Skús otázku preformulovať konkrétnejšie.',
        'Over stav pripojenia a konektorov v nastaveniach Trinity.',
        'Použi alternatívny nástroj alebo zopakuj požiadavku o chvíľu.'
      ],
      query,
      error: errMessage
    };
  },

  // Rich-response formatting: vráti štruktúrovaný JSON s typmi (text, markdown, table, image URL)
  formatRichResponse: (type, content, metadata = {}) => {
    return {
      type, // 'text' | 'markdown' | 'table' | 'image' | 'json' | 'fallback' | 'error'
      content,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  },

  // Rate-limited UI feedback: HTTP 202 + Location header na polling endpoint
  rateLimitedFeedback: (jobId, status = 'processing', location = null) => {
    return {
      status: 202,
      job_id: jobId,
      state: status,
      location: location || `/api/copilot/jobs/${jobId}`,
      poll_interval_ms: 1500,
      message: 'Spracúvam požiadavku na pozadí...'
    };
  },

  // Security & sanitisation: odstráni XSS, bráni SQL injection, maskuje citlivé údaje
  securitySanitise: {
    sanitizeHtml: (input) => {
      if (typeof input !== 'string') return '';
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\bjavascript:/gi, '')
        .trim();
    },

    detectSqlInjection: (input) => {
      if (typeof input !== 'string') return false;
      const patterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
        /(\bUNION\s+SELECT\b)/i,
        /(--|\/\*|\*\/|;)/
      ];
      return patterns.some(p => p.test(input));
    },

    redactSensitive: (input) => {
      if (typeof input !== 'string') return '';
      return input
        .replace(/\b(?:sk-|ghp_|trn_live_|Bearer\s+)[A-Za-z0-9._-]{16,}\b/gi, '[REDACTED_TOKEN]')
        .replace(/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g, '[REDACTED_CARD]')
        .replace(/(password|passwd|secret)\s*[:=]\s*["']?[^"'\s]+["']?/gi, '$1=[REDACTED]');
    }
  }
};

/**
 * Celý zjednotený objekt skills (tak ako je v zadaní)
 */
export const skills = {
  ...coreSkills,
  ...integrationSkills,
  ...userSkills
};

/**
 * 4️⃣ DYNAMICKÝ SKILL REGISTRY PRE TRINITY
 */
class SkillRegistry {
  constructor() {
    this._customSkills = new Map();
  }

  register(name, fn, meta = {}) {
    if (!name || typeof fn !== 'function') {
      throw new Error('register vyžaduje neprázdny názov a funkciu');
    }
    this._customSkills.set(name, { fn, meta, registeredAt: new Date().toISOString() });
    return this;
  }

  get(name) {
    if (this._customSkills.has(name)) {
      return this._customSkills.get(name).fn;
    }
    return skills[name] || null;
  }

  has(name) {
    return this._customSkills.has(name) || Boolean(skills[name]);
  }

  list() {
    const builtinList = Object.keys(skills).map(name => ({
      name,
      type: 'builtin',
      category: Object.keys(coreSkills).includes(name) ? 'core' : Object.keys(integrationSkills).includes(name) ? 'integration' : 'user'
    }));
    const customList = [...this._customSkills.entries()].map(([name, item]) => ({
      name,
      type: 'custom',
      meta: item.meta,
      registeredAt: item.registeredAt
    }));
    return [...builtinList, ...customList];
  }

  async execute(name, ...args) {
    const fn = this.get(name);
    if (!fn) throw new Error(`Skill '${name}' nebol nájdený v registry.`);
    return await fn(...args);
  }
}

export const skillRegistry = new SkillRegistry();
