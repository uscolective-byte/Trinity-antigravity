export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-ops", version: "10.3.0", status: "serving" });
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
    if (url.pathname.startsWith("/mcp")) {
      return Response.json({
        protocol: "mcp-2024-11-05",
        status: "ONLINE",
        resources: ["aura-architecture", "trinity-metrics"],
        tools: ["analyze-code", "sql-migrate"]
      });
    }
    return Response.json({ worker: "trinity-ops", opsStatus: "HEALTHY", endpoints: ["/api/ops", "/mcp"] });
  }
};
