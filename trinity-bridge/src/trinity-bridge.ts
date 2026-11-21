export interface Env {
  TRINITY_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  TRINITY_ENV: string;
}

const MCP_URL = "https://auru.dev/mcp";
const TELEGRAM_MAX = 4096;
const CHUNK_SIZE = 25;

const HEADERS = (env: Env) => ({
  "Authorization": `Bearer ${env.TRINITY_API_KEY}`,
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
  "X-Trinity-Env": env.TRINITY_ENV ?? "dev",
});

async function rpc(env: Env, method: string, params: unknown) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: HEADERS(env),
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // Podpora pre SSE formát (event: message\ndata: {...})
    const dataLine = text.split("\n").find(line => line.startsWith("data:"));
    if (dataLine) {
      data = JSON.parse(dataLine.replace(/^data:\s*/, ""));
    } else {
      const match = text.match(/data:\s*(\{.*\})/s);
      if (match) {
        data = JSON.parse(match[1]);
      } else {
        throw new Error(`Neplatná RPC odpoveď: ${text.slice(0, 200)}`);
      }
    }
  }
  if (data.error) throw new Error(`RPC ${data.error.code}: ${data.error.message}`);
  return data.result;
}

// bezpečné poslanie: rozdelí na kusy po TELEGRAM_MAX
async function telegram(env: Env, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn("Telegram token or chat ID missing");
    return;
  }
  const parts: string[] = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if (buf.length + line.length + 1 > TELEGRAM_MAX - 50) {
      parts.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf.trim()) parts.push(buf);

  for (const p of parts) {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: p,
        parse_mode: "Markdown",
      }),
    });
    if (!r.ok) {
      console.error(`Telegram send failed: HTTP ${r.status}`);
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      await rpc(env, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mira-trinity-bridge", version: "1.0.0" },
      });

      if (url.pathname === "/tools") {
        const { tools } = await rpc(env, "tools/list", {});
        const toolList = Array.isArray(tools) ? tools : [];
        for (let i = 0; i < toolList.length; i += CHUNK_SIZE) {
          const chunk = toolList.slice(i, i + CHUNK_SIZE);
          const from = i + 1;
          const to = Math.min(i + CHUNK_SIZE, toolList.length);
          await telegram(
            env,
            `🔧 *Trinity MCP tools* (${from}–${to} / ${toolList.length})\n\n` +
              chunk
                .map(
                  (t: any) =>
                    `• \`${t.name}\` — ${(t.description ?? "").slice(0, 80)}`
                )
                .join("\n")
          );
        }
        return Response.json({ ok: true, count: toolList.length });
      }

      if (url.pathname === "/executions") {
        const agent = url.searchParams.get("agent");
        const res = await rpc(env, "tools/call", {
          name: "list_tasks",
          arguments: agent ? { agent_name: agent } : {},
        });
        await telegram(
          env,
          `📊 *Trinity Tasks & Executions*${agent ? ` — ${agent}` : ""}\n\n\`\`\`\n${JSON.stringify(res, null, 2).slice(0, 3500)}\n\`\`\``
        );
        return Response.json(res);
      }

      if (url.pathname === "/fleet") {
        const res = await rpc(env, "tools/call", {
          name: "list_agents",
          arguments: {},
        });
        await telegram(
          env,
          `🤖 *Trinity Fleet (46 Agents)*\n\n\`\`\`\n${JSON.stringify(res, null, 2).slice(0, 3500)}\n\`\`\``
        );
        return Response.json(res);
      }

      return new Response("Trinity Bridge Active. Endpoints: /tools, /executions, /fleet", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (e) {
      const msg = (e as Error).message;
      try {
        await telegram(
          env,
          `⚠️ Trinity MCP error:\n\`\`\`\n${msg.slice(0, 3000)}\n\`\`\``
        );
      } catch {}
      return Response.json({ ok: false, error: msg }, { status: 500 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          await rpc(env, "initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "mira-trinity-bridge", version: "1.0.0" },
          });

          const res = await rpc(env, "tools/call", {
            name: "list_tasks",
            arguments: { limit: 5 },
          });

          const executions = Array.isArray(res) ? res : res?.executions ?? [];
          if (!executions.length) return;

          const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
          const fresh = executions.filter((ex: any) => {
            const t = new Date(ex.created_at || ex.timestamp || 0).getTime();
            return t > fifteenMinutesAgo;
          });

          if (fresh.length > 0) {
            const report = fresh
              .map(
                (ex: any) =>
                  `• *${ex.agent || "Agent"}* [${ex.status || "OK"}]: \`${ex.task || ex.action || ex.id}\``
              )
              .join("\n");

            await telegram(
              env,
              `⏱ *Trinity cron update* (${fresh.length} nových úloh)\n\n${report}`
            );
          }
        } catch (err) {
          try {
            await telegram(
              env,
              `⚠️ Cron polling error: ${(err as Error).message}`
            );
          } catch {}
        }
      })()
    );
  },
};
