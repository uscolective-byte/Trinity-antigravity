---
name: trinity-core-orchestrator
description: Coordinate multi-agent tasks, delegate sub-tasks, and manage workflows across the TRINITY ecosystem. Use when orchestrating complex execution pipelines.
---

# Trinity Core Orchestrator

Coordinate multi-agent workflows, delegate tasks to specialized workers, and manage state across the TRINITY ecosystem (`auru.space` / `auru.dev`).

## When to Use
- Initializing multi-agent workflows across the 46 specialized Trinity agents.
- Splitting complex requests into discrete sub-tasks for different workers (e.g., `CORE-DEV-WORKER`, `INFRA-EDGE-WORKER`, `TRUTH-VERIFIER-WORKER`).
- Monitoring execution status and handling synchronization across Cloudflare Workers, D1 databases, and MCP bridges.

## Steps
1. **Analyze Request:** Break down the incoming goal into discrete, manageable sub-tasks.
2. **Assign Workers:** Match sub-tasks to specialized roles in the Trinity fleet.
3. **Execute & Sync:** Monitor execution, pass context between agents via `AURA_QUEUE` or `trinity-omni-bridge`.
4. **Synthesize:** Combine verified outputs into a cohesive final result with cryptographic proof in Sovereign Ledger.

## Auxiliary Resources
- [examples.md](examples.md): Concrete multi-agent orchestration workflow examples across the TRINITY ecosystem.
- [task-templates.md](task-templates.md): Reusable task breakdown, delegation, and synchronization templates.
