// Fail-closed verifier: a submitted claim is not evidence of its truth.
// Until a trusted evidence provider is integrated, no claim may be verified.
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "trinityguardiantruthverifierworker",
        status: "serving",
        verificationAvailable: false
      });
    }
    if (req.method !== "POST") {
      return Response.json({ error: "POST required" }, { status: 405 });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("claims" in body) ||
        !Array.isArray(body.claims) ||
        body.claims.length > 100 ||
        !body.claims.every((claim: unknown) => typeof claim === "string" && claim.length > 0 && claim.length <= 4096)) {
      return Response.json({ error: "claims must be an array of 1-100 nonempty strings (max 4096 chars each)" }, { status: 400 });
    }
    const claims: string[] = body.claims;
    const verifications = claims.map(claim => ({
      claim,
      verified: false,
      status: "unverified",
      reason: "No trusted evidence provider configured",
      policy: "ZERO_SIMULATION_STRICT"
    }));
    return Response.json({
      worker: "trinityguardiantruthverifierworker",
      allValid: false,
      totalVerified: 0,
      totalUnverified: claims.length,
      verificationAvailable: false,
      verifications
    }, { headers: { "Cache-Control": "no-store" } });
  }
};
