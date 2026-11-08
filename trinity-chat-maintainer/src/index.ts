import { WorkerEntrypoint } from "cloudflare:workers";

export default class ChatMaintainerService extends WorkerEntrypoint {
  async getStatus() {
    return { ok: true, ready: true, status: "serving", service: "trinity-chat-maintainer", version: "10.3.0" };
  }

  async scheduled(_event: ScheduledController, _env: unknown, _ctx: ExecutionContext): Promise<void> {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return Response.json({ ok: true, service: "trinity-chat-maintainer", version: "10.3.0", status: "serving" });
    }
    let streamId = "unknown";
    let lastActivityMs = Date.now();
    try {
      const b = await req.json() as any;
      if (b.streamId) streamId = b.streamId;
      if (b.lastActivityMs) lastActivityMs = b.lastActivityMs;
    } catch {}
    const ignored = Date.now() - lastActivityMs > 15000;
    return Response.json({ ok: true, worker: "trinity-chat-maintainer", streamId, status: ignored ? "STUCK_SESSION" : "ACTIVE", recommendedAction: ignored ? "RESET_SESSION" : "NONE" });
  }
}
