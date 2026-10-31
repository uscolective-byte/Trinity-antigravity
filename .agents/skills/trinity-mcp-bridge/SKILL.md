---
name: trinity-mcp-bridge
description: >-
  Interact with the live Trinity MCP Bridge (https://auru.space/mcp) for readiness checks, capability status, service-binding health, memory search, task dispatch, and bounded PC bridge operations. Use when calling or troubleshooting Trinity MCP tools.
---

# Trinity Secure MCP Bridge

The `trinity` MCP server connects Antigravity and Codex to `https://auru.space/mcp` using a Windows DPAPI-encrypted credential (`C:\Users\saboi\Trinity-antigravity\Trinity\.credentials\gemini-mcp.dpapi`).

## Available MCP Tools

- `trinity_status`: Read verified Trinity readiness and active plugin count.
- `get_capability_status`: Read capability configuration, connectivity, and execution evidence without secrets.
- `check_services`: Check live reachability of bound Cloudflare Worker services.
- `list_agents`: List all 45 Trinity specialist roles.
- `search_memory`: Search shared Trinity D1 memory (`ops_memory`).
- `dispatch_task` / `get_task`: Queue a bounded workflow job in Trinity and poll its verified receipt.
- `pc_status` / `list_system_actions` / `request_project_action` / `get_project_action`: Inspect or propose bounded PC Bridge actions.

## Verifying the MCP Bridge Locally

Run the non-printing verification script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\saboi\Trinity-antigravity\Trinity\scripts\test-gemini-mcp.ps1"
```

## Unified AI client connections (31 Oct 2026)

Use the canonical guide: [UNIFIED_AGENT_CONNECTIONS.md](../../../Trinity/docs/UNIFIED_AGENT_CONNECTIONS.md).
Before any tool or cross-agent request, call **`agent_connections`** through the
authenticated Trinity MCP bridge. It is read-only, does not read secrets,
and separates `server_configured`, `heartbeat_connected`,
`client_authenticated` and `execution_verified`.
A `false` field must not be presented as success.

Windows Antigravity loads workspace
`.agents/mcp_config.json` and uses its own Windows DPAPI credential
`antigravity-mcp`. Codex uses `.codex/config.toml` and a separate
`codex-mcp` credential. Gemini can use `gemini-mcp` via `Trinity/.mcp.json`.
Create each credential only on the authorized Windows PC, through
`Trinity/scripts/provision-mcp-client.ps1 -Client <client> -Access read`.
The token remains protected in `Trinity/.credentials/`, never in Git.
The client must call `initialize`, `tools/list`, then `agent_connections`
to prove an operational link.

The Cloudflare API MCP at `https://mcp.cloudflare.com/mcp` uses its
own Cloudflare OAuth sign-in; do not reuse a leaked token. VS Code
Copilot Studio MCP requires Microsoft sign-in and selection of the
actual environment. ChatGPT MCP registration must be performed from the
authorized ChatGPT account; the remote Trinity endpoint is
`https://auru.space/mcp` and server-side client auth is separate.

Existing `pc_status` now reads a heartbeat without creating a project
action. PC status is not a command execution receipt. A request to deploy,
delete, change files or approve a system action requires separately
authenticated write/project privileges and a verified action receipt.
