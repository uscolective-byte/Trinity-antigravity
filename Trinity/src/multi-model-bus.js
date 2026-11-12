/**
 * @module TRINITY_OMNI_CORE
 * @subsystem MULTI_MODEL_CONSENSUS_BUS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Paralelný Multi-Model Consensus Bus cez reálnych nakonfigurovaných AI poskytovateľov (Workers AI, Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, OpenRouter). Dodržiava Truth Policy 2.0 (žiadne vymyslené odpovede nenastavených modelov).
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
 * Spustí paralelný dotaz na všetkých zvolených poskytovateľov a spojí overené odpovede.
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
    throw new Error('Chýba zadanie (task) pre Multi-Model Consensus.');
  }

  const requested = Array.isArray(opts.providers) && opts.providers.length
    ? opts.providers.map((p) => String(p).trim().toLowerCase()).filter((p) => ALLOWED_PROVIDERS.has(p))
    : [...DEFAULT_CONSENSUS_PROVIDERS];
  const providers = [...new Set(requested)].slice(0, 8);
  if (!providers.length) {
    throw new Error('Nie je vybraný žiadny platný AI poskytovateľ pre konsenzus.');
  }

  const maxTokens = Math.min(Math.max(Number(opts.maxTokens) || 1200, 256), 4096);
  const systemPrompt =
    'Si Trinity (v12.0). Odpovedz jasne, ľudsky, prakticky a vecne v jazyku používateľa. Nikdy nevymýšľaj neexistujúce dáta ani vykonané akcie.';
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
      ? (item.reason?.message || String(item.reason || 'Chyba poskytovateľa'))
      : 'Model vrátil prázdnu odpoveď.';
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
    throw new Error(`Žiadny model pre konsenzus neodpovedal (${summaryErr}).`);
  }

  let consensusText = succeeded[0].text;
  let synthesizedBy = null;

  if (succeeded.length >= 2 && opts.synthesize !== false) {
    const synthesisMessages = [
      {
        role: 'system',
        content:
          'Si syntetizátor Multi-Model konsenzu Trinity. Máš nižšie skutočné odpovede z viacerých AI modelov na rovnakú otázku. Vytvor z nich jednu jasnú, ľudskú, praktickú odpoveď v jazyku používateľa: zhrň zhodu, doplň najlepšie nápady z jednotlivých modelov a stručne upozorni, ak sa niekde rozchádzajú. Nevymýšľaj fakty navyše.'
      },
      {
        role: 'user',
        content:
          `Otázka:\n${cleanTask}\n\n` +
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
      // Ak finálna syntéza zlyhá, vrátime poctivý súhrn bez vymýšľania
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
