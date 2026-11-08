export default {
  async scheduled(_event: ScheduledController, _env: unknown, _ctx: ExecutionContext): Promise<void> {},

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
      return Response.json({ ok: true, service: "trinity-dispatcher", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ ok: false, error: "POST required" }, { status: 405 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    // Podpora pre probe serviceStatus action: 'job.list'
    if (body.action === "job.list") {
      return Response.json({ ok: true, jobs: [], active: 0, service: "trinity-dispatcher" });
    }

    const { taskType = "default", priority = "NORMAL" } = body;
    const routingTable: Record<string, string> = {
      analysis: "aura_analyzer",
      architecture: "aura_architect",
      codegen: "aura_codegen",
      deploy: "aura_deployer",
      security: "aura_sentinel",
      testing: "aura_tester",
      default: "trinity-core"
    };
    const target = routingTable[taskType] || routingTable.default;
    return Response.json({ ok: true, worker: "trinity-dispatcher", taskId: crypto.randomUUID(), assignedTo: target, priority, queuedAt: Date.now() });
  }
};
