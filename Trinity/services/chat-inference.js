/**
 * ============================================================================
 * TRINITY AUTONOMOUS CORE - HIGH-PERFORMANCE INFERENCE WORKER
 * Stack: Cloudflare Workers AI | Zero-Auth | Multi-Tier Circuit Fallback | SSE
 * ============================================================================
 */

// Konfigurácia modelovej matice
const MODEL_TIERS = {
  PRIMARY: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  SECONDARY: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  RAPID_FALLBACK: "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
};

// Striktné timeouty pre jednotlivé vrstvy (v ms)
const TIMEOUTS = {
  PRIMARY: 11000,
  SECONDARY: 9000,
  RAPID: 6000
};

const HEADERS_JSON = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff"
};

function replyJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS_JSON });
}

/**
 * Inteligentný orezávač kontextu (Context Slicer)
 * Zachováva systémový prompt (index 0) a najnovšie správy.
 * Staré správy zo stredu bezpečne vyradí, ak kontext prekročí limit.
 */
function sliceContextSafely(messages, maxTotalChars = 40000) {
  if (!Array.isArray(messages) || messages.length <= 4) return messages;

  let totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  if (totalChars <= maxTotalChars) return messages;

  const systemMessage = messages.find(m => m.role === "system");
  const conversation = messages.filter(m => m.role !== "system");

  // Ponecháme posledných 6 správ a systémový prompt
  const preservedTail = conversation.slice(-6);
  const result = systemMessage ? [systemMessage, ...preservedTail] : preservedTail;

  console.warn(`[Trinity Slicer] Kontext skrátený z ${messages.length} na ${result.length} správ kvôli dĺžke.`);
  return result;
}

/**
 * Agresívny sanitizér výstupu (odstraňuje úniky systémových promptov a zoznamov nástrojov)
 */
function cleanOutput(text) {
  if (typeof text !== "string" || !text.trim()) return "";

  let cleaned = text
    .replace(/(?:Môj zoznam nástrojov|Zoznam nástrojov|Dostupné nástroje)[^\n]*\n+(?:\s*\d+\.\s+[a-z0-9_-]+:[^\n]*\n*)+/gi, "")
    .replace(/Môj zoznam nástrojov je interný[^\n]*/gi, "")
    .replace(/Nie je možné, aby ste si mali prístup k zoznamu nástrojov[^\n]*/gi, "")
    .replace(/Nástroje sú určené výhradne na interné volania[^\n]*/gi, "")
    .trim();

  if (/152\s+expertných\s+zručností|248\s+Copilot\s+skillov/i.test(cleaned)) {
    cleaned = cleaned.replace(/Sabo Ivan, rád sa ti oznam[^\n]*\n*/gi, "")
      .replace(/Mám 152 expertných zručností[^\n]*\n*/gi, "")
      .replace(/Som založená na Cloudflare Edge a mám 29 servisných workerov[^\n]*\n*/gi, "")
      .replace(/Môj primárny AI provider je Cloudflare Workers AI[^\n]*\n*/gi, "")
      .replace(/Môj účel je slúžiť vám, Sabo Ivanovi[^\n]*\n*/gi, "")
      .replace(/Môj jazyk je prirodzený a komunikujem s vámi[^\n]*\n*/gi, "");
  }

  // Deduplikácia halucinačných slučiek
  const parts = cleaned.split(/\n{2,}/);
  if (parts.length <= 1) return cleaned;

  const seen = new Set();
  const deduped = [];
  for (const block of parts) {
    const norm = block.trim().replace(/\s+/g, " ");
    if (norm.length > 25) {
      if (seen.has(norm)) continue;
      seen.add(norm);
    }
    deduped.push(block);
  }
  return deduped.join("\n\n");
}

/**
 * Realtime token filter pre SSE streamy (odchytáva systémové halucinácie za chodu)
 */
function createStreamingSanitizer() {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buffer = "";

  return new TransformStream({
    transform(chunk, controller) {
      buffer += dec.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          controller.enqueue(enc.encode(line + "\n"));
          continue;
        }

        const raw = line.slice(6).trim();
        if (raw === "[DONE]") {
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          continue;
        }

        try {
          const parsed = JSON.parse(raw);
          if (parsed.response && /Môj zoznam nástrojov|Dostupné nástroje/i.test(parsed.response)) {
            // Zahodí infikovaný chunk
            continue;
          }
          controller.enqueue(enc.encode(`data: ${JSON.stringify(parsed)}\n\n`));
        } catch {
          controller.enqueue(enc.encode(line + "\n\n"));
        }
      }
    },
    flush(controller) {
      if (buffer.trim()) controller.enqueue(enc.encode(buffer));
    }
  });
}

/**
 * Nekompromisný exekútor inferencie s poistkou proti zamrznutiu
 */
async function executeInference(ai, model, payload, timeoutMs) {
  let timer;
  const timeoutGuard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`GATEWAY_TIMEOUT: Model ${model} prekročil limit ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const execution = ai.run(model, payload);
    return await Promise.race([execution, timeoutGuard]);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Diagnostika / Health
    if (url.pathname === "/health" && request.method === "GET") {
      const active = !!env.AI;
      return replyJson({
        status: active ? "HYPER_ACTIVE" : "OFFLINE",
        service: "trinity-matrix-inference",
        engine_ready: active,
        primary_target: env.AI_MODEL || MODEL_TIERS.PRIMARY,
        fallback_target: env.AI_FALLBACK_MODEL || MODEL_TIERS.RAPID_FALLBACK,
        timestamp: Date.now()
      }, active ? 200 : 503);
    }

    if (url.pathname !== "/generate") {
      return replyJson({ error: "Endpoint not found. Target /generate" }, 404);
    }

    if (request.method !== "POST") {
      return replyJson({ error: "Method not allowed. Send POST." }, 405);
    }

    if (!env.AI) {
      return replyJson({ error: "Cloudflare AI binding (env.AI) nie je pripojený." }, 503);
    }

    // 2. Extrakcia dát a validácia
    let rawText;
    try {
      rawText = await request.text();
      if (rawText.length > 60000) {
        return replyJson({ error: "Input too large" }, 413);
      }
    } catch {
      return replyJson({ error: "Input read error" }, 400);
    }

    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return replyJson({ error: "Malformed payload. Vyžaduje sa čistý JSON." }, 400);
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return replyJson({ error: "'messages' pole nesmie byť prázdne." }, 400);
    }

    // Overenie správ a rolí
    const validRoles = new Set(["system", "user", "assistant"]);
    if (body.messages.some(item => !item || !validRoles.has(item.role) || typeof item.content !== "string" || item.content.length > 20000)) {
      return replyJson({ error: "Neplatné správy v požiadavke." }, 400);
    }

    // Validácia cieľového modelu
    if (body.model && typeof body.model === "string") {
      const isKnownModel = body.model.startsWith("@cf/") || Object.values(MODEL_TIERS).includes(body.model);
      if (!isKnownModel) {
        return replyJson({ error: "Neplatný model." }, 400);
      }
    }

    const isStreaming = Boolean(body.stream);
    const sanitizedMessages = sliceContextSafely(body.messages);

    const tokenCount = Number.isInteger(body.max_tokens) ? body.max_tokens : 1200;
    const maxTokens = Math.max(16, Math.min(tokenCount > 2048 ? 600 : tokenCount, 4096));

    const payload = {
      messages: sanitizedMessages,
      max_tokens: maxTokens,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.45,
      top_p: 0.9,
      repetition_penalty: 1.15,
      stream: isStreaming
    };

    // Modelový reťazec (Fallback Pipeline)
    const pipeline = [
      body.model || env.AI_MODEL || MODEL_TIERS.PRIMARY,
      MODEL_TIERS.SECONDARY,
      env.AI_FALLBACK_MODEL || MODEL_TIERS.RAPID_FALLBACK
    ];

    // Odstránenie duplicít v reťazci
    const executionQueue = [...new Set(pipeline)];

    const startTime = Date.now();

    // ==========================================================
    // REŽIM: SSE STREAM
    // ==========================================================
    if (isStreaming) {
      let activeStream = null;
      let winningModel = null;
      let attempts = [];

      for (const model of executionQueue) {
        const timeout = model.includes("70b") ? TIMEOUTS.PRIMARY : (model.includes("32b") ? TIMEOUTS.SECONDARY : TIMEOUTS.RAPID);
        try {
          activeStream = await executeInference(env.AI, model, payload, timeout);
          winningModel = model;
          break;
        } catch (err) {
          console.warn(`[Trinity Pipeline] Zlyhanie streamu na modeli ${model}:`, err.message);
          attempts.push({ model, error: "Model timeout or unavailable" });
        }
      }

      if (!activeStream) {
        return replyJson({
          error: "Celá modelová matica zlyhala.",
          pipeline_attempts: attempts
        }, 503);
      }

      const streamPipe = activeStream.pipeThrough(createStreamingSanitizer());

      return new Response(streamPipe, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Trinity-Model": winningModel,
          "X-Trinity-Latency": `${Date.now() - startTime}ms`
        }
      });
    }

    // ==========================================================
    // REŽIM: DIRECT BATCH JSON
    // ==========================================================
    let result = null;
    let winningModel = null;
    let errors = [];

    for (const model of executionQueue) {
      const timeout = model.includes("70b") ? TIMEOUTS.PRIMARY : (model.includes("32b") ? TIMEOUTS.SECONDARY : TIMEOUTS.RAPID);
      try {
        result = await executeInference(env.AI, model, payload, timeout);
        winningModel = model;
        break;
      } catch (err) {
        console.warn(`[Trinity Pipeline] Zlyhanie batchu na modeli ${model}:`, err.message);
        errors.push({ model, error: "Model unavailable or timed out" });
      }
    }

    if (!result) {
      return replyJson({
        error: "Všetky modely v matici Trinity zlyhali.",
        trace: errors,
        total_time_ms: Date.now() - startTime
      }, 503);
    }

    return replyJson({
      success: true,
      response: cleanOutput(result?.response || ""),
      model_used: winningModel,
      latency_ms: Date.now() - startTime,
      fallback_engaged: winningModel !== executionQueue[0]
    });
  }
};
