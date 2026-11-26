---
name: trinity-core-orchestrator
description: Coordinate multi-agent tasks, delegate sub-tasks across real WORKER_CATALOG service bindings and 46 Trinity specialist roles, and verify Truth Policy 2.1 receipts across the TRINITY ecosystem. Use when orchestrating complex execution pipelines.
---

# Trinity Core Orchestrator

Coordinate multi-agent workflows, delegate tasks across bound Cloudflare Workers (`Trinity/src/orchestrator.js`), and verify execution receipts across unified production Worker `trinity` (`https://auru.space` and `https://auru.dev`).

## When to Use
- Initializing multi-agent workflows across the 46 registered specialist roles (`AGENTS` in `Trinity/src/registry.js`).
- Delegating sub-tasks to real `WORKER_CATALOG` and `AUXILIARY_WORKER_CATALOG` service bindings:
  - **AURA Specialists (10):** `AURA_ANALYZER`, `AURA_ARCHITECT`, `AURA_CODEGEN`, `AURA_DEPLOYER`, `AURA_EVOLVER`, `AURA_MEMORY`, `AURA_OPTIMIZER`, `AURA_PLANNER`, `AURA_SENTINEL`, `AURA_TESTER`.
  - **Trinity Core Workers (8):** `CORE`, `BUILDER`, `DISPATCHER`, `CONNECTORS`, `GUARDIAN`, `MEMORY`, `SENTINEL`, `SKILLS`.
  - **Specialized & Auxiliary Workers:** `KNOWLEDGE_SERVICE`, `CAPACITY_SERVICE`, `INTEGRATIONS_SERVICE`, `PC_BRIDGE_SERVICE`, `PC_BRIDGE_V2`, `AUDIT_SERVICE`, `JERICHO_SERVICE`, `CHAT_INFERENCE_SERVICE`, `RESEARCHER_SERVICE`, `GEMINI_BRIDGE_SERVICE`.
- Monitoring execution status, shared D1 memory (`ops_memory`), MCP calls (`/mcp` and `POST /api/mcp/invoke`), and Sovereign Ledger integrity (`GET /api/audit-ledger/verify`).

## Steps
1. **Analyze Request:** Break down the incoming goal into discrete, verifiable sub-tasks and confirm readiness (`GET /health`, `GET /ready`, or MCP `trinity_status` / `check_services`).
2. **Assign Workers & Roles:** Match sub-tasks to real `WORKER_CATALOG` bindings and `AGENTS` specialist IDs.
3. **Execute & Sync:** Dispatch bounded jobs via MCP `dispatch_task` / `dispatch_to_agent` or `POST /api/mcp/invoke`, persist cross-agent context in D1 (`trinity_memory_sync`), and track receipts with `get_task` / `get_project_action`.
4. **Verify & Synthesize:** Enforce Truth Policy 2.1 (`NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT`), verify test/build outputs and Sovereign Ledger chain integrity via `GET /api/audit-ledger/verify`, and present verified results with exact commands and exit codes.

## Auxiliary Resources
- [examples.md](examples.md): Concrete multi-agent orchestration workflow examples using real Trinity bindings and endpoints.
- [task-templates.md](task-templates.md): Reusable task breakdown, delegation, and Truth Policy 2.1 receipt templates.
