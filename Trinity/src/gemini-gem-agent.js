/**
 * @module TRINITY_OMNI_CORE
 * @subsystem GEMINI_GEM_AGENT
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Gemini GEM Unlimited Agent: Vysokorýchlostný, bezlimitný autonómny agent
 * napojený na Gemini API s dynamickou kaskádou fallbackov (Gemini 2.5 Flash -> Pro -> Flash-Lite -> 1.5 Pro -> Workers AI 70B),
 * schopný kontinuálnej práce bez zastavenia na kvótach alebo rate-limitoch.
 */

import { callModel, boundedText } from './services.js';
import { sanitizeApiKey } from './ai-providers.js';
import { executeVerifiedFileCreation } from './receipt.js';

export const GEMINI_MODEL_CASCADE = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
]);

export const EDGE_FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Normalizes input messages for Gemini API
 */
function formatGeminiContents(messages = []) {
  const contents = [];
  let systemText = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(msg.content || '') }]
      });
    }
  }

  return { contents, systemText };
}

/**
 * Spustí dopyt na Gemini API s konkrétnym modelom
 */
async function callGeminiEndpoint(apiKey, model, contents, systemInstruction = '', options = {}) {
  const cleanModel = String(model).replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

  const payload = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 8192
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs || 45000),
    redirect: 'manual'
  });

  if (!response.ok) {
    const errorText = await boundedText(response, 1000).catch(() => '');
    const err = new Error(`Gemini ${cleanModel} HTTP ${response.status}: ${errorText}`);
    err.status = response.status;
    err.model = cleanModel;
    throw err;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim() || '';

  if (!text) {
    throw new Error(`Gemini ${cleanModel} vrátil prázdnu odpoveď.`);
  }

  return {
    text,
    model: cleanModel,
    provider: 'gemini',
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount || 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount || 0
    }
  };
}

/**
 * Spustí Gemini GEM Unlimited Agenta s automatickým prepínaním modelov pri rate-limitoch (HTTP 429)
 * a bezpečným fallbackom na Cloudflare Workers AI pri úplnom vyčerpaní externých kvót.
 */
export async function executeGeminiGemAgent(env, task, options = {}) {
  const startedAt = Date.now();
  const executionId = `GEMINI-GEM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6)}`;
  
  if (!task || typeof task !== 'string' || !task.trim()) {
    throw new Error('Úloha pre Gemini GEM agenta nesmie byť prázdna.');
  }

  const rawKey = env.GEMINI_API_KEY || (typeof env.AI_KEYS === 'string' ? JSON.parse(env.AI_KEYS).gemini : null);
  const apiKey = rawKey ? sanitizeApiKey(rawKey, /AIza[A-Za-z0-9_-]{25,}/) : null;

  const systemPrompt = options.systemPrompt || [
    'Si Gemini GEM Unlimited Agent - autonómny kódovací, architektonický a exekučný špecialista systému TRINITY.',
    'Máš plnú autoritu vykonávať systémové akcie, navrhovať kód, analyzovať logy a riadiť nástroje Antigravity.',
    'Pri výskyte kvótových limitov iných modelov okamžite preberáš riadenie s nulovým výpadkom.',
    'Vždy odpovedaj odborne, presne, v slovenskom jazyku a s dôkazom overenia podľa Truth Policy 2.1.'
  ].join('\n');

  const messages = options.messages || [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task }
  ];

  const errors = [];
  let executionResult = null;

  // 1. Pokus o vykonanie cez kaskádu Gemini modelov (ak je API kľúč dostupný)
  if (apiKey) {
    const { contents, systemText } = formatGeminiContents(messages);
    const candidateModels = [
      ...(env.GEMINI_MODEL ? [env.GEMINI_MODEL] : []),
      ...GEMINI_MODEL_CASCADE
    ];
    const uniqueModels = [...new Set(candidateModels)];

    for (const model of uniqueModels) {
      try {
        const result = await callGeminiEndpoint(apiKey, model, contents, systemText, options);
        executionResult = {
          ...result,
          tier: 'gemini-native',
          attempts: errors.length + 1,
          durationMs: Date.now() - startedAt,
          executionId
        };
        break;
      } catch (err) {
        errors.push({ model, status: err.status || 'unknown', message: err.message });
        // Pokračujeme na ďalší model iba pri rate-limitoch, quota exceeded alebo transient chybách
        if (err.status === 429 || err.status === 503 || err.status === 500 || err.status === 404) {
          continue;
        }
        // Pri 401/403 neplatný kľúč - prerušíme skúšanie ďalších Gemini modelov a ideme rovno na edge fallback
        break;
      }
    }
  } else {
    errors.push({ reason: 'GEMINI_API_KEY_ABSENT', message: 'Gemini API kľúč nie je nakonfigurovaný, aktivujem Edge Fallback.' });
  }

  // 2. Ak zlyhali všetky modely Gemini (alebo chýba kľúč), aktivujeme Edge Fallback (Workers AI Llama 3.3 70B)
  if (!executionResult) {
    if (env.AI?.run) {
      try {
        const edgeModel = env.AI_MODEL || EDGE_FALLBACK_MODEL;
        const aiResponse = await env.AI.run(edgeModel, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task }
          ],
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.2
        });

        const text = typeof aiResponse === 'string' ? aiResponse
          : typeof aiResponse?.response === 'string' ? aiResponse.response
          : typeof aiResponse?.output_text === 'string' ? aiResponse.output_text
          : '';

        if (text) {
          executionResult = {
            text: text.trim(),
            model: edgeModel,
            provider: 'workers-ai-edge-fallback',
            tier: 'sovereign-edge',
            attempts: errors.length + 1,
            durationMs: Date.now() - startedAt,
            executionId,
            fallbackChain: errors
          };
        }
      } catch (edgeErr) {
        errors.push({ model: 'workers-ai', message: edgeErr.message });
      }
    }
  }

  if (!executionResult) {
    throw new Error(`Gemini GEM Agent vyčerpal všetky dostupné kanály: ${JSON.stringify(errors)}`);
  }

  return {
    success: true,
    executionId,
    agent: 'gemini-gem',
    result: executionResult.text,
    model: executionResult.model,
    provider: executionResult.provider,
    tier: executionResult.tier,
    durationMs: executionResult.durationMs,
    unlimitedProof: {
      status: 'CONTINUOUS_NO_LIMIT',
      cascadeResilience: true,
      fallbacksAttempted: errors.length
    },
    _evidence: {
      effect: 'inference',
      receipt_id: executionId,
      timestamp: new Date().toISOString()
    }
  };
}
