export interface Env {
  AI?: any;
  TRINITY_SENTINEL?: Fetcher;
}

export function sliceContextSafely(messages: any[], maxTotalChars = 40000, maxMessages = 8) {
  if (!Array.isArray(messages)) return [];
  const safeMsgs = messages.filter((m: any) => m && typeof m === "object");
  if (safeMsgs.length === 0) return [];
  const systemMessage = safeMsgs.find((message: any) => message.role === "system");
  const conversation = safeMsgs.filter((message: any) => message.role !== "system");
  const selected: any[] = [];
  let usedChars = typeof systemMessage?.content === "string" ? systemMessage.content.length : 0;
  const availableChars = Math.max(0, maxTotalChars - usedChars);
  const tailLimit = Math.max(0, maxMessages - (systemMessage ? 1 : 0));
  for (const message of conversation.slice(-tailLimit).reverse()) {
    const size = typeof message.content === "string" ? message.content.length : 0;
    if (usedChars + size > maxTotalChars || size > availableChars) continue;
    selected.unshift(message);
    usedChars += size;
  }
  if (systemMessage) {
    // Keep the original system instruction first, even when history must be reduced.
    return [systemMessage, ...selected].slice(0, maxMessages);
  }
  return selected.slice(-maxMessages);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-chat-inference", version: "10.3.0", status: "serving" });
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let payload: any;
    try { payload = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const rawMsgs = Array.isArray(payload?.messages) ? payload.messages : [];
    const msgs = sliceContextSafely(rawMsgs, 40000, 8);
    const models = [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
    ];
    for (const model of models) {
      try {
        if (env.AI) {
          const stream = await env.AI.run(model, { messages: msgs, stream: true });
          return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Model-Used": model } });
        }
      } catch (err) { continue; }
    }
    return Response.json({ worker: "trinity-chat-inference", status: "FALLBACK_READY", slicedCount: msgs.length, models });
  }
};
