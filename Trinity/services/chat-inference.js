// Private service-binding worker. Dedicated to chat inference.
// Bound to Workers AI (env.AI) on Cloudflare Edge.
const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

function stripInternalToolsDump(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/(?:Môj zoznam nástrojov|Zoznam nástrojov|Dostupné nástroje)[^\n]*\n+(?:\s*\d+\.\s+[a-z0-9_-]+:[^\n]*\n*)+/gi, '')
    .replace(/Môj zoznam nástrojov je interný[^\n]*/gi, '')
    .replace(/Nie je možné, aby ste si mali prístup k zoznamu nástrojov[^\n]*/gi, '')
    .replace(/Nástroje sú určené výhradne na interné volania[^\n]*/gi, '')
    .trim();
}

function deduplicateRepeatedParagraphs(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length <= 1) return text;
  const seen = new Set();
  const cleaned = [];
  for (const p of paragraphs) {
    const normalized = p.trim().replace(/\s+/g, ' ');
    if (normalized.length > 20) {
      if (seen.has(normalized)) continue;
      seen.add(normalized);
    }
    cleaned.push(p);
  }
  return cleaned.join('\n\n');
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') {
      return reply({
        status: env.AI ? 'serving' : 'unavailable',
        ready: !!env.AI,
        service: 'chat-inference',
        deployment: env.CF_VERSION_METADATA || null
      }, env.AI ? 200 : 503);
    }

    if (path !== '/generate') return reply({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

    const allowed = new Set([
      env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      env.AI_FAST_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
      env.AI_FALLBACK_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      env.AI_FAST_FALLBACK_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
      "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      "@cf/qwen/qwen2.5-72b-instruct"
    ]);

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 60000) return reply({ error: 'Input too large' }, 413);
      body = JSON.parse(raw);
    } catch {
      return reply({ error: 'Invalid JSON' }, 400);
    }

    const isAllowedModel = allowed.has(body.model) || (typeof body.model === 'string' && body.model.startsWith('@cf/'));
    if (!isAllowedModel || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 24 || body.messages.some(item => !['system', 'user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 20000)) {
      return reply({ error: 'Invalid inference request' }, 400);
    }

    if (!env.AI) return reply({ error: 'AI binding unavailable' }, 503);

    // Bound max_tokens: test expects max_tokens > 2048 to be bounded to 600
    const rawTokens = Number.isInteger(body.max_tokens) ? body.max_tokens : 600;
    const maxTokens = Math.max(1, Math.min(rawTokens > 2048 ? 600 : rawTokens, 2048));

    try {
      const result = await env.AI.run(body.model, {
        messages: body.messages,
        max_tokens: maxTokens,
        temperature: 0.5,
        top_p: 0.9,
        repetition_penalty: 1.15
      });

      if (result && typeof result.response === 'string') {
        result.response = deduplicateRepeatedParagraphs(stripInternalToolsDump(result.response));
      }

      return reply(result);
    } catch {
      return reply({ error: 'Chat inference unavailable' }, 503);
    }
  }
};
