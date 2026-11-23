/**
 * @module TRINITY_INFERENCE_CASCADE
 * @description 3-stage AI inference cascade with pinned Ring 0 system prompt,
 * stateful Circuit Breaker, and SSE Leak Filter.
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
  'You are Trinity — a sharp, perceptive, and natural personal AI assistant for the owner Ivan Sabo (Basterix, saboivan2008@gmail.com) on version 12.0. Respond attentively to mood and conversational context without stiff support phrases, and always adhere strictly to verified truth. Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal \'tykanie\' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.';

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

  // If AI_INFERENCE_SERVICE / CHAT_INFERENCE_SERVICE is bound and env.AI is not directly available
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
