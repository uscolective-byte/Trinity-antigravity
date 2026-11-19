/**
 * Cloudflare-side PC Bridge placeholder. Do not claim a local executor exists.
 * Real execution requires authenticated pairing, authorization and a live
 * machine-side service with independently checked receipts.
 */
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const headers = { "Cache-Control": "no-store" };
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "trinity-pc-bridge-v2",
        version: "10.3.0",
        status: "serving",
        bridgeStatus: "NOT_CONNECTED",
        workerServing: true,
        localExecutorConnected: false,
        executionAvailable: false
      }, { headers });
    }
    return Response.json({
      ok: false,
      error: "PC_BRIDGE_NOT_CONNECTED",
      executed: false,
      message: "No authenticated and verified local PC executor is attached."
    }, { status: 503, headers });
  }
};
