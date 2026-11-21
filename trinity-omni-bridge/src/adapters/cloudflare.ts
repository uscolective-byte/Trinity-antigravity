import { BridgeAdapter, Env } from "../types";

export const cloudflareAdapter: BridgeAdapter = {
  id: "cloudflare",
  name: "Cloudflare Edge & Developer Adapter",
  description: "Manage Workers, D1 Databases, and DNS records on Cloudflare edge",
  actions: ["list_workers", "query_d1", "verify_token", "list_zones"],

  isConfigured(env: Env): boolean {
    return Boolean(env.CLOUDFLARE_API_TOKEN);
  },

  async execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown> {
    if (!env.CLOUDFLARE_API_TOKEN) throw new Error("Missing CLOUDFLARE_API_TOKEN");

    const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "b60342e5e52f5646fbd4e913bb409334");
    const headers = {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    if (action === "verify_token") {
      const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers });
      return await res.json();
    }

    if (action === "list_workers") {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
        { headers }
      );
      const data = (await res.json()) as any;
      return data?.result ?? data;
    }

    if (action === "list_zones") {
      const res = await fetch("https://api.cloudflare.com/client/v4/zones", { headers });
      const data = (await res.json()) as any;
      return data?.result ?? data;
    }

    if (action === "query_d1") {
      const databaseId = String(payload.database_id || "ca8ea24e-f7db-431e-b8bf-97f713ae4533");
      const sql = String(payload.sql || "SELECT 1 as ping;");
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ sql }),
        }
      );
      return await res.json();
    }

    throw new Error(`Unsupported Cloudflare action: ${action}`);
  },
};
