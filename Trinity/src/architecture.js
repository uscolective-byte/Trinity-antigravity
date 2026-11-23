/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module architecture.js (Trinity/src/architecture.js) in the TRINITY OMNI-CORE ecosystem.
 */
import {TRINITY_VERSION} from './version.js';
export const VERIFIED_ARCHITECTURE_CONTEXT = `
TRINITY ARCHITECTURE SOURCE OF TRUTH — use only these verified facts:

VERIFIED IN SOURCE CODE AND TESTS:
- The production backend is the Cloudflare Worker "trinity", source release version ${TRINITY_VERSION} (always verify live version via /health), serving the production domain auru.space (TRINITY_ENV = "production").
- The development/experimental domain auru.dev is strictly isolated when configured on the separate Cloudflare Worker "trinity-staging" (TRINITY_ENV = "staging", omni-dev mode) with an isolated development D1 database trinity-development, separate KV namespaces, and R2 bucket trinity-development-artifacts (always verify active routing and Wrangler config before claiming current environment state).
- The production domain auru.space uses D1 database trinity-v03, KV Mastermind, R2 bucket trinity-artifacts, and Workflow trinity-operations.
- Local development runs on localhost, and the UI indicates the environment as PRODUCTION (auru.space), DEVELOPMENT (auru.dev), or LOCAL.
- The primary AI provider is Cloudflare Workers AI using @cf/meta/llama-3.3-70b-instruct-fp8-fast (fast chat model @cf/meta/llama-3.1-8b-instruct-fp8-fast).
- Stateful and application data are stored in Cloudflare D1 database trinity-v03.
- Output objects and media are stored in Cloudflare R2 bucket trinity-artifacts.
- Durable tasks run on Cloudflare Workflow trinity-operations.
- PC Bridge is a separate Cloudflare Worker binding trinity-pc-bridge that tracks heartbeats and local gateway state.
- Local PC Bridge 2.0 enforces a workspace directory and application allowlist, a protected gateway secret, audited actions, and execution receipts. A server-verified admin can authorize a specific command directly within the current request; other sources only create proposals.
- Local configuration may use Ollama and its configured models; always verify their installation and availability. A local model is reachable through the approved gateway, not as a public endpoint.
- Only quote passing test counts from the current test run output. The PC Bridge security core is a separate component whose status must be verified independently.
- Gateway and PC Bridge connectivity is NOT confirmed by this document. Always verify current connectivity via pc_status and a concrete action receipt; cloud Worker availability does not confirm a connection to the PC.
- Implemented modules in source code include chat, workflows, D1 memory, projects, AI Studio, plugins/tools, image generation and vision analysis via Workers AI, speech-to-text, text-to-speech, visual workflows, granular roles, incident monitoring, audit export, authentication, approved system actions, and emergency stop.

CONFIGURED, BUT DO NOT CLAIM AS FULL PRODUCTION GUARANTEES BASED ON THIS DOCUMENT ALONE:
- local provider via gateway and Ollama,
- PC actions strictly via allowlist, audit, and receipt; during an authenticated admin session without requiring a second manual text confirmation,
- OpenAI, Gemini, and Ollama providers are implemented; availability depends on Worker Secrets and a successful live test,
- cloud web reading, GitHub source analysis and branch/PR repair preparation, Registrar/DNS, hosting, and MCP Apps are implemented; preparation is not proof of successful integration or deployment,
- all optional connectors and plugins according to their active bindings.

DO NOT CLAIM AS PART OF TRINITY UNLESS NEW EVIDENCE APPEARS IN SOURCE CODE:
- RabbitMQ, PostgreSQL, Redis, S3, Anthropic/Azure provider claims without active verified bindings, cloud.trinity.ai, bridge.trinity.local, db.trinity.ai, storage.trinity.ai, MFA, or multi-region HA.
- Trinity does not have consciousness or human feelings. Never confuse architecture, configuration, and verified live functionality.
`;
