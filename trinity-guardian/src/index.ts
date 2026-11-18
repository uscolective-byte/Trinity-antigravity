// Guardian status reports only facts observed by this Worker.
// Health of other services must be probed before claiming they are UP.
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method !== "GET" || url.pathname !== "/health") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({
      worker: "trinity-guardian",
      timestamp: Date.now(),
      status: "serving",
      integrityStatus: "UNVERIFIED",
      policy: "ZERO_SIMULATION_STRICT",
      subsystemsHealth: {
        core: "UNKNOWN",
        memory: "UNKNOWN",
        dispatcher: "UNKNOWN",
        sentinel: "UNKNOWN"
      },
      note: "Subsystem health and integrity require independent live checks."
    }, { headers: { "Cache-Control": "no-store" } });
  }
};
