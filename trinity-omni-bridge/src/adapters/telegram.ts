import { BridgeAdapter, Env } from "../types";

const TELEGRAM_MAX = 3900;

export async function sendTelegramChunked(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[Telegram] Missing token or chatId, skipping notification");
    return;
  }

  const chunks: string[] = [];
  let buffer = "";

  for (const line of text.split("\n")) {
    if (buffer.length + line.length + 1 > TELEGRAM_MAX) {
      if (buffer.trim()) chunks.push(buffer);
      buffer = "";
    }
    buffer += line + "\n";
  }
  if (buffer.trim()) chunks.push(buffer);

  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: "Markdown",
        }),
      });
      if (!res.ok) {
        // Fallback without markdown if markdown parsing fails
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
          }),
        });
      }
    } catch (err) {
      console.error("[Telegram] Send error:", err);
    }
  }
}

export const telegramAdapter: BridgeAdapter = {
  id: "telegram",
  name: "Telegram Bot Adapter",
  description: "Send alerts, tool execution results, and receive webhook commands",
  actions: ["send_message", "alert", "get_me"],

  isConfigured(env: Env): boolean {
    return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  },

  async execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown> {
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");

    if (action === "get_me") {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
      return await res.json();
    }

    if (action === "send_message" || action === "alert") {
      const text = String(payload.text || payload.message || "Trinity Omni-Bridge Ping");
      await sendTelegramChunked(env, text);
      return { sent: true, length: text.length };
    }

    throw new Error(`Unsupported Telegram action: ${action}`);
  },

  async handleWebhook(req: Request, env: Env): Promise<Response> {
    try {
      const body = (await req.json()) as any;
      const message = body?.message;
      if (!message) return Response.json({ ok: true, ignored: true });

      const chatId = String(message.chat?.id || "");
      const text = String(message.text || "").trim();

      if (text === "/id" || text === "/start") {
        const reply = `🤖 *Trinity Omni Bridge*\n\nTvoje Chat ID: \`${chatId}\`\nStav: Pripravený na MCP notifikácie a príkazy.`;
        if (env.TELEGRAM_BOT_TOKEN) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: reply,
              parse_mode: "Markdown",
            }),
          });
        }
      }

      return Response.json({ ok: true, received: true });
    } catch (err) {
      return Response.json({ ok: false, error: (err as Error).message }, { status: 400 });
    }
  },
};
