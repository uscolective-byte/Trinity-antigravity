# Trinity Sovereign Ecosystem & Triad Rules (Trinity + GPT/Codex + Antigravity)

Read repository-root TEAM-HANDOFF.md before every task; check for updates before
every command. Claim files before mutation, preserve other owners' changes,
write UPDATE and HANDOFF, and acknowledge only your own receipt. Conflicts stop
the affected operation. Historical infrastructure statements below require live
verification before deployment; see the conflict recorded in TEAM-HANDOFF.md.

- Always communicate with the owner (Sabo Ivan / Basterix) in Slovak.
- Canonical repository: `C:\Users\saboi\Trinity-antigravity` (`main` branch).
- **Aktuálna Cloudflare konfigurácia (overiť Wrangler pred deployom):**
  - Staging: env key **staging**, Worker **trinity-staging**, doména https://auru.dev; hlavná D1 má názov trinity-development.
  - Produkcia: Worker **trinity**, doména https://auru.space; hlavná D1 trinity-v03.
  - Staré pokyny s env development a Worker trinity-development sú historické, nie aktuálny deploy target.
  - **Staging momentálne NIE JE úplne izolovaný:** s produkciou zdieľa D1 rea, D1 trinity_basterix, KV Mastermind a R2 ARTIFACTS. Pred mutačným staging testom spusti node Trinity/scripts/cloudflare-env-audit.mjs --strict; pri neúspechu nenasaď ani nezapisuj do týchto zdrojov.
  - Na Secrets Store používaj .agents/skills/cloudflare-secrets-store/SKILL.md a npm run secrets:doctor v Trinity. Oprávnenie na binding vyžaduje Account Secrets Store Edit alebo rolu Deployer a secret scope workers; konfigurovaný binding nie je overený token.
- **29 Bound Cloudflare Workers on Trinity**:
  - 10× AURA specialists (`AURA_ANALYZER`, `AURA_ARCHITECT`, `AURA_CODEGEN`, `AURA_DEPLOYER`, `AURA_EVOLVER`, `AURA_MEMORY`, `AURA_OPTIMIZER`, `AURA_PLANNER`, `AURA_SENTINEL`, `AURA_TESTER` + aliases `admin`, `admino`, `Trinity`).
  - 8× Trinity Core workers (`CORE`, `BUILDER`, `DISPATCHER`, `CONNECTORS`, `GUARDIAN`, `MEMORY`, `SENTINEL`, `SKILLS`).
  - 8× Specialized & RPC workers (`KNOWLEDGE_SERVICE`, `CAPACITY_SERVICE`, `INTEGRATIONS_SERVICE`, `PC_BRIDGE_SERVICE`, `PC_BRIDGE_V2`, `AUDIT_SERVICE`, `JERICHO_SERVICE`, `CHAT_INFERENCE_SERVICE`).
- **Truth Policy 2.0 & Guarded Rollout**:
  - Run `npm run check` (`436/436` tests across `Trinity`, `Audit-Worker`, `Capacity-Worker`, `Jericho-Worker`) before deploying.
  - Po prejdení CI a kontroly izolácie zváž najprv **staging** (`https://auru.dev`) s overeným commitom a version ID; až po skutočne úspešnom health a schválení production (`https://auru.space`).
  - Never print, log, or commit plaintext secrets, `.credentials/*.dpapi`, or API keys.
