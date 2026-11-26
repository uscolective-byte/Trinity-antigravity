# Trinity Multi-Agent Workflow Examples

## 1. Feature & Edge Verification Pipeline (`trinity` on `auru.space` / `auru.dev`)
- **Cieľ:** Vývoj, overenie a príprava nasadenia novej schopnosti s kontrolou D1 a kryptografickým auditom.
- **Postup:**
  1. `AURA_ARCHITECT`: Návrh schémy, kontraktov a rozhrania modulu.
  2. `AURA_CODEGEN`: Implementácia modulu a unit testov v repozitári.
  3. `AURA_TESTER`: Spustenie testovacej suity (`npm test`) a overenie Truth Policy 2.1 (`NO RECEIPT = NO SUCCESS`).
  4. `AURA_DEPLOYER`: Prednasadzovacia kontrola (`node scripts/pre-deploy-check.mjs`, `npm --prefix Trinity run build`, `node scripts/test-all-workers-build.mjs`) a príprava `workflow_dispatch` pre `.github/workflows/self-deploy.yml` s `deploy_production=true` a presným 40-znakovým `expected_commit_sha`.
  5. `GUARDIAN` / `AUDIT_SERVICE`: Overenie integrity reťazca v Sovereign Ledger cez autentifikovaný `GET /api/audit-ledger/verify`.

## 2. Cross-Platform MCP & Connector Integration
- **Cieľ:** Prepojenie externých platforiem (Google AI Studio, Azure AI Foundry, GitHub, Firecrawl, PC Bridge) cez kanonické MCP a Worker rozhrania.
- **Postup:**
  1. `DISPATCHER`: Prijatie autentifikovanej požiadavky cez `POST /mcp` (Streamable HTTP JSON-RPC) alebo `POST /api/mcp/invoke` (REST wrapper s `api:invoke` scope).
  2. `CONNECTORS` / `INTEGRATIONS_SERVICE` / `PC_BRIDGE_SERVICE`: Smerovanie do konkrétneho nástroja (napr. `google_ai_studio_cocreate`, `azure_foundry_agent_invoke`, `pc_find_files`) s overeným dokladom vykonania.
  3. `MEMORY` / `AURA_MEMORY`: Uloženie výsledkov a kontextu do zdieľanej D1 pamäte (`trinity_memory_sync` / `ops_memory`).

## 3. Governed Self-Evolution & Verification Loop (`evolve`)
- **Cieľ:** Bezpečný návrh opravy a kontrolovaná integrácia cez Pull Request bez neautorizovaných zmien produkcie.
- **Postup:**
  1. `AURA_ANALYZER` / `AURA_EVOLVER`: Analýza zlyhaných úloh (`trigger_evolution_cycle`) a vytvorenie schváleného návrhu (`propose_improvement` -> `patch_ready` na vetve `trinity/evolution-<id>`).
  2. Overenie CI kontroly `Full Test Suite & Validation` (`.github/workflows/ci.yml`) a testov `npm test`.
  3. Rekonciliácia PR (`reconcileSelfImprovements`) po mergi s `deployed: false`, až do samostatného vlastníkom schváleného produkčného nasadenia cez `self-deploy.yml`.
