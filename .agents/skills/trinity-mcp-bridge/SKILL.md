---
name: trinity-mcp-bridge
description: >-
  Interact with the live Trinity MCP Bridge (https://auru.space/mcp and
  https://auru.dev/mcp) for readiness checks, capability status, service-binding
  health, memory search, task dispatch, bounded PC bridge operations, and
  external AI bridges across all 48 registered MCP tools and 46 specialist
  agents. Use when calling or troubleshooting Trinity MCP tools.
---

# Trinity Secure MCP Bridge

The `trinity` MCP server connects Antigravity, Codex, Gemini, and Copilot clients to unified production Worker `trinity` (`https://auru.space` and `https://auru.dev`).

## Canonical Endpoints & Transports

- **Streamable HTTP MCP JSON-RPC 2.0:** `POST /mcp` (authenticated via scoped `Bearer` token `TRINITY_MCP_TOKEN` / `TRINITY_MCP_API_KEY`, plus optional `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers when Cloudflare Access is enabled).
- **REST Invocation Wrapper:** `POST /api/mcp/invoke` (requires `api:invoke` scope; note that `/api/mcp` is not a registered route).
- **Local Stdio Bridge:** `node Trinity/scripts/trinity-codex-mcp.mjs` (registers all 48 tools with 1:1 schema parity to `Trinity/src/mcp.js`).
- **Windows DPAPI Credential Path (optional on Windows):** `Trinity\.credentials\gemini-mcp.dpapi` — never print or commit secret material.

## Available MCP Tools (48 Total)

- **Core Readiness & Diagnostics (6):** `trinity_status`, `get_capability_status`, `diagnostic_ping`, `infrastructure_status`, `check_services`, `trinity_control_panel`.
- **Agents, Planning, Memory & Ledger (10):** `list_agents` (46 Trinity specialist roles), `dispatch_to_agent`, `dispatch_task`, `get_task`, `list_tasks`, `search_memory`, `trinity_memory_sync`, `create_daily_plan`, `sync_shared_notes`, `sovereign_ledger`.
- **Project Inspection, Source & Bounded Actions (15):** `project_inspect`, `project_read`, `list_project_files`, `get_source_file`, `edit_source_file`, `pc_find_files`, `pc_search_text`, `run_build`, `request_project_action`, `get_project_action`, `list_system_actions`, `approve_system_action`, `reject_system_action`, `list_improvements`, `propose_improvement`.
- **PC Bridge & Copilot (5):** `pc_status`, `pc_open_url`, `pc_run_command`, `pc_run_script`, `copilot_chat`.
- **Ecosystem & Evolution (7):** `ecosystem_stats`, `search_ecosystem`, `synthesize_skill`, `synthesize_plugin`, `synthesize_app`, `trigger_brain_cycle`, `trigger_evolution_cycle`.
- **External AI Bridges (5):** `azure_foundry_agent_status`, `azure_foundry_agent_invoke`, `google_ai_studio_status`, `google_ai_studio_models`, `google_ai_studio_cocreate`.

## Verifying the MCP Bridge (Cross-Platform)

### Linux / macOS / CI (Node.js)

Read-only public edge check (no secrets required — verifies `GET /health` 200 `ok: true`, `GET /ready` 200 `ready: true`, and unauthenticated `POST /mcp` returning `401` JSON on `auru.space` and `auru.dev`):

```bash
node scripts/verify-codex-mcp-access.mjs --public-only
```

Full authenticated verification (requires `TRINITY_MCP_TOKEN` or `TRINITY_MCP_API_KEY`; validates `initialize`, `tools/list` = 48 tools, and `diagnostic_ping`):

```bash
node scripts/verify-codex-mcp-access.mjs
```

Local schema & 48-tool parity unit test:

```bash
node --test Trinity/tests/mcp-bridge-parity.test.mjs
```

### Windows (PowerShell DPAPI)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\saboi\Trinity-antigravity\Trinity\scripts\test-gemini-mcp.ps1"
```
