import { BridgeAdapter, Env } from "../types";

export class TrinityMcpClient {
  constructor(private env: Env) {}

  private get url(): string {
    return (this.env.TRINITY_MCP_URL || "https://auru.dev/mcp").replace(/\/+$/, "");
  }

  private get headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.env.TRINITY_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "X-Trinity-Env": this.env.TRINITY_ENV || "dev",
      "X-Trinity-Client": "trinity-omni-bridge",
    };
  }

  async rpc(method: string, params: unknown): Promise<any> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Trinity MCP HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }

    const raw = await res.text();
    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      const dataLine = raw.split("\n").find(l => l.startsWith("data:"));
      if (dataLine) {
        data = JSON.parse(dataLine.replace(/^data:\s*/, ""));
      } else {
        const match = raw.match(/data:\s*(\{.*\})/s);
        if (match) {
          data = JSON.parse(match[1]);
        } else {
          throw new Error(`Invalid RPC response from Trinity: ${raw.slice(0, 200)}`);
        }
      }
    }

    if (data.error) {
      throw new Error(`Trinity RPC [${data.error.code}]: ${data.error.message}`);
    }

    return data.result;
  }

  async initialize(): Promise<any> {
    return this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "trinity-omni-bridge", version: "1.2.0" },
    });
  }

  async listTools(): Promise<any[]> {
    await this.initialize();
    const res = await this.rpc("tools/list", {});
    return Array.isArray(res?.tools) ? res.tools : [];
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    await this.initialize();
    return this.rpc("tools/call", { name, arguments: args });
  }
}

export const trinityMcpAdapter: BridgeAdapter = {
  id: "trinity-mcp",
  name: "Trinity MCP Core Adapter",
  description: "Direct connection to Trinity Omni-Core on auru.dev / auru.space",
  actions: ["tools", "call_tool", "executions", "fleet", "status", "diagnostic_ping"],

  isConfigured(env: Env): boolean {
    return Boolean(env.TRINITY_API_KEY);
  },

  async execute(action: string, payload: Record<string, unknown>, env: Env): Promise<unknown> {
    if (!env.TRINITY_API_KEY) throw new Error("Missing TRINITY_API_KEY");
    const client = new TrinityMcpClient(env);

    switch (action) {
      case "tools": {
        const tools = await client.listTools();
        return { count: tools.length, tools };
      }

      case "call_tool": {
        const toolName = String(payload.tool || payload.name || "");
        if (!toolName) throw new Error("Missing tool name in payload");
        const args = (payload.arguments ?? payload.args ?? {}) as Record<string, unknown>;
        return await client.callTool(toolName, args);
      }

      case "executions": {
        const limit = Number(payload.limit) || 10;
        return await client.callTool("list_tasks", { limit });
      }

      case "fleet": {
        return await client.callTool("list_agents", {});
      }

      case "status": {
        return await client.callTool("trinity_status", {});
      }

      case "diagnostic_ping": {
        const message = String(payload.message || "Omni-Bridge Diagnostic Ping");
        return await client.callTool("diagnostic_ping", { message });
      }

      default:
        throw new Error(`Unsupported action '${action}' on Trinity MCP adapter`);
    }
  },
};
