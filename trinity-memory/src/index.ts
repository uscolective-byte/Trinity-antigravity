export interface Env {
  TRINITY_KV?: KVNamespace;
}

export default {
  async scheduled(_event: ScheduledController, _env: unknown, _ctx: ExecutionContext): Promise<void> {},

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return Response.json({ ok: true, service: "trinity-memory", version: "10.3.0", status: "serving" });
    }
    const key = url.pathname.slice(1);
    if (req.method === "POST") {
      const val = await req.text();
      if (env.TRINITY_KV) await env.TRINITY_KV.put(key, val);
      return Response.json({ ok: true, worker: "trinity-memory", status: "SAVED", key });
    }
    const result = (env.TRINITY_KV && key) ? await env.TRINITY_KV.get(key) : null;
    if (result === null) {
      // Vrátime 200 s ok: false, aby Cloudflare telemetria nepočítala bežný key-miss ako fatálnu chybu servera
      return Response.json({ ok: false, error: "Key not found", key }, { status: 200 });
    }
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }
};
