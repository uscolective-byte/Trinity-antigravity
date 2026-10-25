import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";

const execAsync = promisify(exec);

// Konfigurácia TRINITY Sandboxu
const DEFAULT_WORKSPACE = path.resolve("C:/Users/saboi/Trinity-antigravity");
const WORKSPACE_DIR = process.env.TRINITY_WORKSPACE ? path.resolve(process.env.TRINITY_WORKSPACE) : DEFAULT_WORKSPACE;
const BRIDGE_PORT = parseInt(process.env.TRINITY_PORT || "3333", 10);
const BRIDGE_TOKEN = process.env.TRINITY_TOKEN || "trinity-local-secret";

// Constitutional Security Audit - zakázané deštruktívne vzory príkazov
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\/($|\s)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
  /format\s+[a-z]:/i,
  /del\s+\/s\s+\/q\s+c:\\/i,
  /Remove-Item\s+-Recurse\s+-Force\s+C:\\/i
];

function auditCommand(cmd) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      throw new Error(`SECURITY AUDIT REJECTED: Príkaz porušuje bezpečnostné pravidlá TRINITY (${cmd})`);
    }
  }
}

async function runSafeCommand(command, subdir = ".", timeoutMs = 120000) {
  auditCommand(command);
  const resolvedCwd = path.resolve(WORKSPACE_DIR, subdir);
  const normalizedRoot = path.resolve(WORKSPACE_DIR);
  
  if (!resolvedCwd.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
    throw new Error(`SANDBOX VIOLATION: Pokus o únik mimo TRINITY_WORKSPACE (${resolvedCwd})`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: resolvedCwd,
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, CI: "true" }
    });
    return {
      exitCode: 0,
      stdout: stdout ? stdout.trim() : "",
      stderr: stderr ? stderr.trim() : ""
    };
  } catch (error) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout ? error.stdout.trim() : "",
      stderr: error.stderr ? error.stderr.trim() : (error.message || String(error))
    };
  }
}

// 1. Inicializácia MCP Servera
const mcpServer = new McpServer({
  name: "trinity-tool-manager",
  version: "1.0.0"
});

// Nástroj 1: Cloudflare Wrangler
mcpServer.tool(
  "trinity_wrangler",
  "Spúšťa Cloudflare Wrangler CLI príkazy (deploy, d1, kv, whoami, tail) v TRINITY workspace.",
  {
    args: z.string().describe("Argumenty pre wrangler, napr. 'd1 list' alebo 'deploy --dry-run'"),
    projectSubdir: z.string().optional().describe("Voliteľný podpriečinok projektu, predvolene 'Trinity'")
  },
  async ({ args, projectSubdir }) => {
    const cleanArgs = args.replace(/^wrangler\s+/i, "");
    const cmd = `npx --yes wrangler ${cleanArgs}`;
    const targetDir = projectSubdir || (fs.existsSync(path.join(WORKSPACE_DIR, "Trinity")) ? "Trinity" : ".");
    const result = await runSafeCommand(cmd, targetDir);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Nástroj 2: Terminál / CMD v Sandboxe
mcpServer.tool(
  "trinity_cmd",
  "Vykoná systémový príkaz (cmd/powershell/npm/git) v izolovanom TRINITY workspace.",
  {
    command: z.string().describe("Príkaz na vykonanie"),
    subdir: z.string().optional().describe("Podpriečinok v rámci TRINITY_WORKSPACE")
  },
  async ({ command, subdir }) => {
    const result = await runSafeCommand(command, subdir || ".");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Nástroj 3: Status mosta
mcpServer.tool(
  "trinity_bridge_status",
  "Zobrazí stav TRINITY mosta a prostredia.",
  {},
  async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "ready",
          workspace: WORKSPACE_DIR,
          port: BRIDGE_PORT,
          node_version: process.version,
          platform: process.platform
        }, null, 2)
      }]
    };
  }
);

// 2. HTTP Bridge pre Webový Chat (gemini.google.com / chatgpt.com -> localhost:3333)
const app = express();
app.use(cors({
  origin: "*"
}));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "trinity-mcp-bridge",
    workspace: WORKSPACE_DIR,
    timestamp: new Date().toISOString()
  });
});

app.post("/exec", async (req, res) => {
  const token = req.headers["x-trinity-token"];
  if (token !== BRIDGE_TOKEN) {
    return res.status(401).json({ error: "Neplatný TRINITY token" });
  }

  const { tool, command, args, subdir } = req.body;
  try {
    let finalCmd = command;
    let targetSubdir = subdir || ".";

    if (tool === "wrangler") {
      const cleanArgs = (args || command || "").replace(/^wrangler\s+/i, "");
      finalCmd = `npx --yes wrangler ${cleanArgs}`;
      if (!subdir && fs.existsSync(path.join(WORKSPACE_DIR, "Trinity"))) {
        targetSubdir = "Trinity";
      }
    }

    if (!finalCmd) {
      return res.status(400).json({ status: "error", message: "Chýba príkaz na vykonanie" });
    }

    const result = await runSafeCommand(finalCmd, targetSubdir);
    res.json({ status: "ok", tool: tool || "cmd", result });
  } catch (err) {
    res.status(400).json({ status: "error", message: err.message });
  }
});

// Spustenie HTTP daemonu
app.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.error(`[TRINITY Bridge] HTTP brána beží na http://127.0.0.1:${BRIDGE_PORT}`);
  console.error(`[TRINITY Bridge] Workspace: ${WORKSPACE_DIR}`);
});

// Stdio transport ak je spustený cez MCP klienta
if (process.env.MCP_STDIO === "true" || !process.stdout.isTTY) {
  try {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("[TRINITY Bridge] MCP Stdio transport pripojený.");
  } catch (err) {
    console.error("[TRINITY Bridge] Stdio transport error:", err.message);
  }
}
