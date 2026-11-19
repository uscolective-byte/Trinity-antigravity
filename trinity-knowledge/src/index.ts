/**
 * Trinity Knowledge: real Vectorize retrieval, never synthetic results.
 * Internal use only; require a secret for queries because vector metadata
 * can contain private information.
 */
export interface Env {
  AI?: { run: (model: string, input: { text: string[] }) => Promise<{ data?: number[][] }> };
  VECTORIZE?: { query: (vector: number[], options: { topK: number; returnMetadata: string }) => Promise<{ matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> }> };
  TRINITY_KNOWLEDGE_KEY?: string;
}
async function keyMatches(received: string | null, expected: string): Promise<boolean> {
  if (!received || !expected || received.length > 2048 || expected.length < 24) return false;
  const enc = new TextEncoder();
  const hashes = await Promise.all([received, expected].map(value => crypto.subtle.digest("SHA-256", enc.encode(value))));
  const a = new Uint8Array(hashes[0]);
  const b = new Uint8Array(hashes[1]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const headers = { "Cache-Control": "no-store" };
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "trinity-knowledge",
        version: "10.3.0",
        status: "serving",
        workerServing: true,
        vectorizeConfigured: Boolean(env.VECTORIZE),
        embeddingModelConfigured: Boolean(env.AI)
      }, { headers });
    }
    if (url.pathname !== "/search") return Response.json({ error: "NOT_FOUND" }, { status: 404, headers });
    if (req.method !== "POST") return Response.json({ error: "POST_REQUIRED" }, { status: 405, headers });
    if (!env.TRINITY_KNOWLEDGE_KEY || !await keyMatches(req.headers.get("X-Trinity-Knowledge-Key"), env.TRINITY_KNOWLEDGE_KEY)) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    }
    if (!env.AI || !env.VECTORIZE) {
      return Response.json({ error: "KNOWLEDGE_BACKEND_NOT_CONFIGURED", completed: false }, { status: 503, headers });
    }
    let query: string;
    try {
      const raw = await req.text();
      if (raw.length > 4500) throw new Error("too large");
      const input: unknown = JSON.parse(raw);
      if (!input || typeof input !== "object" || !("query" in input) || typeof input.query !== "string") throw new Error("invalid");
      query = input.query.trim();
      if (!query || query.length > 3000) throw new Error("invalid query");
    } catch {
      return Response.json({ error: "INVALID_QUERY", completed: false }, { status: 400, headers });
    }
    try {
      const embedding = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [query] });
      const vector = embedding?.data?.[0];
      if (!Array.isArray(vector) || vector.length === 0 || !vector.every(v => Number.isFinite(v))) {
        throw new Error("INVALID_EMBEDDING");
      }
      const found = await env.VECTORIZE.query(vector, { topK: 5, returnMetadata: "all" });
      if (!Array.isArray(found?.matches)) throw new Error("VECTORIZE_RESULT_UNAVAILABLE");
      return Response.json({
        worker: "trinity-knowledge",
        status: "SEARCH_COMPLETED",
        completed: true,
        vectorsMatched: found.matches.map(item => ({ id: item.id, score: item.score ?? null, metadata: item.metadata ?? null }))
      }, { headers });
    } catch {
      return Response.json({ error: "KNOWLEDGE_SEARCH_FAILED", completed: false }, { status: 502, headers });
    }
  }
};
