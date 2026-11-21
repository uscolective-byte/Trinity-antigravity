import { BridgeAdapter, Env } from "../types";

export const githubAdapter: BridgeAdapter = {
  id: "github",
  name: "GitHub Developer Adapter",
  description: "Repository metadata, workflow dispatch, and GitHub Webhook handling",
  actions: ["get_repo", "list_workflows", "dispatch_workflow", "get_commit"],

  isConfigured(env: Env): boolean {
    return Boolean(env.GITHUB_TOKEN);
  },

  async execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown> {
    if (!env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");

    const repo = String(payload.repo || "uscolective-byte/Trinity-antigravity");
    const headers = {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "trinity-omni-bridge",
    };

    if (action === "get_repo") {
      const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      return await res.json();
    }

    if (action === "list_workflows") {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, { headers });
      return await res.json();
    }

    if (action === "dispatch_workflow") {
      const workflowId = String(payload.workflow_id || "deploy.yml");
      const ref = String(payload.ref || "main");
      const inputs = payload.inputs || {};

      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ ref, inputs }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub dispatch failed (${res.status}): ${text}`);
      }
      return { ok: true, dispatched: true, workflowId, ref };
    }

    if (action === "get_commit") {
      const sha = String(payload.sha || "HEAD");
      const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}`, { headers });
      return await res.json();
    }

    throw new Error(`Unsupported GitHub action: ${action}`);
  },

  async handleWebhook(req: Request): Promise<Response> {
    try {
      const event = req.headers.get("X-GitHub-Event") || "unknown";
      const payload = await req.json();
      return Response.json({ ok: true, event, processed: true });
    } catch (err) {
      return Response.json({ ok: false, error: (err as Error).message }, { status: 400 });
    }
  },
};
