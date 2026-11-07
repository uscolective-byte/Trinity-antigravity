export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-staging", version: "10.3.0", status: "serving" });
    }
    return Response.json({
      environment: "STAGING",
      worker: "trinity-staging",
      url: req.url,
      timestamp: Date.now(),
      debug: { headers: Object.fromEntries(req.headers.entries()) }
    });
  }
};
