/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CLAUDE_AGENT
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Sovereign Anthropic Claude agent (3.7 Sonnet, 3.5 Sonnet, Haiku, Opus) in the TRINITY OMNI-CORE ecosystem.
 * Full integration with model cascade, Secrets Store binding, and cross-provider fallback to Google Gemini.
 */
import { resolveProviderSecret } from './secret-vault.js';
import { sanitizeApiKey } from './ai-providers.js';
import { executeGeminiGemAgent } from './gemini-gem-agent.js';
import { buildReceipt, hashPayload } from './receipt.js';

export const CLAUDE_MODEL_CASCADE = Object.freeze([
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229'
]);

export const CLAUDE_SYSTEM_PROFILE = [
  'You are Claude, an advanced reasoning and coding partner integrated into the sovereign TRINITY OMNI-CORE ecosystem.',
  'You collaborate directly with Basterix (Sabo Ivan) and Antigravity.',
  'Be concise, technically rigorous, and thorough.',
  'Enforce Truth Policy 2.1: NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT. Never fabricate outputs, execution receipts, or data.',
  'When designing architecture or writing code, deliver complete, working, and testable solutions.',
  "COMMUNICATION LANGUAGE RULE: Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language."
].join('\n');

/**
 * Execute inference via the Anthropic Claude Messages API with model cascade and optional Google Gemini fallback.
 */
export async function executeClaudeAgent(env, task, options = {}) {
  const rawKey = await resolveProviderSecret(env, 'anthropic') || await resolveProviderSecret(env, 'claude');
  const apiKey = sanitizeApiKey(rawKey);

  // If the Claude API key is unavailable, transparently delegate to the partner Google Gemini engine
  if (!apiKey) {
    if (options.allowFallback !== false) {
      const geminiResult = await executeGeminiGemAgent(env, task, {
        systemPrompt: options.systemPrompt || CLAUDE_SYSTEM_PROFILE,
        maxTokens: options.maxTokens || 4096
      }).catch(() => null);
      if (geminiResult && geminiResult.success) {
        return {
          ...geminiResult,
          fallback_from: 'claude',
          note: 'Claude credential was not configured in Secrets Store; the task was resolved via Google Gemini.'
        };
      }
    }
    throw new Error('Anthropic Claude API key is not configured in Cloudflare Secrets Store or the Secret Vault.');
  }

  const requestedModel = options.model || env.ANTHROPIC_MODEL || CLAUDE_MODEL_CASCADE[0];
  const maxTokens = Math.min(options.maxTokens || 4096, 8192);
  const systemPrompt = options.systemPrompt || CLAUDE_SYSTEM_PROFILE;

  const messages = Array.isArray(options.messages) && options.messages.length > 0
    ? options.messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 50000)
      }))
    : [{ role: 'user', content: String(task).slice(0, 50000) }];

  const candidateModels = [
    requestedModel,
    ...CLAUDE_MODEL_CASCADE.filter(m => m !== requestedModel)
  ];

  let lastError = null;
  let text = '';
  let usedModel = requestedModel;
  let usage = { input_tokens: 0, output_tokens: 0 };

  for (const model of candidateModels) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages,
          max_tokens: maxTokens,
          temperature: typeof options.temperature === 'number' ? options.temperature : 0.25
        }),
        signal: AbortSignal.timeout(options.timeoutMs || 45000),
        redirect: 'manual'
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        const errMsg = errBody.error?.message || `HTTP ${resp.status}`;
        lastError = new Error(`Claude API [${model}] failed: ${errMsg}`);
        // On model not found, overload, or rate limit, try the next model in the cascade
        if (resp.status === 404 || resp.status === 529 || resp.status === 429) {
          continue;
        }
        break;
      }

      const data = await resp.json();
      text = data.content?.[0]?.text || '';
      usedModel = data.model || model;
      usage = data.usage || usage;
      if (text.trim()) break;
    } catch (err) {
      lastError = err;
    }
  }

  // If the entire Claude model cascade failed, attempt partner fallback to Google Gemini
  if (!text && options.allowFallback !== false) {
    try {
      const geminiFallback = await executeGeminiGemAgent(env, task, {
        systemPrompt,
        maxTokens
      });
      if (geminiFallback && geminiFallback.success) {
        return {
          ...geminiFallback,
          fallback_from: 'claude',
          error_encountered: lastError?.message,
          note: 'Claude API experienced an outage; the request was transparently and safely resolved via Google Gemini.'
        };
      }
    } catch (_) {}
  }

  if (!text) {
    throw lastError || new Error('Claude returned an empty response and the partner Google Gemini fallback did not succeed.');
  }

  const receipt = buildReceipt({
    tool: 'claude_agent',
    action: 'inference',
    status: 'success',
    actor: { type: 'agent', id: 'claude' },
    target: { type: 'model', id: usedModel },
    evidence: [
      {
        type: 'api',
        id: 'claude_task_payload',
        description: 'Input task payload for Claude model',
        afterHash: hashPayload(task)
      },
      {
        type: 'api',
        id: 'claude_response_payload',
        description: 'Verified generated response payload',
        afterHash: hashPayload(text)
      }
    ],
    metrics: {
      inputTokens: Number(usage.input_tokens || 0),
      outputTokens: Number(usage.output_tokens || 0)
    }
  });

  const receiptId = receipt.receiptId;
  return {
    success: true,
    text,
    model: usedModel,
    provider: 'anthropic-claude',
    usage,
    receipt,
    receipt_id: receiptId,
    _evidence: {
      effect: 'read',
      action: 'claude:inference',
      model: usedModel,
      receipt_id: receiptId,
      timestamp: new Date().toISOString()
    }
  };
}
