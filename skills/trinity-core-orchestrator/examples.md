# Trinity Multi-Agent Workflow Examples

## 1. Feature & Edge Deployment Pipeline (auru.space / auru.dev)
- **Cieľ:** Vývoj a nasadenie novej schopnosti s migráciou D1 a overením integrity.
- **Postup:**
  1. `AURA_ARCHITECT`: Návrh schémy a architektúry rozhrania.
  2. `AURA_CODEGEN`: Vygenerovanie kódu modulu a unit testov.
  3. `AURA_TESTER`: Spustenie testovacej suity a verifikácia pravdivosti (Zero Simulated Execution).
  4. `AURA_DEPLOYER`: Nasadenie na `auru.dev` a produkciu `auru.space`.
  5. `TRUTH_VERIFIER`: Overenie integrity reťazca v Sovereign Ledger cez `/api/audit-ledger/verify`.

## 2. Cross-Repository & Connector Integration
- **Cieľ:** Prepojenie externých platforiem (Telegram, Meta AI, Google Gemini, GitHub, Azure Copilot) cez `trinity-omni-bridge`.
- **Postup:**
  1. `ORCHESTRATOR`: Prijatie požiadavky cez POST `/invoke`.
  2. `CONNECTOR`: Smerovanie do príslušného adaptéra (`trinity-mcp`, `telegram`, `google`, `anthropic`).
  3. `NOTIFIER`: Automatické chunkované odoslanie reportu do Telegramu.

## 3. Multi-Step Refactor & Verification Loop
- **Cieľ:** Bezpečný refaktoring jadra s priebežným testovaním bez výpadku produkcie.
- **Postup:**
  1. Snapshot existujúceho stavu a záloh.
  2. Vykonanie kontrolovaných úprav.
  3. Overenie testov `node --test tests/*.test.mjs`.
  4. Publikovanie novej verzie Workeru.
