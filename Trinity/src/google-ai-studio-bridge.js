/**
 * @module TRINITY_OMNI_CORE
 * @subsystem GOOGLE_AI_STUDIO_BRIDGE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Production Google AI Studio (Gemini API v1beta) bridge for TRINITY OMNI-CORE.
 * Provides metadata-only status checks, 3-layer credential resolution (Worker secrets,
 * Cloudflare Secrets Store, encrypted D1 Vault), model discovery, live connection verification,
 * REST and SSE content generation with model compatibility fallback, and multi-turn
 * Trinity <-> Google AI Studio collaborative co-creation with bounded session persistence.
 *
 * Dual-language architecture:
 * - Engineering & internal collaboration prompts: 100% English.
 * - User-facing co-creation synthesis: Slovak by default (reply_language: 'sk'), supporting 'en' and 'auto'.
 */

import { sanitizeApiKey } from './ai-providers.js';
import { readTrinityMasterSecret } from './trinity-master-secrets.js';
import { getSecretMaterial, resolveProviderSecret } from './secret-vault.js';
import { buildReceipt, hashPayload } from './receipt.js';

export const GOOGLE_AI_STUDIO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const AI_STUDIO_DEFAULT_MODELS = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
]);

const AI_STUDIO_KEY_PATTERN = /(?:AIza[A-Za-z0-9_-]{25,}|AQ\.[A-Za-z0-9_.-]{25,})/;
const AI_STUDIO_CAPABILITIES = Object.freeze(['models', 'generate', 'stream', 'co_create', 'sessions', 'mcp']);
const VALID_COCREATE_MODES = new Set(['pair', 'brainstorm', 'review', 'build_artifact']);
const SESSION_KEY_PREFIX = 'aistudio:session:';
const MAX_SESSION_TURNS = 12;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 15000;
const DEFAULT_GENERATION_TIMEOUT_MS = 30000;

/**
 * Redacts Google AI Studio / Gemini API keys, x-goog-api-key headers, and key query parameters.
 * @param {unknown} text
 * @returns {string}
 */
export function redactAiStudioSecret(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/AQ\.[A-Za-z0-9_.-]{20,}/g, '[REDACTED_GOOGLE_API_KEY]')
    .replace(/((?:["']?x-goog-api-key["']?\s*[:=]\s*["']?))([^"'\s,;}\]]+)/gi, '$1[REDACTED]')
    .replace(/([?&](?:api_)?key=)([^&\s"'<>]+)/gi, '$1[REDACTED]');
}

function sanitizeAiStudioKey(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = sanitizeApiKey(raw, AI_STUDIO_KEY_PATTERN);
  return cleaned.length >= 25 ? cleaned : '';
}

function cleanModelId(model) {
  const raw = String(model || '').trim().replace(/^models\//i, '');
  if (!raw || !/^[A-Za-z0-9._-]{2,120}$/.test(raw)) return '';
  return raw;
}

function sanitizeSessionId(sessionId) {
  const raw = String(sessionId || '').trim();
  if (!raw) return '';
  const safe = raw.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 80);
  return safe || '';
}

function detectLanguagePolicy(replyLanguage, taskText = '') {
  const requested = String(replyLanguage || 'sk').toLowerCase().trim();
  if (requested === 'en') {
    return { internal_work: 'en', user_communication: 'en' };
  }
  if (requested === 'auto') {
    const sample = String(taskText || '');
    const hasSlovakSignals = /[áčďéíĺľňóôŕšťúýžÁČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]|\b(ahoj|prosím|sprav|vytvor|navrhni|oprav|skontroluj|spolu|ako|pre|ale|nech)\b/i.test(sample);
    const hasEnglishSignals = /\b(please|create|build|review|design|implement|explain|write|refactor|debug|with|for)\b/i.test(sample);
    if (!hasSlovakSignals && hasEnglishSignals) {
      return { internal_work: 'en', user_communication: 'en' };
    }
  }
  return { internal_work: 'en', user_communication: 'sk' };
}

function parseGoogleApiError(status, payload, rawText = '') {
  const errObj = payload && typeof payload === 'object' ? payload.error : null;
  let reason = null;
  if (Array.isArray(errObj?.details)) {
    for (const detail of errObj.details) {
      if (detail && (detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' || typeof detail.reason === 'string')) {
        if (typeof detail.reason === 'string' && detail.reason.trim()) {
          reason = detail.reason.trim();
          break;
        }
      }
    }
  }
  if (!reason && typeof errObj?.status === 'string' && errObj.status.trim()) {
    reason = errObj.status.trim();
  }
  const detailMsg = typeof errObj?.message === 'string' && errObj.message.trim()
    ? errObj.message.trim()
    : (typeof rawText === 'string' && rawText.trim() ? rawText.trim() : '');
  const safeDetail = redactAiStudioSecret(detailMsg).slice(0, 320);
  const reasonPart = reason ? ` [${redactAiStudioSecret(reason)}]` : '';
  const suffix = safeDetail ? `: ${safeDetail}` : '';
  return {
    reason: reason ? redactAiStudioSecret(reason) : null,
    message: `Google AI Studio API error (HTTP ${status})${reasonPart}${suffix}`
  };
}

function pickRecommendedModel(models) {
  const generative = models.filter(m =>
    Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent')
  );
  if (!generative.length) return null;
  const byId = new Map(generative.map(m => [m.id, m]));
  for (const preferred of AI_STUDIO_DEFAULT_MODELS) {
    if (byId.has(preferred)) return preferred;
  }
  const stableFlash = generative.find(m =>
    /^gemini-.*flash/i.test(m.id) && !/(?:image|tts|audio|embedding|preview|exp)/i.test(m.id)
  );
  if (stableFlash) return stableFlash.id;
  const anyGemini = generative.find(m => /^gemini-/i.test(m.id));
  return anyGemini ? anyGemini.id : generative[0].id;
}

function formatGeminiContents(input = {}) {
  const contents = [];
  let systemText = typeof input.systemInstruction === 'string' ? input.systemInstruction.trim() : '';

  const messages = Array.isArray(input.messages) && input.messages.length > 0
    ? input.messages
    : (typeof input.prompt === 'string' && input.prompt.trim()
      ? [{ role: 'user', content: input.prompt }]
      : []);

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const text = String(msg.content ?? '').trim();
    if (!text) continue;
    if (msg.role === 'system') {
      systemText = systemText ? `${systemText}\n\n${text}` : text;
      continue;
    }
    const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Continue the collaboration.' }] });
  }

  return { contents, systemText };
}

function isModelCompatibilityFailure(status, parsedError) {
  if (status === 404) return true;
  if (status !== 400) return false;
  const msg = String(parsedError?.message || '').toLowerCase();
  const reason = String(parsedError?.reason || '').toLowerCase();
  if (reason.includes('api_key') || msg.includes('api key')) return false;
  return /model|not found|not supported|unsupported|invalid_argument/.test(`${reason} ${msg}`);
}

/**
 * Resolves a Google AI Studio API credential strictly server-side using 3-layer precedence:
 * 1. Explicit Vault secretId (with ownerId)
 * 2. Worker string secrets (GOOGLE_AI_STUDIO_API_KEY, GEMINI_API_KEY, apigoogle)
 * 3. Cloudflare Secrets Store bindings (.get()) including TRINITY_MASTER_GOOGLE
 * 4. Encrypted D1 Vault (ops_secret_vault) for google_ai_studio / gemini
 *
 * Fails closed on throwing bindings, DB errors, or malformed tokens without leaking secrets.
 * @param {object} env
 * @param {{ ownerId?: string, secretId?: string }} [options]
 * @returns {Promise<{ apiKey: string | null, source: 'secrets-store' | 'worker-secret' | 'encrypted-vault' | null, binding: string | null }>}
 */
export async function resolveAiStudioCredential(env, options = {}) {
  // Layer 1: Explicit Vault secretId (requires ownerId)
  if (options?.secretId && options?.ownerId && env?.DB?.prepare) {
    for (const provider of ['google_ai_studio', 'gemini']) {
      try {
        const material = await getSecretMaterial(env, {
          ownerId: options.ownerId,
          id: options.secretId,
          provider
        });
        const apiKey = sanitizeAiStudioKey(material?.secret);
        if (apiKey) {
          return {
            apiKey,
            source: 'encrypted-vault',
            binding: `vault:${options.secretId}`
          };
        }
      } catch {
        // Fail closed; try next provider alias or next layer.
      }
    }
  }

  // Layer 2: Worker string secrets (never invokes .get() on Secrets Store if matched)
  for (const name of ['GOOGLE_AI_STUDIO_API_KEY', 'GEMINI_API_KEY', 'apigoogle']) {
    const candidate = env?.[name];
    if (typeof candidate === 'string') {
      const apiKey = sanitizeAiStudioKey(candidate);
      if (apiKey) {
        return {
          apiKey,
          source: 'worker-secret',
          binding: name
        };
      }
    }
  }

  // Layer 3: Cloudflare Secrets Store bindings (.get())
  for (const name of ['GOOGLE_AI_STUDIO_API_KEY', 'GEMINI_API_KEY']) {
    const binding = env?.[name];
    if (binding && typeof binding.get === 'function') {
      try {
        const value = await binding.get();
        const apiKey = sanitizeAiStudioKey(value);
        if (apiKey) {
          return {
            apiKey,
            source: 'secrets-store',
            binding: name
          };
        }
      } catch {
        // Fail closed without logging secret-bearing exceptions.
      }
    }
  }

  try {
    const masterValue = await readTrinityMasterSecret(env, 'gemini');
    const apiKey = sanitizeAiStudioKey(masterValue);
    if (apiKey) {
      return {
        apiKey,
        source: 'secrets-store',
        binding: 'TRINITY_MASTER_GOOGLE'
      };
    }
  } catch {
    // Fail closed.
  }

  // Layer 4: Encrypted D1 Vault fallback (vault-only env avoids re-reading Worker/Secrets Store keys)
  if (env?.DB?.prepare) {
    const vaultOnlyEnv = {
      DB: env.DB,
      TRINITY_VAULT_KEY: env.TRINITY_VAULT_KEY,
      SESSION_SECRET: env.SESSION_SECRET,
      SECRET_ENCRYPTION_KEY: env.SECRET_ENCRYPTION_KEY,
      VAULT_MASTER_KEY: env.VAULT_MASTER_KEY
    };
    for (const provider of ['google_ai_studio', 'gemini']) {
      try {
        const resolved = await resolveProviderSecret(vaultOnlyEnv, provider);
        const apiKey = sanitizeAiStudioKey(resolved);
        if (apiKey) {
          return {
            apiKey,
            source: 'encrypted-vault',
            binding: `ops_secret_vault:${provider}`
          };
        }
      } catch {
        // Fail closed.
      }
    }
  }

  return { apiKey: null, source: null, binding: null };
}

/**
 * Returns strictly metadata-only Google AI Studio Bridge configuration status.
 * NEVER invokes .get() on any Secrets Store binding and NEVER decrypts Vault secrets.
 * Always reports live_verified: false and secret_values_accessed: false (Truth Policy 2.1).
 * @param {object} env
 * @param {string} [ownerId]
 */
export async function getAiStudioBridgeStatus(env, ownerId) {
  const googleAiStudioSecretStore = typeof env?.GOOGLE_AI_STUDIO_API_KEY?.get === 'function'
    || typeof env?.GEMINI_API_KEY?.get === 'function';
  const googleAiStudioWorkerSecret = typeof env?.GOOGLE_AI_STUDIO_API_KEY === 'string'
    && sanitizeAiStudioKey(env.GOOGLE_AI_STUDIO_API_KEY).length >= 25;
  const geminiWorkerSecret = (typeof env?.GEMINI_API_KEY === 'string' && sanitizeAiStudioKey(env.GEMINI_API_KEY).length >= 25)
    || (typeof env?.apigoogle === 'string' && sanitizeAiStudioKey(env.apigoogle).length >= 25);
  const trinityMasterGoogleStore = typeof env?.TRINITY_MASTER_GOOGLE?.get === 'function';

  let encryptedVault = false;
  if (env?.DB?.prepare) {
    try {
      const row = ownerId
        ? await env.DB.prepare(
          "SELECT id FROM ops_secret_vault WHERE owner_id=? AND provider IN ('google_ai_studio','gemini') AND status!='revoked' LIMIT 1"
        ).bind(ownerId).first()
        : await env.DB.prepare(
          "SELECT id FROM ops_secret_vault WHERE provider IN ('google_ai_studio','gemini') AND status!='revoked' LIMIT 1"
        ).first();
      encryptedVault = Boolean(row);
    } catch {
      encryptedVault = false;
    }
  }

  const sources = {
    google_ai_studio_secret_store: googleAiStudioSecretStore,
    google_ai_studio_worker_secret: googleAiStudioWorkerSecret,
    gemini_worker_secret: geminiWorkerSecret,
    trinity_master_google_store: trinityMasterGoogleStore,
    encrypted_vault: encryptedVault
  };

  const configured = Object.values(sources).some(Boolean);
  const defaultModel = cleanModelId(env?.GEMINI_MODEL) || AI_STUDIO_DEFAULT_MODELS[0];

  return {
    bridge: 'google-ai-studio',
    endpoint: GOOGLE_AI_STUDIO_BASE_URL,
    configured,
    live_verified: false,
    secret_values_accessed: false,
    sources,
    default_model: defaultModel,
    capabilities: [...AI_STUDIO_CAPABILITIES]
  };
}

/**
 * Discovers available Google AI Studio models via GET /v1beta/models using x-goog-api-key header only.
 * @param {object} env
 * @param {{ ownerId?: string, secretId?: string, fetcher?: typeof fetch, pageSize?: number, timeoutMs?: number }} [options]
 */
export async function listAiStudioModels(env, options = {}) {
  const startedAt = new Date().toISOString();
  const fetcher = options?.fetcher || fetch;
  const cred = await resolveAiStudioCredential(env, options);

  if (!cred.apiKey) {
    const completedAt = new Date().toISOString();
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'list_models',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'api', id: `${GOOGLE_AI_STUDIO_BASE_URL}/models` },
      evidence: [{
        type: 'api',
        id: 'models_discovery',
        description: 'Credential resolution failed closed: no valid Google AI Studio key configured.'
      }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      verified: false,
      source: null,
      models: [],
      recommended_model: null,
      total: 0,
      status: 503,
      error: 'Google AI Studio API key is not configured.',
      error_reason: 'CREDENTIAL_MISSING',
      receipt
    };
  }

  const rawPageSize = Number(options?.pageSize ?? 100);
  const pageSize = Number.isFinite(rawPageSize) ? Math.max(1, Math.min(1000, Math.round(rawPageSize))) : 100;
  const url = `${GOOGLE_AI_STUDIO_BASE_URL}/models?pageSize=${pageSize}`;
  const timeoutMs = Number.isFinite(Number(options?.timeoutMs)) ? Math.max(1000, Number(options.timeoutMs)) : DEFAULT_DISCOVERY_TIMEOUT_MS;

  let response;
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': cred.apiKey,
        Accept: 'application/json'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    const completedAt = new Date().toISOString();
    const safeMsg = redactAiStudioSecret(err?.message || 'Network error while contacting Google AI Studio.');
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'list_models',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'api', id: url },
      evidence: [{
        type: 'http',
        id: 'models_discovery_error',
        description: safeMsg.slice(0, 500)
      }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      verified: false,
      source: cred.source,
      models: [],
      recommended_model: null,
      total: 0,
      status: 502,
      error: `Google AI Studio network failure: ${safeMsg}`,
      error_reason: 'NETWORK_ERROR',
      receipt
    };
  }

  if (response.status >= 300 && response.status < 400) {
    const completedAt = new Date().toISOString();
    const error = `Google AI Studio returned an unexpected HTTP redirect (HTTP ${response.status}).`;
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'list_models',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'api', id: url },
      evidence: [{ type: 'http', id: 'models_redirect', description: error }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      verified: false,
      source: cred.source,
      models: [],
      recommended_model: null,
      total: 0,
      status: response.status,
      error,
      error_reason: 'UNEXPECTED_REDIRECT',
      receipt
    };
  }

  let rawBody = '';
  let payload = null;
  try {
    rawBody = await response.text();
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsedErr = parseGoogleApiError(response.status, payload, rawBody);
    const completedAt = new Date().toISOString();
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'list_models',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'api', id: url },
      evidence: [{
        type: 'http',
        id: `http_${response.status}`,
        description: parsedErr.message.slice(0, 500)
      }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      verified: false,
      source: cred.source,
      models: [],
      recommended_model: null,
      total: 0,
      status: response.status,
      error: parsedErr.message,
      error_reason: parsedErr.reason,
      receipt
    };
  }

  const rawModels = Array.isArray(payload?.models) ? payload.models : [];
  const models = rawModels
    .filter(item => item && typeof item.name === 'string')
    .map(item => {
      const fullName = item.name.trim();
      const id = fullName.replace(/^models\//i, '');
      return {
        id,
        name: fullName,
        displayName: typeof item.displayName === 'string' && item.displayName.trim() ? item.displayName.trim() : id,
        description: typeof item.description === 'string' ? item.description.trim() : '',
        inputTokenLimit: Number.isFinite(Number(item.inputTokenLimit)) ? Number(item.inputTokenLimit) : null,
        outputTokenLimit: Number.isFinite(Number(item.outputTokenLimit)) ? Number(item.outputTokenLimit) : null,
        supportedGenerationMethods: Array.isArray(item.supportedGenerationMethods)
          ? item.supportedGenerationMethods.filter(m => typeof m === 'string')
          : []
      };
    });

  const recommendedModel = pickRecommendedModel(models);
  const completedAt = new Date().toISOString();
  const receipt = buildReceipt({
    tool: 'google_ai_studio',
    action: 'list_models',
    status: 'success',
    actor: { type: 'system', id: 'google-ai-studio-bridge' },
    target: { type: 'api', id: url },
    evidence: [{
      type: 'api',
      id: 'models_catalog',
      description: `Discovered ${models.length} Google AI Studio models (recommended: ${recommendedModel || 'none'}).`,
      afterHash: hashPayload({ total: models.length, ids: models.map(m => m.id) })
    }],
    metrics: { models_total: models.length },
    startedAt,
    completedAt
  });

  return {
    ok: true,
    verified: true,
    source: cred.source,
    models,
    recommended_model: recommendedModel,
    total: models.length,
    receipt
  };
}

/**
 * Generates content (or an SSE stream) via Google AI Studio v1beta API.
 * Uses x-goog-api-key header exclusively, redirect: 'manual', and bounded timeout.
 * Falls back across discovered/default models ONLY on HTTP 404/400 model compatibility errors;
 * NEVER masks HTTP 401, 403, 429, or 5xx errors.
 * @param {object} env
 * @param {object} input
 * @param {{ fetcher?: typeof fetch, timeoutMs?: number, ownerId?: string, secretId?: string }} [options]
 */
export async function generateAiStudioContent(env, input = {}, options = {}) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const fetcher = options?.fetcher || fetch;
  const timeoutMs = Number.isFinite(Number(options?.timeoutMs)) ? Math.max(1000, Number(options.timeoutMs)) : DEFAULT_GENERATION_TIMEOUT_MS;
  const stream = Boolean(input?.stream);

  const primaryModel = cleanModelId(input?.model) || cleanModelId(env?.GEMINI_MODEL) || AI_STUDIO_DEFAULT_MODELS[0];
  const { contents, systemText } = formatGeminiContents(input);

  if (!contents.length) {
    const completedAt = new Date().toISOString();
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: stream ? 'stream_generate' : 'generate',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'model', id: primaryModel },
      evidence: [{ type: 'api', id: 'invalid_input', description: 'Prompt or non-empty messages array is required.' }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      provider: 'google-ai-studio',
      model: primaryModel,
      text: '',
      finishReason: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latency_ms: Date.now() - startedAtMs,
      status: 400,
      error: 'Prompt or non-empty messages array is required.',
      receipt
    };
  }

  const cred = await resolveAiStudioCredential(env, {
    ownerId: input?.ownerId ?? options?.ownerId,
    secretId: input?.secretId ?? options?.secretId
  });

  if (!cred.apiKey) {
    const completedAt = new Date().toISOString();
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: stream ? 'stream_generate' : 'generate',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'model', id: primaryModel },
      evidence: [{ type: 'api', id: 'credential_missing', description: 'No valid Google AI Studio credential available.' }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      provider: 'google-ai-studio',
      model: primaryModel,
      text: '',
      finishReason: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latency_ms: Date.now() - startedAtMs,
      status: 503,
      error: 'Google AI Studio API key is not configured.',
      receipt
    };
  }

  const generationConfig = {};
  if (typeof input?.temperature === 'number' && Number.isFinite(input.temperature)) {
    generationConfig.temperature = input.temperature;
  }
  if (typeof input?.maxOutputTokens === 'number' && Number.isFinite(input.maxOutputTokens)) {
    generationConfig.maxOutputTokens = Math.max(1, Math.round(input.maxOutputTokens));
  }
  if (typeof input?.topP === 'number' && Number.isFinite(input.topP)) {
    generationConfig.topP = input.topP;
  }
  if (input?.responseMimeType === 'application/json' || input?.responseMimeType === 'text/plain') {
    generationConfig.responseMimeType = input.responseMimeType;
  }
  if (input?.responseSchema && typeof input.responseSchema === 'object') {
    generationConfig.responseSchema = input.responseSchema;
  }

  const requestBody = {
    contents,
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {})
  };

  const triedModels = new Set();
  const candidates = [primaryModel];
  let fallbackDiscovered = false;
  let lastError = 'Google AI Studio generation failed.';
  let lastStatus = 502;
  let lastReason = null;

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    if (!model || triedModels.has(model)) continue;
    triedModels.add(model);

    const endpoint = stream
      ? `${GOOGLE_AI_STUDIO_BASE_URL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
      : `${GOOGLE_AI_STUDIO_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;

    let response;
    try {
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cred.apiKey
        },
        body: JSON.stringify(requestBody),
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      lastStatus = 502;
      lastError = `Google AI Studio network failure: ${redactAiStudioSecret(err?.message || 'request failed')}`;
      lastReason = 'NETWORK_ERROR';
      break;
    }

    if (response.status >= 300 && response.status < 400) {
      lastStatus = response.status;
      lastError = `Google AI Studio returned an unexpected HTTP redirect (HTTP ${response.status}).`;
      lastReason = 'UNEXPECTED_REDIRECT';
      break;
    }

    if (response.ok) {
      const latencyMs = Date.now() - startedAtMs;
      const completedAt = new Date().toISOString();

      if (stream) {
        const receipt = buildReceipt({
          tool: 'google_ai_studio',
          action: 'stream_generate',
          status: 'success',
          actor: { type: 'system', id: 'google-ai-studio-bridge' },
          target: { type: 'model', id: model },
          evidence: [{
            type: 'api',
            id: `stream:${model}`,
            description: `Opened Google AI Studio SSE stream for model ${model}.`
          }],
          metrics: { latency_ms: latencyMs, attempts: triedModels.size },
          startedAt,
          completedAt
        });
        return {
          ok: true,
          provider: 'google-ai-studio',
          model,
          text: '',
          finishReason: null,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          latency_ms: latencyMs,
          streamResponse: response,
          receipt
        };
      }

      const data = await response.json().catch(() => null);
      const candidate = data?.candidates?.[0] || null;
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const text = parts
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim();
      const finishReason = typeof candidate?.finishReason === 'string' ? candidate.finishReason : null;
      const inputTokens = Number(data?.usageMetadata?.promptTokenCount) || 0;
      const outputTokens = Number(data?.usageMetadata?.candidatesTokenCount) || 0;
      const totalTokens = Number(data?.usageMetadata?.totalTokenCount) || (inputTokens + outputTokens);

      const receipt = buildReceipt({
        tool: 'google_ai_studio',
        action: 'generate',
        status: 'success',
        actor: { type: 'system', id: 'google-ai-studio-bridge' },
        target: { type: 'model', id: model },
        evidence: [{
          type: 'api',
          id: `generate:${model}`,
          description: `Generated response via Google AI Studio model ${model} (${outputTokens} output tokens).`,
          afterHash: hashPayload({ model, text, finishReason })
        }],
        metrics: {
          latency_ms: latencyMs,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          attempts: triedModels.size
        },
        startedAt,
        completedAt
      });

      return {
        ok: true,
        provider: 'google-ai-studio',
        model,
        text,
        finishReason,
        usage: { inputTokens, outputTokens, totalTokens },
        latency_ms: latencyMs,
        receipt
      };
    }

    const rawErr = await response.text().catch(() => '');
    let errPayload = null;
    try {
      errPayload = rawErr ? JSON.parse(rawErr) : null;
    } catch {
      errPayload = null;
    }
    const parsedErr = parseGoogleApiError(response.status, errPayload, rawErr);
    lastStatus = response.status;
    lastError = parsedErr.message;
    lastReason = parsedErr.reason;

    // Strictly fail closed on auth, permission, quota, or server errors (never mask 401/403/429/5xx).
    if (!isModelCompatibilityFailure(response.status, parsedErr)) {
      break;
    }

    // Compatibility fallback on HTTP 404/400 model errors: discover available models once, then append defaults.
    if (!fallbackDiscovered) {
      fallbackDiscovered = true;
      try {
        const discovered = await listAiStudioModels(env, {
          ownerId: input?.ownerId ?? options?.ownerId,
          secretId: input?.secretId ?? options?.secretId,
          fetcher,
          timeoutMs: Math.min(timeoutMs, DEFAULT_DISCOVERY_TIMEOUT_MS)
        });
        if (discovered.ok) {
          if (discovered.recommended_model && !triedModels.has(discovered.recommended_model)) {
            candidates.push(discovered.recommended_model);
          }
          for (const item of discovered.models) {
            if (
              Array.isArray(item.supportedGenerationMethods)
              && item.supportedGenerationMethods.includes('generateContent')
              && /^gemini-/i.test(item.id)
              && !triedModels.has(item.id)
              && !candidates.includes(item.id)
            ) {
              candidates.push(item.id);
            }
          }
        }
      } catch {
        // Proceed with static AI_STUDIO_DEFAULT_MODELS fallback list.
      }
      for (const fallbackModel of AI_STUDIO_DEFAULT_MODELS) {
        if (!triedModels.has(fallbackModel) && !candidates.includes(fallbackModel)) {
          candidates.push(fallbackModel);
        }
      }
    }
  }

  const latencyMs = Date.now() - startedAtMs;
  const completedAt = new Date().toISOString();
  const receipt = buildReceipt({
    tool: 'google_ai_studio',
    action: stream ? 'stream_generate' : 'generate',
    status: 'failed',
    actor: { type: 'system', id: 'google-ai-studio-bridge' },
    target: { type: 'model', id: primaryModel },
    evidence: [{
      type: 'http',
      id: `http_${lastStatus}`,
      description: lastError.slice(0, 500)
    }],
    metrics: { latency_ms: latencyMs, attempts: triedModels.size },
    startedAt,
    completedAt
  });

  return {
    ok: false,
    provider: 'google-ai-studio',
    model: primaryModel,
    text: '',
    finishReason: null,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    latency_ms: latencyMs,
    status: lastStatus,
    error: lastError,
    ...(lastReason ? { error_reason: lastReason } : {}),
    receipt
  };
}

/**
 * Verifies live Google AI Studio connectivity by discovering models AND executing a minimal
 * generateContent probe (maxOutputTokens: 8, temperature: 0).
 * Never reports connected: true or verified: true unless BOTH steps succeed.
 * @param {object} env
 * @param {{ ownerId?: string, secretId?: string, model?: string, fetcher?: typeof fetch, timeoutMs?: number }} [options]
 */
export async function verifyAiStudioConnection(env, options = {}) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const discovery = await listAiStudioModels(env, options);
  if (!discovery.ok) {
    const latencyMs = Date.now() - startedAtMs;
    const completedAt = new Date().toISOString();
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'verify_connection',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'api', id: GOOGLE_AI_STUDIO_BASE_URL },
      evidence: [{
        type: 'api',
        id: 'verify_models_failed',
        description: String(discovery.error || 'Model discovery failed.').slice(0, 500)
      }],
      metrics: { latency_ms: latencyMs },
      startedAt,
      completedAt
    });
    return {
      ok: false,
      connected: false,
      verified: false,
      model: null,
      models_count: 0,
      latency_ms: latencyMs,
      source: discovery.source || null,
      error: discovery.error || 'Google AI Studio model discovery failed.',
      receipt
    };
  }

  const probeModel = cleanModelId(options?.model) || discovery.recommended_model || AI_STUDIO_DEFAULT_MODELS[0];
  const probe = await generateAiStudioContent(
    env,
    {
      prompt: 'Reply with OK.',
      model: probeModel,
      maxOutputTokens: 8,
      temperature: 0,
      ownerId: options?.ownerId,
      secretId: options?.secretId
    },
    {
      fetcher: options?.fetcher,
      timeoutMs: options?.timeoutMs
    }
  );

  const latencyMs = Date.now() - startedAtMs;
  const completedAt = new Date().toISOString();

  if (!probe.ok || !probe.text) {
    const errorMsg = probe.error || 'Google AI Studio verification probe returned an empty response.';
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'verify_connection',
      status: 'failed',
      actor: { type: 'system', id: 'google-ai-studio-bridge' },
      target: { type: 'model', id: probeModel },
      evidence: [{
        type: 'api',
        id: 'verify_probe_failed',
        description: errorMsg.slice(0, 500)
      }],
      metrics: { latency_ms: latencyMs, models_count: discovery.total },
      startedAt,
      completedAt
    });
    return {
      ok: false,
      connected: false,
      verified: false,
      model: probe.model || probeModel,
      models_count: discovery.total,
      latency_ms: latencyMs,
      source: discovery.source,
      error: errorMsg,
      receipt
    };
  }

  const receipt = buildReceipt({
    tool: 'google_ai_studio',
    action: 'verify_connection',
    status: 'success',
    actor: { type: 'system', id: 'google-ai-studio-bridge' },
    target: { type: 'model', id: probe.model },
    evidence: [{
      type: 'api',
      id: 'verify_connection_ok',
      description: `Verified Google AI Studio live model discovery (${discovery.total} models) and generateContent probe on ${probe.model}.`,
      afterHash: hashPayload({ model: probe.model, models_count: discovery.total, probe_text: probe.text })
    }],
    metrics: { latency_ms: latencyMs, models_count: discovery.total },
    startedAt,
    completedAt
  });

  return {
    ok: true,
    connected: true,
    verified: true,
    model: probe.model,
    models_count: discovery.total,
    latency_ms: latencyMs,
    source: discovery.source,
    receipt
  };
}

/**
 * Retrieves a persisted multi-turn co-creation session from D1 ops_memory (or KV Mastermind fallback).
 * @param {object} env
 * @param {string} sessionId
 * @returns {Promise<{ session_id: string, mode: string, turns: Array<object>, updated_at: string } | null>}
 */
export async function getAiStudioSession(env, sessionId) {
  const cleanId = sanitizeSessionId(sessionId);
  if (!cleanId) return null;
  const key = `${SESSION_KEY_PREFIX}${cleanId}`;

  if (env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare('SELECT value, updated_at FROM ops_memory WHERE key = ?')
        .bind(key)
        .first();
      if (row && typeof row.value === 'string') {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object') {
          return {
            session_id: cleanId,
            mode: parsed.mode || 'pair',
            turns: Array.isArray(parsed.turns) ? parsed.turns : [],
            updated_at: parsed.updated_at || row.updated_at || new Date().toISOString()
          };
        }
      }
    } catch {
      // Fall through to KV fallback.
    }
  }

  if (env?.Mastermind?.get) {
    try {
      const raw = await env.Mastermind.get(key);
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            session_id: cleanId,
            mode: parsed.mode || 'pair',
            turns: Array.isArray(parsed.turns) ? parsed.turns : [],
            updated_at: parsed.updated_at || new Date().toISOString()
          };
        }
      }
    } catch {
      // Fail closed to null.
    }
  }

  return null;
}

/**
 * Lists recent persisted co-creation sessions from D1 ops_memory (or KV Mastermind fallback).
 * @param {object} env
 * @param {number} [limit=20]
 * @returns {Promise<{ items: Array<{ session_id: string, mode: string, turns_count: number, last_task: string, updated_at: string }> }>}
 */
export async function listAiStudioSessions(env, limit = 20) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Math.round(Number(limit)))) : 20;
  const items = [];

  if (env?.DB?.prepare) {
    try {
      const res = await env.DB.prepare(
        "SELECT key, value, updated_at FROM ops_memory WHERE key LIKE ? ORDER BY updated_at DESC LIMIT ?"
      ).bind(`${SESSION_KEY_PREFIX}%`, safeLimit).all();
      const rows = Array.isArray(res?.results) ? res.results : [];
      for (const row of rows) {
        if (!row?.key || typeof row.value !== 'string') continue;
        try {
          const parsed = JSON.parse(row.value);
          const sessionId = String(row.key).slice(SESSION_KEY_PREFIX.length);
          const turns = Array.isArray(parsed?.turns) ? parsed.turns : [];
          const lastTurn = turns[turns.length - 1] || null;
          items.push({
            session_id: parsed?.session_id || sessionId,
            mode: parsed?.mode || 'pair',
            turns_count: turns.length,
            last_task: typeof lastTurn?.task === 'string' ? lastTurn.task.slice(0, 200) : '',
            updated_at: parsed?.updated_at || row.updated_at || ''
          });
        } catch {
          // Skip malformed records.
        }
      }
      return { items };
    } catch {
      // Fall through to KV fallback.
    }
  }

  if (env?.Mastermind?.list && env?.Mastermind?.get) {
    try {
      const listed = await env.Mastermind.list({ prefix: SESSION_KEY_PREFIX, limit: safeLimit });
      const keys = Array.isArray(listed?.keys) ? listed.keys : [];
      for (const entry of keys.slice(0, safeLimit)) {
        const keyName = typeof entry === 'string' ? entry : entry?.name;
        if (!keyName) continue;
        try {
          const raw = await env.Mastermind.get(keyName);
          if (typeof raw !== 'string') continue;
          const parsed = JSON.parse(raw);
          const sessionId = keyName.slice(SESSION_KEY_PREFIX.length);
          const turns = Array.isArray(parsed?.turns) ? parsed.turns : [];
          const lastTurn = turns[turns.length - 1] || null;
          items.push({
            session_id: parsed?.session_id || sessionId,
            mode: parsed?.mode || 'pair',
            turns_count: turns.length,
            last_task: typeof lastTurn?.task === 'string' ? lastTurn.task.slice(0, 200) : '',
            updated_at: parsed?.updated_at || ''
          });
        } catch {
          // Skip malformed entries.
        }
      }
      items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return { items };
    } catch {
      return { items: [] };
    }
  }

  return { items };
}

async function persistAiStudioSession(env, session) {
  const key = `${SESSION_KEY_PREFIX}${session.session_id}`;
  const serialized = JSON.stringify(session);

  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(
        "INSERT INTO ops_memory(key, value, source, updated_at) VALUES(?, ?, 'google-ai-studio-bridge', datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, source=excluded.source, updated_at=datetime('now')"
      ).bind(key, serialized).run();
      return { persisted: true, store: 'd1:ops_memory' };
    } catch {
      // Fall through to KV fallback.
    }
  }

  if (env?.Mastermind?.put) {
    try {
      await env.Mastermind.put(key, serialized, { expirationTtl: 604800 });
      return { persisted: true, store: 'kv:Mastermind' };
    } catch {
      return { persisted: false, store: null };
    }
  }

  return { persisted: false, store: null };
}

function buildTrinityCollaborationPlan({ task, mode, context, artifact, priorTurnsCount }) {
  const modeObjectives = {
    pair: 'Co-design and implement a concrete, production-ready technical solution together, verifying interfaces, security boundaries, and edge cases.',
    brainstorm: 'Explore structured architectural and product options, compare trade-offs explicitly, and recommend a prioritized path forward.',
    review: 'Audit the provided design or artifact for correctness, security, maintainability, and Truth Policy 2.1 compliance, then propose exact fixes.',
    build_artifact: 'Produce a complete, clean, self-contained deliverable artifact (code, specification, UI, or schema) accompanied by verification guidance.'
  };

  const lines = [
    `[Trinity Co-Creation Plan | Mode: ${mode} | Turn: ${priorTurnsCount + 1}]`,
    `Objective: ${modeObjectives[mode] || modeObjectives.pair}`,
    `Task Scope: ${task.slice(0, 600)}`,
    `Context Provided: ${context ? 'yes' : 'no'} | Input Artifact Provided: ${artifact ? 'yes' : 'no'} | Prior Turns Loaded: ${priorTurnsCount}`,
    'Execution Protocol:',
    '1. Perform all engineering analysis, architecture, code, and verification design in English.',
    '2. Preserve Truth Policy 2.1: distinguish verified evidence from proposals and never fabricate external execution results.',
    '3. Deliver the final user-facing synthesis in the configured user communication language.'
  ];
  return lines.join('\n');
}

function buildCollaborationSystemInstruction(mode, userCommunication) {
  const userLangRule = userCommunication === 'en'
    ? 'Write the ===USER_REPLY=== section in clear, natural English for the user.'
    : 'Write the ===USER_REPLY=== section strictly in natural Slovak for the owner/user.';

  const artifactRule = mode === 'build_artifact'
    ? 'Because mode is build_artifact, you MUST also include an ===ARTIFACT:<type>=== section (for example ===ARTIFACT:javascript===, ===ARTIFACT:html===, or ===ARTIFACT:markdown===) containing the complete artifact.'
    : 'If your collaboration produces a concrete code/config/document artifact, optionally include ===ARTIFACT:<type>=== followed by the artifact content.';

  return [
    'You are Google AI Studio collaborating directly with Trinity OMNI-CORE as an engineering co-creation partner.',
    'Internal Engineering Language Rule: Conduct all technical reasoning, architecture, code, comments, identifiers, and verification plans strictly in English.',
    'Truth Policy 2.1 Rule: Never claim unverified external execution, live deployments, or secret access. Clearly distinguish proposed code/plans from verified runtime results.',
    'Format your response using these exact section headers:',
    '===INTERNAL_ANALYSIS===',
    '(Concise English engineering analysis, concrete decisions, and technical details)',
    '===USER_REPLY===',
    `(${userLangRule})`,
    artifactRule
  ].join('\n');
}

function parseCollaborationResponse(rawText, mode) {
  const text = String(rawText || '').trim();
  if (!text) {
    return { internalAnalysis: '', finalReply: '', artifact: null };
  }

  const analysisMatch = text.match(/===INTERNAL_ANALYSIS===\s*([\s\S]*?)(?====USER_REPLY===|===ARTIFACT:|$)/i);
  const replyMatch = text.match(/===USER_REPLY===\s*([\s\S]*?)(?====ARTIFACT:|$)/i);
  const artifactMatch = text.match(/===ARTIFACT:([A-Za-z0-9._-]+)===\s*([\s\S]*)$/i);

  const internalAnalysis = analysisMatch ? analysisMatch[1].trim() : '';
  let finalReply = replyMatch ? replyMatch[1].trim() : text;
  let artifact = null;

  if (artifactMatch && artifactMatch[2].trim()) {
    artifact = {
      type: artifactMatch[1].trim().toLowerCase(),
      content: artifactMatch[2].trim()
    };
  } else if (mode === 'build_artifact') {
    const fenceMatch = text.match(/```([A-Za-z0-9._-]*)\n([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[2].trim()) {
      artifact = {
        type: (fenceMatch[1] || 'text').trim().toLowerCase() || 'text',
        content: fenceMatch[2].trim()
      };
    }
  }

  if (!finalReply) {
    finalReply = text;
  }

  return { internalAnalysis, finalReply, artifact };
}

/**
 * Runs a multi-turn collaborative co-creation turn between Trinity and Google AI Studio.
 * Internal prompts, plans, and technical collaboration are 100% English; user-facing
 * synthesis defaults to Slovak ('sk') with 'en' and 'auto' support.
 * Fails closed when unconfigured unless allow_edge_fallback is explicitly true.
 * Persists the last 12 turns in D1 ops_memory (key `aistudio:session:<session_id>`) with KV Mastermind fallback.
 *
 * @param {object} env
 * @param {{
 *   session_id?: string,
 *   task: string,
 *   mode?: 'pair' | 'brainstorm' | 'review' | 'build_artifact',
 *   model?: string,
 *   context?: string,
 *   artifact?: string,
 *   reply_language?: 'sk' | 'en' | 'auto',
 *   allow_edge_fallback?: boolean,
 *   temperature?: number,
 *   maxOutputTokens?: number,
 *   ownerId?: string,
 *   secretId?: string
 * }} input
 * @param {{ fetcher?: typeof fetch, timeoutMs?: number }} [options]
 */
export async function coCreateWithAiStudio(env, input = {}, options = {}) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const task = typeof input?.task === 'string' ? input.task.trim() : '';
  const requestedMode = String(input?.mode || 'pair').toLowerCase().trim();
  const mode = VALID_COCREATE_MODES.has(requestedMode) ? requestedMode : 'pair';
  const languagePolicy = detectLanguagePolicy(input?.reply_language, task);
  const sessionId = sanitizeSessionId(input?.session_id) || `cocreate-${crypto.randomUUID().slice(0, 12)}`;
  const allowEdgeFallback = Boolean(input?.allow_edge_fallback);

  if (!task) {
    const completedAt = new Date().toISOString();
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'co_create',
      status: 'failed',
      actor: { type: 'agent', id: 'trinity' },
      target: { type: 'session', id: sessionId },
      evidence: [{ type: 'api', id: 'invalid_task', description: 'Co-creation task must be a non-empty string.' }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      session_id: sessionId,
      turn: 0,
      mode,
      language_policy: languagePolicy,
      trinity_plan: '',
      ai_studio_contribution: null,
      final_reply: '',
      artifact: null,
      error: 'Co-creation task must be a non-empty string.',
      receipt,
      _evidence: {
        effect: 'inference',
        receipt_id: receipt.receiptId,
        timestamp: completedAt
      }
    };
  }

  const cred = await resolveAiStudioCredential(env, {
    ownerId: input?.ownerId ?? options?.ownerId,
    secretId: input?.secretId ?? options?.secretId
  });

  if (!cred.apiKey && !allowEdgeFallback) {
    const completedAt = new Date().toISOString();
    const error = 'Google AI Studio credential is not configured. Configure GOOGLE_AI_STUDIO_API_KEY, GEMINI_API_KEY, TRINITY_MASTER_GOOGLE, or encrypted Vault.';
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'co_create',
      status: 'failed',
      actor: { type: 'agent', id: 'trinity' },
      target: { type: 'session', id: sessionId },
      evidence: [{ type: 'api', id: 'unconfigured_fail_closed', description: error }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      session_id: sessionId,
      turn: 0,
      mode,
      language_policy: languagePolicy,
      trinity_plan: '',
      ai_studio_contribution: null,
      final_reply: '',
      artifact: null,
      error,
      receipt,
      _evidence: {
        effect: 'inference',
        receipt_id: receipt.receiptId,
        timestamp: completedAt
      }
    };
  }

  const existingSession = await getAiStudioSession(env, sessionId);
  const priorTurns = Array.isArray(existingSession?.turns) ? existingSession.turns : [];
  const lastPersistedTurn = Number(priorTurns[priorTurns.length - 1]?.turn) || 0;
  const turnNumber = Math.max(priorTurns.length, lastPersistedTurn) + 1;

  const contextText = typeof input?.context === 'string' ? input.context.trim() : '';
  const artifactText = typeof input?.artifact === 'string' ? input.artifact.trim() : '';

  const trinityPlan = buildTrinityCollaborationPlan({
    task,
    mode,
    context: contextText,
    artifact: artifactText,
    priorTurnsCount: priorTurns.length
  });

  const systemInstruction = buildCollaborationSystemInstruction(mode, languagePolicy.user_communication);

  const messages = [];
  for (const prior of priorTurns.slice(-(MAX_SESSION_TURNS - 1))) {
    if (prior?.task) {
      messages.push({ role: 'user', content: `[Turn ${prior.turn} Task]\n${prior.task}` });
    }
    if (prior?.ai_studio_text || prior?.final_reply) {
      messages.push({ role: 'model', content: prior.ai_studio_text || prior.final_reply });
    }
  }

  const currentPromptParts = [
    trinityPlan,
    `\nUser Task:\n${task}`
  ];
  if (contextText) {
    currentPromptParts.push(`\nAdditional Context:\n${contextText}`);
  }
  if (artifactText) {
    currentPromptParts.push(`\nExisting Artifact:\n${artifactText}`);
  }
  messages.push({ role: 'user', content: currentPromptParts.join('\n') });

  let contribution = null;
  let usedEdgeFallback = false;

  if (cred.apiKey) {
    const genRes = await generateAiStudioContent(
      env,
      {
        messages,
        systemInstruction,
        model: input?.model,
        temperature: typeof input?.temperature === 'number' ? input.temperature : (mode === 'brainstorm' ? 0.6 : 0.3),
        maxOutputTokens: typeof input?.maxOutputTokens === 'number' ? input.maxOutputTokens : 4096,
        ownerId: input?.ownerId ?? options?.ownerId,
        secretId: input?.secretId ?? options?.secretId
      },
      options
    );

    if (genRes.ok) {
      contribution = {
        model: genRes.model,
        text: genRes.text,
        usage: genRes.usage,
        latency_ms: genRes.latency_ms
      };
    } else if (!allowEdgeFallback) {
      const completedAt = new Date().toISOString();
      const receipt = buildReceipt({
        tool: 'google_ai_studio',
        action: 'co_create',
        status: 'failed',
        actor: { type: 'agent', id: 'trinity' },
        target: { type: 'session', id: sessionId },
        evidence: [{
          type: 'api',
          id: 'ai_studio_generation_failed',
          description: String(genRes.error || 'Google AI Studio generation failed.').slice(0, 500)
        }],
        startedAt,
        completedAt
      });
      return {
        ok: false,
        session_id: sessionId,
        turn: turnNumber,
        mode,
        language_policy: languagePolicy,
        trinity_plan: trinityPlan,
        ai_studio_contribution: null,
        final_reply: '',
        artifact: null,
        status: genRes.status || 502,
        error: genRes.error || 'Google AI Studio generation failed.',
        receipt,
        _evidence: {
          effect: 'inference',
          receipt_id: receipt.receiptId,
          timestamp: completedAt
        }
      };
    }
  }

  if (!contribution && allowEdgeFallback && env?.AI?.run) {
    const edgeStart = Date.now();
    const edgeModel = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    try {
      const edgeMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content
        }))
      ];
      const edgeOut = await env.AI.run(edgeModel, {
        messages: edgeMessages,
        max_tokens: 2048,
        temperature: 0.3
      });
      const edgeText = typeof edgeOut === 'string'
        ? edgeOut
        : (typeof edgeOut?.response === 'string' ? edgeOut.response : (typeof edgeOut?.output_text === 'string' ? edgeOut.output_text : ''));
      if (edgeText.trim()) {
        usedEdgeFallback = true;
        contribution = {
          model: edgeModel,
          provider: 'workers-ai-fallback',
          text: edgeText.trim(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          latency_ms: Date.now() - edgeStart
        };
      }
    } catch {
      // Fall through to fail-closed error below.
    }
  }

  if (!contribution) {
    const completedAt = new Date().toISOString();
    const error = 'No inference backend succeeded for Google AI Studio co-creation.';
    const receipt = buildReceipt({
      tool: 'google_ai_studio',
      action: 'co_create',
      status: 'failed',
      actor: { type: 'agent', id: 'trinity' },
      target: { type: 'session', id: sessionId },
      evidence: [{ type: 'api', id: 'no_backend_available', description: error }],
      startedAt,
      completedAt
    });
    return {
      ok: false,
      session_id: sessionId,
      turn: turnNumber,
      mode,
      language_policy: languagePolicy,
      trinity_plan: trinityPlan,
      ai_studio_contribution: null,
      final_reply: '',
      artifact: null,
      error,
      receipt,
      _evidence: {
        effect: 'inference',
        receipt_id: receipt.receiptId,
        timestamp: completedAt
      }
    };
  }

  const parsed = parseCollaborationResponse(contribution.text, mode);
  const updatedAt = new Date().toISOString();

  const nextTurns = [
    ...priorTurns,
    {
      turn: turnNumber,
      mode,
      task: task.slice(0, 2000),
      trinity_plan: trinityPlan,
      model: contribution.model,
      ai_studio_text: contribution.text.slice(0, 6000),
      final_reply: parsed.finalReply.slice(0, 4000),
      artifact: parsed.artifact ? { type: parsed.artifact.type, content: parsed.artifact.content.slice(0, 6000) } : null,
      timestamp: updatedAt
    }
  ].slice(-MAX_SESSION_TURNS);

  const persistence = await persistAiStudioSession(env, {
    session_id: sessionId,
    mode,
    turns: nextTurns,
    updated_at: updatedAt
  });

  const completedAt = new Date().toISOString();
  const evidenceItems = [{
    type: 'api',
    id: `cocreate:${sessionId}:turn-${turnNumber}`,
    description: usedEdgeFallback
      ? `Completed co-creation turn ${turnNumber} using explicit Workers AI fallback (${contribution.model}).`
      : `Completed Trinity <-> Google AI Studio co-creation turn ${turnNumber} via ${contribution.model}.`,
    afterHash: hashPayload({ session_id: sessionId, turn: turnNumber, model: contribution.model, final_reply: parsed.finalReply })
  }];

  if (persistence.persisted) {
    evidenceItems.push({
      type: 'database',
      id: `${SESSION_KEY_PREFIX}${sessionId}`,
      description: `Persisted bounded co-creation session (${nextTurns.length}/${MAX_SESSION_TURNS} turns) in ${persistence.store}.`
    });
  }

  const receipt = buildReceipt({
    tool: 'google_ai_studio',
    action: 'co_create',
    status: 'success',
    actor: { type: 'agent', id: 'trinity' },
    target: { type: 'session', id: sessionId },
    evidence: evidenceItems,
    metrics: {
      turn: turnNumber,
      persisted_turns: nextTurns.length,
      latency_ms: Date.now() - startedAtMs
    },
    startedAt,
    completedAt
  });

  return {
    ok: true,
    session_id: sessionId,
    turn: turnNumber,
    mode,
    language_policy: languagePolicy,
    trinity_plan: trinityPlan,
    ai_studio_contribution: contribution,
    final_reply: parsed.finalReply,
    artifact: parsed.artifact,
    receipt,
    _evidence: {
      effect: persistence.persisted ? 'mutation' : 'inference',
      receipt_id: receipt.receiptId,
      timestamp: completedAt
    }
  };
}
