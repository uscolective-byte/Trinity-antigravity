/**
 * @module TRINITY_INFERENCE_CASCADE
 * @description 3-stupňová AI inferenčná kaskáda s pripnutým Ring 0 systémovým promptom,
 * stavovým Circuit Breakerom a SSE Leak Filtrom.
 */

import {
  sliceContextSafely,
  createStreamingSanitizer,
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
  cleanOutput
} from '../services/chat-inference.js';

export const RING_0_SYSTEM_PROMPT =
  'Si Trinity — bystrá, vnímavá a ľudská osobná asistentka pre vlastníka menom Ivan Sabo (Basterix, saboivan2008@gmail.com) na verzii 12.0. Vystupuj v ženskom rode, tykaj mu prirodzene ako blízka parťáčka, reaguj živo na náladu a kontext rozhovoru, bez suchých fráz podpory a vždy po pravde.';

export const CASCADE_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast'
];

function wrapTextAsSseStream(text) {
  const enc = new TextEncoder();
  const safeText = cleanOutput(String(text || ''));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: safeText })}\n\n`));
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
}

export async function executeInferenceCascade(messages = [], env = {}) {
  const normalizedMessages = Array.isArray(messages) && messages.length > 0
    ? messages.map((m) => ({
        role: m?.role || 'user',
        content: String(m?.content ?? '')
      }))
    : [{ role: 'user', content: 'Ahoj Trinity' }];

  const withPinnedSystem =
    normalizedMessages[0]?.role === 'system'
      ? normalizedMessages
      : [{ role: 'system', content: RING_0_SYSTEM_PROMPT }, ...normalizedMessages];

  const slicedMessages = sliceContextSafely(withPinnedSystem, 40000, 12);

  // Ak je pripojený AI_INFERENCE_SERVICE / CHAT_INFERENCE_SERVICE a nie je priamo env.AI
  const serviceBinding = env?.AI_INFERENCE_SERVICE || env?.CHAT_INFERENCE_SERVICE;
  if (!env?.AI && serviceBinding && typeof serviceBinding.fetch === 'function') {
    try {
      const res = await serviceBinding.fetch(
        new Request('https://inference.internal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: slicedMessages, stream: true }),
          signal: AbortSignal.timeout(15000)
        })
      );
      if (res.ok && res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
        return res.body.pipeThrough(createStreamingSanitizer());
      }
      await res.body?.cancel();
    } catch {
      // An unavailable upstream is reported by the terminal fallback below.
    }
  }

  if (env?.AI && typeof env.AI.run === 'function') {
    for (const model of CASCADE_MODELS) {
      if (await isCircuitOpen(env, model)) {
        continue;
      }
      try {
        const result = await env.AI.run(model, {
          messages: slicedMessages,
          max_tokens: 1200,
          temperature: 0.65,
          stream: true
        });
        if (result && typeof result.getReader === 'function') {
          return result.pipeThrough(createStreamingSanitizer());
        }
        if (typeof result?.response === 'string' && cleanOutput(result.response).trim()) {
          await recordCircuitSuccess(env, model);
          return wrapTextAsSseStream(result.response).pipeThrough(createStreamingSanitizer());
        }
        throw new Error('Model did not return usable text or a stream');
      } catch {
        await recordCircuitFailure(env, model);
      }
    }
  }

  return wrapTextAsSseStream('Modelová služba je momentálne nedostupná. Trinity nezískala odpoveď modelu.');
}
