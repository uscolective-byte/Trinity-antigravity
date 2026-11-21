import { BridgeAdapter, Env } from "../types";

export const anthropicAdapter: BridgeAdapter = {
  id: "anthropic",
  name: "Anthropic Claude Adapter",
  description: "Claude 3.5 Sonnet / Haiku / Opus integration via Anthropic Messages API",
  actions: ["chat", "completion", "messages"],

  isConfigured(env: Env): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  },

  async execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown> {
    if (!env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const model = String(payload.model || "claude-3-5-sonnet-20241022");
    const maxTokens = Number(payload.max_tokens) || 1024;
    const prompt = String(payload.prompt || payload.text || "");
    const messages = Array.isArray(payload.messages)
      ? payload.messages
      : [{ role: "user", content: prompt }];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages,
        system: payload.system ? String(payload.system) : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Anthropic HTTP ${res.status}: ${err}`);
    }

    return await res.json();
  },
};
