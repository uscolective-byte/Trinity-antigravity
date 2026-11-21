import { BridgeAdapter, Env } from "../types";

export const googleGeminiAdapter: BridgeAdapter = {
  id: "google",
  name: "Google Gemini AI Adapter",
  description: "Gemini 2.5 Flash / 1.5 Pro inference via Google Generative Language API",
  actions: ["generate_content", "chat", "embed"],

  isConfigured(env: Env): boolean {
    return Boolean(env.GOOGLE_API_KEY);
  },

  async execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown> {
    if (!env.GOOGLE_API_KEY) throw new Error("Missing GOOGLE_API_KEY");

    const model = String(payload.model || "gemini-2.5-flash");
    const prompt = String(payload.prompt || payload.text || "");
    const contents = Array.isArray(payload.contents)
      ? payload.contents
      : [{ role: "user", parts: [{ text: prompt }] }];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: payload.system
          ? { parts: [{ text: String(payload.system) }] }
          : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Google Gemini HTTP ${res.status}: ${err}`);
    }

    return await res.json();
  },
};
