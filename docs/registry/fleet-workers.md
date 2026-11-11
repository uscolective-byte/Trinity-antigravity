# Fleet Workers — deklarovaných 47 Workerov

Zdroj zoznamu: Trinity/src/fleet-clusters.js. Bindingy sa mapujú presnou zhodou na wrangler.jsonc. Live status sa tu nevyhodnocuje.

| ID | Cluster | Worker | Úloha | Config | Production bindings | Staging bindings | Timeout | Compute | Fallback | Live |
|---|---|---|---|---|---|---|---:|---|---|---|
| #01 | 01 Core & Routing | trinity | Fast-Chat Edge Router & TAP Gatekeeper (Prod auru.space) | yes | — | — | unknown | unknown | unspecified | not queried |
| #02 | 01 Core & Routing | trinity-staging | Staging Omni-Dev Edge Gateway (auru.dev) | yes | — | — | unknown | unknown | unspecified | not queried |
| #03 | 01 Core & Routing | trinity-core | Core Kernel & Sovereign State Coordinator | no | CORE, CORE_SERVICE | CORE, CORE_SERVICE | unknown | unknown | unspecified | not queried |
| #04 | 01 Core & Routing | trinity-dispatcher | Domain & Task Dispatcher | no | DISPATCHER, DISPATCHER_SERVICE | DISPATCHER, DISPATCHER_SERVICE | unknown | unknown | unspecified | not queried |
| #05 | 01 Core & Routing | trinity-builder | Edge Build & Artifact Streamer | no | BUILDER | BUILDER | unknown | unknown | unspecified | not queried |
| #06 | 01 Core & Routing | trinity-connectors | External Protocol & Service Connector Router | no | CONNECTORS | CONNECTORS | unknown | unknown | unspecified | not queried |
| #07 | 02 Cognition & AI Engine | trinity-chat-inference | 3-Tier LLM Inference Cascade & Circuit Breaker | no | CHAT_INFERENCE_SERVICE, AI_INFERENCE_SERVICE | CHAT_INFERENCE_SERVICE, AI_INFERENCE_SERVICE | unknown | unknown | unspecified | not queried |
| #08 | 02 Cognition & AI Engine | trinity-knowledge | Vectorize RAG & Knowledge Synthesis | yes | KNOWLEDGE_SERVICE | KNOWLEDGE_SERVICE | unknown | unknown | unspecified | not queried |
| #09 | 02 Cognition & AI Engine | trinity-memory | Episodic & Semantic Memory Engine | no | MEMORY | MEMORY | unknown | unknown | unspecified | not queried |
| #10 | 02 Cognition & AI Engine | trinity-gemini | Google Gemini Interactions & Multimodal Bridge | no | GEMINI_BRIDGE_SERVICE | GEMINI_BRIDGE_SERVICE | unknown | unknown | unspecified | not queried |
| #11 | 02 Cognition & AI Engine | trinity-agent-researcher | Deep Research & Evidence Synthesis Agent | no | RESEARCHER_SERVICE | RESEARCHER_SERVICE | unknown | unknown | unspecified | not queried |
| #12 | 02 Cognition & AI Engine | trinity-chat-maintainer | Context Window & Conversation Hygiene Worker | no | CHAT_MAINTAINER_SERVICE | CHAT_MAINTAINER_SERVICE | unknown | unknown | unspecified | not queried |
| #13 | 02 Cognition & AI Engine | aura_analyzer | Aura Semantic & AST Analyzer | no | AURA_ANALYZER | AURA_ANALYZER | unknown | unknown | unspecified | not queried |
| #14 | 02 Cognition & AI Engine | aura_architect | Aura System Architecture Planner | no | admino, AURA_ARCHITECT | admino, AURA_ARCHITECT | unknown | unknown | unspecified | not queried |
| #15 | 02 Cognition & AI Engine | aura_memory | Aura Vector Memory Synchronizer | no | AURA_MEMORY | AURA_MEMORY | unknown | unknown | unspecified | not queried |
| #16 | 03 Security & Ring 0 | trinity-guardian | Ring 0 Security Gate & Policy Enforcer | no | GUARDIAN | GUARDIAN | unknown | unknown | unspecified | not queried |
| #17 | 03 Security & Ring 0 | trinity-sentinel | Anomaly Detection & Intrusion Shield | no | SENTINEL | SENTINEL | unknown | unknown | unspecified | not queried |
| #18 | 03 Security & Ring 0 | trinity-audit | Asynchronous D1 Audit Ledger & Receipt Verifier | yes | AUDIT_SERVICE | AUDIT_SERVICE | unknown | unknown | unspecified | not queried |
| #19 | 03 Security & Ring 0 | trinityguardiantruthverifierworker | Truth Policy 2.1 Cryptographic Receipt Verifier | no | — | — | unknown | unknown | unspecified | not queried |
| #20 | 03 Security & Ring 0 | aura_sentinel | Aura Perimeter & Leak Filter Sentinel | no | admin, AURA_SENTINEL | admin, AURA_SENTINEL | unknown | unknown | unspecified | not queried |
| #21 | 03 Security & Ring 0 | aura_tester | Adversarial Security & Contract Tester | no | AURA_TESTER | AURA_TESTER | unknown | unknown | unspecified | not queried |
| #22 | 03 Security & Ring 0 | trinity-capacity | Rate Limiting, Quota & Circuit Protection | yes | CAPACITY_SERVICE | CAPACITY_SERVICE | unknown | unknown | unspecified | not queried |
| #23 | 04 Financial & Krypto | aura_optimizer | Quant & Resource Execution Optimizer | no | AURA_OPTIMIZER | AURA_OPTIMIZER | unknown | unknown | unspecified | not queried |
| #24 | 04 Financial & Krypto | aura_planner | Financial & Strategic Execution Planner | no | AURA_PLANNER | AURA_PLANNER | unknown | unknown | unspecified | not queried |
| #25 | 04 Financial & Krypto | trinity-seeder | D1 Ledger & Market State Seeder | no | SEEDER_SERVICE | SEEDER_SERVICE | unknown | unknown | unspecified | not queried |
| #26 | 04 Financial & Krypto | jericho123 | Consensus Crypto Oracle (Binance/Coinbase Median) & Tetrakis ($TTK) Vaults | yes | JERICHO_SERVICE | JERICHO_SERVICE | unknown | unknown | unspecified | not queried |
| #27 | 04 Financial & Krypto | chanfana-openapi-template | OpenAPI Financial & Settlement Schema Gateway | no | — | — | unknown | unknown | unspecified | not queried |
| #28 | 04 Financial & Krypto | saas-admin-template | Treasury & Merchant Administration Portal | no | — | — | unknown | unknown | unspecified | not queried |
| #29 | 05 Autonomy & Agents | trinity-morhfeus | Autonomous Agent Morpheus & Social/External Orchestrator | no | — | — | unknown | unknown | unspecified | not queried |
| #30 | 05 Autonomy & Agents | trinity-pc-bridge | Cloud-to-Local PC Bridge v1 | yes | PC_BRIDGE_SERVICE | PC_BRIDGE_SERVICE | unknown | unknown | unspecified | not queried |
| #31 | 05 Autonomy & Agents | trinity-pc-bridge-v2 | Zero-Footprint Desktop Commander Bridge v2 | no | PC_BRIDGE_V2 | PC_BRIDGE_V2 | unknown | unknown | unspecified | not queried |
| #32 | 05 Autonomy & Agents | trinity-skills | Dynamic Skill Matrix & Tool Executor | no | SKILLS | SKILLS | unknown | unknown | unspecified | not queried |
| #33 | 05 Autonomy & Agents | trinity-integrations | External Webhooks, GitHub, Firecrawl & Workspace Integrations | yes | INTEGRATIONS_SERVICE | INTEGRATIONS_SERVICE | unknown | unknown | unspecified | not queried |
| #34 | 05 Autonomy & Agents | trinity-ops | Cron Watchdogs & 5-Min Desktop Commander Heartbeat | no | OPS_SERVICE | OPS_SERVICE | unknown | unknown | unspecified | not queried |
| #35 | 05 Autonomy & Agents | trinity-deployer | Autonomous Worker & Domain Deployment Agent | no | DEPLOYER_SERVICE | DEPLOYER_SERVICE | unknown | unknown | unspecified | not queried |
| #36 | 05 Autonomy & Agents | aura_codegen | Autonomous Code Synthesis Worker | no | AURA_CODEGEN | AURA_CODEGEN | unknown | unknown | unspecified | not queried |
| #37 | 05 Autonomy & Agents | aura_deployer | Aura Continuous Deployment Worker | no | Trinity, AURA_DEPLOYER | Trinity, AURA_DEPLOYER | unknown | unknown | unspecified | not queried |
| #38 | 05 Autonomy & Agents | aura_evolver | Self-Evolution & Mutation Proposal Worker | no | AURA_EVOLVER | AURA_EVOLVER | unknown | unknown | unspecified | not queried |
| #39 | 06 System & Profile | muddy-wind-42e2 | Canary Edge Telemetry Node A | no | — | — | unknown | unknown | unspecified | not queried |
| #40 | 06 System & Profile | my-react-app | Edge UI & Component Sandbox | no | — | — | unknown | unknown | unspecified | not queried |
| #41 | 06 System & Profile | noisy-hat-011e | Canary Edge Telemetry Node B | no | — | — | unknown | unknown | unspecified | not queried |
| #42 | 06 System & Profile | react-router-starter-templates | SSR Routing & Edge App Template | no | — | — | unknown | unknown | unspecified | not queried |
| #43 | 06 System & Profile | small-pine-596d | Canary Edge Telemetry Node C | no | — | — | unknown | unknown | unspecified | not queried |
| #44 | 06 System & Profile | snowy-fire-3605 | Canary Edge Telemetry Node D | no | — | — | unknown | unknown | unspecified | not queried |
| #45 | 06 System & Profile | vite-react-template | Vite Edge Asset Preview Worker A | no | — | — | unknown | unknown | unspecified | not queried |
| #46 | 06 System & Profile | vite-react-templates | Vite Edge Asset Preview Worker B | no | — | — | unknown | unknown | unspecified | not queried |
| #47 | 06 System & Profile | trinity-profile | ProfileMaker (#47) — Ring 0 TAP Keys, RS256 JWT & D1 Profiles | no | PROFILE_SERVICE | PROFILE_SERVICE | unknown | unknown | unspecified | not queried |

## Interpretácia

- Worker config = samostatný Wrangler config alebo explicitný staging environment v koreňovom configu.
- Bindingy sú aliasy z wrangler.jsonc; duplicitné aliasy sa nesčítavajú ako samostatné Workery.
- Timeout, compute budget a fallback nie sú v inventári domyslené.
- Live status vyžaduje samostatnú Cloudflare probe; tento súbor nie je live health report.
