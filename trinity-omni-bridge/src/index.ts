import { Env, InvokeRequest, InvokeResponse } from "./types";
import { AdapterRegistry } from "./registry";
import { trinityMcpAdapter } from "./adapters/trinity-mcp";
import { telegramAdapter, sendTelegramChunked } from "./adapters/telegram";
import { anthropicAdapter } from "./adapters/anthropic";
import { googleGeminiAdapter } from "./adapters/google-gemini";
import { githubAdapter } from "./adapters/github";
import { cloudflareAdapter } from "./adapters/cloudflare";
import { antigravityAdapter, copilotAdapter, metaAiAdapter } from "./adapters/webhook-connectors";

function createRegistry(): AdapterRegistry {
  return new AdapterRegistry()
    .register(trinityMcpAdapter)
    .register(telegramAdapter)
    .register(anthropicAdapter)
    .register(googleGeminiAdapter)
    .register(githubAdapter)
    .register(cloudflareAdapter)
    .register(antigravityAdapter)
    .register(copilotAdapter)
    .register(metaAiAdapter);
}

function isAuthorized(req: Request, env: Env): boolean {
  if (!env.BRIDGE_AUTH_TOKEN) return true;
  const auth = req.headers.get("Authorization") ?? "";
  const custom = req.headers.get("X-Bridge-Token") ?? "";
  return auth === `Bearer ${env.BRIDGE_AUTH_TOKEN}` || custom === env.BRIDGE_AUTH_TOKEN;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const registry = createRegistry();

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Token, X-Trinity-Env",
        },
      });
    }

    // 1. Health check
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "trinity-omni-bridge",
        version: "1.2.0",
        environment: env.TRINITY_ENV || "dev",
        mcpUrl: env.TRINITY_MCP_URL || "https://auru.dev/mcp",
        telegramConnected: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        registeredProviders: registry.list(env).map(p => p.id),
      });
    }

    // Auth gate for non-webhook routes
    if (!url.pathname.startsWith("/webhooks/") && !isAuthorized(req, env)) {
      return Response.json({ ok: false, error: "Unauthorized: Invalid or missing BRIDGE_AUTH_TOKEN" }, { status: 401 });
    }

    // 2. List Providers
    if (url.pathname === "/providers" && req.method === "GET") {
      return Response.json({
        ok: true,
        count: registry.list(env).length,
        providers: registry.list(env),
      });
    }

    // 3. Shortcuts: /tools, /fleet, /executions (forwarded to Trinity MCP)
    if (url.pathname === "/tools" && req.method === "GET") {
      try {
        const res = (await trinityMcpAdapter.execute("tools", {}, env)) as any;
        if (url.searchParams.get("notify") === "1") {
          const list = res.tools || [];
          await sendTelegramChunked(
            env,
            `🔧 *Trinity MCP Tools* (${list.length})\n\n` +
              list.map((t: any) => `• \`${t.name}\` — ${(t.description ?? "").slice(0, 80)}`).join("\n")
          );
        }
        return Response.json({ ok: true, count: res.count, tools: res.tools });
      } catch (err) {
        return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
      }
    }

    if (url.pathname === "/fleet" && req.method === "GET") {
      try {
        const res = await trinityMcpAdapter.execute("fleet", {}, env);
        return Response.json({ ok: true, fleet: res });
      } catch (err) {
        return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
      }
    }

    if (url.pathname === "/executions" && req.method === "GET") {
      try {
        const limit = Number(url.searchParams.get("limit")) || 10;
        const res = await trinityMcpAdapter.execute("executions", { limit }, env);
        return Response.json({ ok: true, executions: res });
      } catch (err) {
        return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
      }
    }

    // 4. Universal Unified Invocation: POST /invoke
    if (url.pathname === "/invoke" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => null)) as InvokeRequest | null;
        if (!body || !body.provider || !body.action) {
          return Response.json(
            { ok: false, error: "Missing required fields: 'provider' and 'action'" },
            { status: 400 }
          );
        }

        const adapter = registry.get(body.provider);
        if (!adapter) {
          return Response.json(
            { ok: false, error: `Provider '${body.provider}' not recognized` },
            { status: 404 }
          );
        }

        const result = await adapter.execute(body.action, body.payload ?? {}, env);

        if (body.notifyTelegram) {
          const summary = `⚡ *Omni-Bridge Executed*\n• *Provider:* \`${body.provider}\`\n• *Action:* \`${body.action}\`\n\n\`\`\`\n${JSON.stringify(result, null, 2).slice(0, 3000)}\n\`\`\``;
          await sendTelegramChunked(env, summary);
        }

        const response: InvokeResponse = {
          ok: true,
          provider: body.provider,
          action: body.action,
          result,
          timestamp: new Date().toISOString(),
        };
        return Response.json(response);
      } catch (err) {
        const errorMsg = (err as Error).message;
        try {
          await sendTelegramChunked(env, `⚠️ *Omni-Bridge Execution Error:*\n\`\`\`\n${errorMsg.slice(0, 1500)}\n\`\`\``);
        } catch {}
        return Response.json(
          { ok: false, error: errorMsg, timestamp: new Date().toISOString() },
          { status: 500 }
        );
      }
    }

    // 5. External Webhook receiver: POST /webhooks/:provider
    if (url.pathname.startsWith("/webhooks/") && req.method === "POST") {
      const providerId = url.pathname.replace("/webhooks/", "").toLowerCase();
      const adapter = registry.get(providerId);
      if (!adapter || !adapter.handleWebhook) {
        return Response.json({ ok: false, error: `No webhook handler for provider '${providerId}'` }, { status: 404 });
      }
      return await adapter.handleWebhook(req, env);
    }

    return new Response("Trinity Omni-Bridge Active. Endpoints: /health, /providers, /invoke, /tools, /fleet, /executions", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },

  // 6. Scheduled 15-minute polling cron for Trinity executions
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          if (!env.TRINITY_API_KEY) return;
          const res = (await trinityMcpAdapter.execute("executions", { limit: 5 }, env)) as any;
          const rawText = res?.content?.[0]?.text;
          const executions = rawText ? JSON.parse(rawText) : Array.isArray(res) ? res : [];
          if (!executions.length) return;

          const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
          const fresh = executions.filter((ex: any) => {
            const t = new Date(ex.created_at || ex.timestamp || 0).getTime();
            return t > fifteenMinutesAgo;
          });

          if (fresh.length > 0) {
            const report = fresh
              .map((ex: any) => `• *${ex.intent || "Task"}* [${ex.status || "OK"}]: \`${ex.task || ex.id}\``)
              .join("\n");
            await sendTelegramChunked(env, `⏱ *Trinity Live Update* (${fresh.length} nových úloh)\n\n${report}`);
          }
        } catch (err) {
          console.error("[Cron Polling Error]", err);
        }
      })()
    );
  },
};
