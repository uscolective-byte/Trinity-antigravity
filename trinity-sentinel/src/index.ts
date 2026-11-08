export interface Env {
  METRICS_KV?: KVNamespace;
}

export default {
  async scheduled(_event: ScheduledController, _env: unknown, _ctx: ExecutionContext): Promise<void> {},

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return Response.json({ ok: true, service: "trinity-sentinel", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ ok: false, error: "POST required" }, { status: 405 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    // Podpora pre probe serviceStatus action: 'monitor.health'
    if (body.action === "monitor.health") {
      return Response.json({ ok: true, status: "healthy", service: "trinity-sentinel", timestamp: Date.now() });
    }

    const { workerName = "generic", tokens = 0, isError = false } = body;
    const today = new Date().toISOString().slice(0, 10);
    const k = `metrics:${workerName}:${today}`;
    if (env.METRICS_KV) {
      await env.METRICS_KV.put(k, JSON.stringify({ tokens, isError, recordedAt: Date.now() }), { expirationTtl: 2592000 });
    }
    return Response.json({ ok: true, worker: "trinity-sentinel", status: "RECORDED", workerName, today });
  }
};
