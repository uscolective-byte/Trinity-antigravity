/**
 * TRINITY Sovereign Circuit Breaker Router (Pentad Edition)
 * Zabezpečuje odolné smerovanie medzi Cloudflare Workers AI (Edge), Gemini a Copilot Studio (crm17).
 * Pravidlo: Trinity rozhoduje. Ostatné modely odpovedajú.
 */

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // Normálna prevádzka
  OPEN: 'OPEN',         // Výpadok uzla, okamžitý fallback na Edge AI
  HALF_OPEN: 'HALF_OPEN'// Skúšobná požiadavka po uplynutí cooldownu
};

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.timeoutMs = options.timeoutMs || 15000;
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
  }

  isOpen() {
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = CIRCUIT_STATES.CLOSED;
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold || this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.state = CIRCUIT_STATES.OPEN;
    }
  }

  getStatus() {
    return {
      service: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null
    };
  }
}

// In-memory circuit breakers pre beh workeru
export const circuitBreakers = {
  gemini: new CircuitBreaker('gemini', { failureThreshold: 3, resetTimeoutMs: 30000, timeoutMs: 15000 }),
  copilot: new CircuitBreaker('copilot', { failureThreshold: 2, resetTimeoutMs: 30000, timeoutMs: 15000 }),
  edge: new CircuitBreaker('edge', { failureThreshold: 5, resetTimeoutMs: 10000, timeoutMs: 25000 })
};

export function createReceiptId(prefix = 'TRN') {
  const ts = Date.now().toString(36).toUpperCase();
  const uid = crypto.randomUUID().split('-')[0].toUpperCase();
  return `${prefix}-RCPT-${ts}-${uid}`;
}

/**
 * Bezpečné volanie s garantovaným časovým limitom cez AbortController
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout po ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Smerovanie úlohy na Microsoft Copilot Studio (crm17) cez Direct Line
 */
export async function callCopilotStudioDirectLine(prompt, env, timeoutMs = 15000) {
  const breaker = circuitBreakers.copilot;
  if (breaker.isOpen()) {
    throw new Error('Copilot Studio circuit breaker je OPEN (výpadok služby)');
  }

  const secret = env.COPILOT_STUDIO_SECRET || env.COPILOT_DIRECTLINE_SECRET;
  if (!secret) {
    throw new Error('Chýba COPILOT_STUDIO_SECRET vo Worker secrets');
  }

  try {
    // 1. Získanie konverzácie
    const directlineUrl = env.DIRECTLINE_URL || 'https://europe.directline.botframework.com/v3/directline';
    const initRes = await fetchWithTimeout(`${directlineUrl}/conversations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` }
    }, timeoutMs);

    if (!initRes.ok) {
      throw new Error(`Direct Line handshake failed: HTTP ${initRes.status}`);
    }

    const conv = await initRes.json();

    // 2. Odoslanie správy
    const actRes = await fetchWithTimeout(`${directlineUrl}/conversations/${conv.conversationId}/activities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conv.token || secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'message',
        from: { id: 'usr_basterix_root', name: 'Sabo Ivan / Basterix' },
        text: prompt
      })
    }, timeoutMs);

    if (!actRes.ok) {
      throw new Error(`Direct Line activity post failed: HTTP ${actRes.status}`);
    }

    breaker.recordSuccess();

    // Zápis do D1 auditnej tabuľky ak existuje
    if (env.DB?.prepare) {
      env.DB.prepare(`
        INSERT INTO copilot_sessions (session_id, prompt, status, created_at)
        VALUES (?1, ?2, 'DISPATCHED', datetime('now'))
      `).bind(conv.conversationId, prompt.slice(0, 500)).run().catch(() => {});
    }

    return {
      conversationId: conv.conversationId,
      text: `[Copilot Studio crm17] Úloha zaradená do relácie ${conv.conversationId}`,
      node: 'copilot-studio-crm17'
    };
  } catch (err) {
    breaker.recordFailure();
    throw err;
  }
}

/**
 * Bezpečné volanie Gemini API s ochranou Circuit Breaker
 */
export async function callGeminiApi(prompt, system, env, timeoutMs = 15000) {
  const breaker = circuitBreakers.gemini;
  if (breaker.isOpen()) {
    throw new Error('Gemini circuit breaker je OPEN (výpadok služby)');
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chýba GEMINI_API_KEY');
  }

  try {
    const model = env.GEMINI_MODEL || 'gemini-2.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    }, timeoutMs);

    if (!res.ok) {
      throw new Error(`Gemini API error HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    breaker.recordSuccess();
    return { text, node: model };
  } catch (err) {
    breaker.recordFailure();
    throw err;
  }
}

/**
 * Suverénny Cloudflare Workers AI motor (0 externých tokenov)
 */
export async function callWorkersAiEdge(prompt, system, env) {
  const breaker = circuitBreakers.edge;
  if (!env.AI?.run) {
    throw new Error('Workers AI (env.AI) nie je k dispozícii.');
  }

  const primaryModel = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const fallbackModel = env.AI_FALLBACK_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

  try {
    const aiRes = await env.AI.run(primaryModel, {
      messages: [
        {
          role: 'system',
          content: system || 'Si zvrchované jadro TRINITY (Deed: TRINITY-DEED-20261025-001). Dodržiavaj Truth Policy 2.0.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2048,
      temperature: 0.2
    });
    breaker.recordSuccess();
    return { text: aiRes.response || '', node: primaryModel };
  } catch (err70b) {
    // Okamžitý fallback na sub-sekundový 8B model
    try {
      const fallbackRes = await env.AI.run(fallbackModel, {
        messages: [{ role: 'user', content: prompt }]
      });
      breaker.recordSuccess();
      return { text: fallbackRes.response || '', node: fallbackModel, fallback: true };
    } catch (err8b) {
      breaker.recordFailure();
      throw err8b;
    }
  }
}

/**
 * Hlavný router Pentády s prioritou Trinity a automatickým fallbackom
 */
export async function routePentadTask({ prompt, system, preferredNode = 'auto', env }) {
  const start = Date.now();
  let result = null;
  let fallbackUsed = false;
  let chosenNode = preferredNode;

  // 1. Automatické rozhodnutie uzla ak je 'auto'
  if (preferredNode === 'auto') {
    // Rutinné a všeobecné otázky idú priamo na Edge AI (0 tokenov)
    chosenNode = 'edge';
  }

  // 2. Pokus o vykonanie na preferovanom uzle
  if (chosenNode === 'copilot') {
    try {
      result = await callCopilotStudioDirectLine(prompt, env, 15000);
    } catch (e) {
      fallbackUsed = true;
      // Fallback na Edge AI
      result = await callWorkersAiEdge(prompt, system, env);
    }
  } else if (chosenNode === 'gemini') {
    try {
      result = await callGeminiApi(prompt, system, env, 15000);
    } catch (e) {
      fallbackUsed = true;
      // Fallback na Edge AI
      result = await callWorkersAiEdge(prompt, system, env);
    }
  } else {
    // Primárne Edge AI
    try {
      result = await callWorkersAiEdge(prompt, system, env);
    } catch (edgeErr) {
      // Ak zlyhá Edge AI, skús Gemini ak je dostupný
      if (env.GEMINI_API_KEY && !circuitBreakers.gemini.isOpen()) {
        fallbackUsed = true;
        result = await callGeminiApi(prompt, system, env, 15000);
      } else {
        throw edgeErr;
      }
    }
  }

  // 3. Uloženie stavu do KV Mastermind ak existuje
  if (env.Mastermind?.put) {
    const healthReport = {
      gemini: circuitBreakers.gemini.getStatus(),
      copilot: circuitBreakers.copilot.getStatus(),
      edge: circuitBreakers.edge.getStatus(),
      timestamp: new Date().toISOString()
    };
    env.Mastermind.put('service_health:pentad', JSON.stringify(healthReport), { expirationTtl: 300 }).catch(() => {});
  }

  return {
    text: result.text,
    node: result.node,
    preferred_node: preferredNode,
    fallback_used: fallbackUsed,
    receipt_id: createReceiptId('PNT'),
    deed: 'TRINITY-DEED-20261025-001',
    elapsed_ms: Date.now() - start
  };
}
