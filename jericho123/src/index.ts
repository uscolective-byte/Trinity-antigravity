export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "jericho123", version: "10.3.0", status: "serving" });
    }
    const treasury = {
      asset: "TTK",
      status: "ACTIVE_MONITORING",
      reserveType: "SMART_CONTRACT_AUDITED",
      lastSync: Date.now()
    };
    return Response.json({ worker: "jericho123", treasury });
  }
};
