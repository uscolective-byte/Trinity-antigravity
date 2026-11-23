/**
 * @module TRINITY_OMNI_CORE
 * @subsystem MULTI_MODEL_CONSENSUS_BUS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Parallel Multi-Model Consensus Bus across real configured AI providers (Workers AI, Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, OpenRouter). Enforces Truth Policy 2.0 (never fabricates replies from unconfigured models).
 */

import { callModel } from './services.js';
import { buildReceipt, hashPayload } from './receipt.js';

export const DEFAULT_CONSENSUS_PROVIDERS = Object.freeze([
  'workers-ai',
  'gemini',
  'openai',
  'anthropic',
  'groq',
  'deepseek'
]);

const ALLOWED_PROVIDERS = new Set([
  'workers-ai',
  'gemini',
  'openai',
  'anthropic',
  'claude',
  'groq',
  'deepseek',
  'mistral',
  'openrouter'
]);

/**
 * Dispatches a parallel query to all selected providers and merges verified responses.
 * @param {object} env
 * @param {string} task
 * @param {object} [opts]
 * @param {string[]} [opts.providers]
 * @param {number} [opts.maxTokens]
 * @param {boolean} [opts.synthesize=true]
 */
export async function runMultiModelConsensus(env, task, opts = {}) {
  const cleanTask = String(task || '').trim();
  if (!cleanTask) {
    throw new Error('Missing task for Multi-Model Consensus.');
  }

  const requested = Array.isArray(opts.providers) && opts.providers.length
    ? opts.providers.map((p) => String(p).trim().toLowerCase()).filter((p) => ALLOWED_PROVIDERS.has(p))
    : [...DEFAULT_CONSENSUS_PROVIDERS];
  const providers = [...new Set(requested)].slice(0, 8);
  if (!providers.length) {
    throw new Error('No valid AI provider selected for consensus.');
  }

  const maxTokens = Math.min(Math.max(Number(opts.maxTokens) || 1200, 256), 4096);
  const systemPrompt =
    'You are Trinity (v12.0). Answer clearly, naturally, practically, and accurately. Never fabricate non-existent data or claim unverified executed actions. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal \'tykanie\' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: cleanTask }
  ];

  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    providers.map(async (provider) => {
      const pStart = Date.now();
      const res = await callModel(env, provider, messages, maxTokens, null, {
        directAI: true,
        temperature: 0.55
      });
      return {
        provider,
        ok: true,
        model: res.model || provider,
        text: String(res.text || '').trim(),
        duration_ms: Date.now() - pStart
      };
    })
  );

  const responses = settled.map((item, idx) => {
    const provider = providers[idx];
    if (item.status === 'fulfilled' && item.value?.text) {
      return item.value;
    }
    const reason = item.status === 'rejected'
      ? (item.reason?.message || String(item.reason || 'Provider error'))
      : 'Model returned an empty response.';
    return {
      provider,
      ok: false,
      error: reason,
      duration_ms: 0
    };
  });

  const succeeded = responses.filter((r) => r.ok);
  const failed = responses.filter((r) => !r.ok);

  if (succeeded.length === 0) {
    const summaryErr = failed.map((f) => `${f.provider}: ${f.error}`).join('; ');
    throw new Error(`No consensus model responded (${summaryErr}).`);
  }

  let consensusText = succeeded[0].text;
  let synthesizedBy = null;

  if (succeeded.length >= 2 && opts.synthesize !== false) {
    const synthesisMessages = [
      {
        role: 'system',
        content:
          'You are Trinity\'s Multi-Model Consensus Synthesizer. Below are real responses from multiple AI models to the same question. Synthesize them into one clear, natural, practical response: summarize areas of agreement, integrate the strongest insights from each model, and briefly note where they diverge. Never fabricate extra facts. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal \'tykanie\' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.'
      },
      {
        role: 'user',
        content:
          `Question:\n${cleanTask}\n\n` +
          succeeded.map((r) => `--- ${r.provider} (${r.model}) ---\n${r.text.slice(0, 3500)}`).join('\n\n')
      }
    ];
    try {
      const synth = await callModel(env, succeeded[0].provider, synthesisMessages, 1800, null, {
        directAI: true,
        temperature: 0.5
      });
      if (synth?.text?.trim()) {
        consensusText = synth.text.trim();
        synthesizedBy = `${succeeded[0].provider} (${synth.model || succeeded[0].model})`;
      }
    } catch {
      // If final synthesis fails, return an honest summary without fabrication
      consensusText = succeeded.map((r) => `**${r.provider} (${r.model})**:\n${r.text}`).join('\n\n');
    }
  } else if (succeeded.length === 1 && failed.length > 0) {
    const missingList = failed.map((f) => f.provider).join(', ');
    consensusText = `${succeeded[0].text}\n\n*(Odpovedal reálne iba **${succeeded[0].provider}** [${succeeded[0].model}]. Ostatní poskytovatelia nie sú pripojení alebo neodpovedali: ${missingList}.)*`;
  }

  const inputHash = await hashPayload(cleanTask);
  const outputHash = await hashPayload(consensusText);
  const receipt = buildReceipt({
    tool: 'multi_model_consensus',
    action: 'parallel_consensus',
    status: succeeded.length === providers.length ? 'success' : 'partial',
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date().toISOString(),
    evidence: [
      {
        type: 'api',
        id: `consensus-${startedAt}`,
        description: `Responded ${succeeded.length}/${providers.length} (${succeeded.map((s) => s.provider).join(', ')})`,
        beforeHash: inputHash,
        afterHash: outputHash
      }
    ],
    metrics: {
      attempted: providers.length,
      responded: succeeded.length,
      failed: failed.length
    }
  });

  return {
    ok: true,
    task: cleanTask,
    consensus_text: consensusText,
    synthesized_by: synthesizedBy,
    attempted_count: providers.length,
    responded_count: succeeded.length,
    responses,
    duration_ms: Date.now() - startedAt,
    receipt,
    _evidence: {
      effect: 'read',
      action: 'multi_model_consensus',
      receipt_id: receipt.receiptId
    }
  };
}
