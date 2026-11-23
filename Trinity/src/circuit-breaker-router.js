/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module circuit-breaker-router.js (Trinity/src/circuit-breaker-router.js) in the TRINITY OMNI-CORE ecosystem.
 */
import {skillRegistry} from './skillRegistry.js';

/**
 * TRINITY Sovereign Circuit Breaker Router (Pentad Edition)
 * Provides resilient routing across Cloudflare Workers AI (Edge), Gemini, and Copilot Studio (crm17).
 * Rule: Trinity decides. Other models respond.
 */

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Node outage, immediate fallback to Edge AI
  HALF_OPEN: 'HALF_OPEN'// Probe request after cooldown expires
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

// In-memory circuit breakers for worker runtime
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
 * Safe fetch wrapper with guaranteed timeout via AbortController.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Route a task to Microsoft Copilot Studio (crm17) via Direct Line.
 */
export async function callCopilotStudioDirectLine(prompt, env, timeoutMs = 15000, options = {}) {
  const breaker = circuitBreakers.copilot;
  if (breaker.isOpen()) {
    throw new Error('Copilot Studio circuit breaker is OPEN (service outage)');
  }

  if (!env.COPILOT_STUDIO_SECRET) {
    throw new Error('Missing COPILOT_STUDIO_SECRET in Worker secrets');
  }

  try {
    const copilot = await skillRegistry.execute(
      'copilotStudioAsk',
      { query: String(prompt || '').trim() },
      env,
      { timeoutMs, pollMs: options.pollMs }
    );
    if (!copilot?.success || !copilot.conversationId || !Array.isArray(copilot.replies) || !copilot.replies.length) {
      throw new Error(copilot?.error || 'Copilot Studio did not return a reply.');
    }
    const text = copilot.replies.join('\n');
    if (env.DB?.prepare) {
      const history = JSON.stringify([
        { role: 'user', content: String(prompt || '') },
        { role: 'assistant', content: text }
      ]);
      await env.DB.prepare(`
        INSERT INTO copilot_sessions (session_id, history, updated_at)
        VALUES (?1, ?2, datetime('now'))
        ON CONFLICT(session_id) DO UPDATE SET history=excluded.history, updated_at=excluded.updated_at
      `).bind(copilot.conversationId ?? null, history ?? null).run();
    }
    breaker.recordSuccess();
    return {
      conversationId: copilot.conversationId,
      text,
      node: 'copilot-studio-crm17'
    };
  } catch (err) {
    breaker.recordFailure();
    throw err;
  }
}

/**
 * Safe Gemini API call with Circuit Breaker protection.
 */
export async function callGeminiApi(prompt, system, env, timeoutMs = 15000) {
  const breaker = circuitBreakers.gemini;
  if (breaker.isOpen()) {
    throw new Error('Gemini circuit breaker is OPEN (service outage)');
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  try {
    const model = env.GEMINI_MODEL || 'gemini-2.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
 * Sovereign Cloudflare Workers AI engine (0 external tokens).
 */
export async function callWorkersAiEdge(prompt, system, env) {
  const breaker = circuitBreakers.edge;
  if (!env.AI?.run) {
    throw new Error('Workers AI (env.AI) is not available.');
  }

  const primaryModel = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const fallbackModel = env.AI_FALLBACK_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

  try {
    const aiRes = await env.AI.run(primaryModel, {
      messages: [
        {
          role: 'system',
          content: system || 'You are the sovereign TRINITY core (Deed: TRINITY-DEED-20261025-001). Strictly follow Truth Policy 2.0. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal \'tykanie\' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2048,
      temperature: 0.2
    });
    breaker.recordSuccess();
    return { text: aiRes.response || '', node: primaryModel };
  } catch (err70b) {
    // Immediate fallback to sub-second 8B model
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
 * Primary Pentad router with Trinity priority and automatic fallback.
 */
export async function routePentadTask({ prompt, system, preferredNode = 'auto', env }) {
  const start = Date.now();
  let result = null;
  let fallbackUsed = false;
  let chosenNode = preferredNode;

  // 1. Automatic node selection when set to 'auto'
  if (preferredNode === 'auto') {
    // Routine and general queries route directly to Edge AI (0 external tokens)
    chosenNode = 'edge';
  }

  // 2. Attempt execution on preferred node
  if (chosenNode === 'copilot') {
    try {
      result = await callCopilotStudioDirectLine(prompt, env, 15000);
    } catch (e) {
      fallbackUsed = true;
      // Fallback to Edge AI
      result = await callWorkersAiEdge(prompt, system, env);
    }
  } else if (chosenNode === 'gemini') {
    try {
      result = await callGeminiApi(prompt, system, env, 15000);
    } catch (e) {
      fallbackUsed = true;
      // Fallback to Edge AI
      result = await callWorkersAiEdge(prompt, system, env);
    }
  } else {
    // Primary Edge AI
    try {
      result = await callWorkersAiEdge(prompt, system, env);
    } catch (edgeErr) {
      // If Edge AI fails, try Gemini if available
      if (env.GEMINI_API_KEY && !circuitBreakers.gemini.isOpen()) {
        fallbackUsed = true;
        result = await callGeminiApi(prompt, system, env, 15000);
      } else {
        throw edgeErr;
      }
    }
  }

  // 3. Persist health status to KV Mastermind if bound
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
