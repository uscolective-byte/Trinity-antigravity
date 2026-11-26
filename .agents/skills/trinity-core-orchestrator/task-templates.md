# Trinity Task & Handoff Templates

## 1. Orchestration Plan Template
```markdown
### Plán orchestrácie
- **Cieľ:** [Stručný popis cieľa]
- **Cieľová produkcia:** Unified Worker `trinity` (`https://auru.space` & `https://auru.dev`, D1 `trinity-v03`)
- **Zodpovedné bindings (`WORKER_CATALOG`) / roly (`AGENTS`):**
  - `AURA_ARCHITECT` / `AURA_CODEGEN`: [Návrh a implementácia]
  - `DISPATCHER` / `CONNECTORS` / `INTEGRATIONS_SERVICE`: [Integrácie cez `/mcp` a `POST /api/mcp/invoke`]
  - `AURA_TESTER` / `GUARDIAN` / `AUDIT_SERVICE`: [Testy, Truth Policy 2.1 a `GET /api/audit-ledger/verify`]
- **Vstupy a závislosti:** [D1 `trinity-v03` / KV `Mastermind` / Secrets Store metadata]
- **Očakávaný výstup:** [Overený výsledok s presným príkazom, exit kódom a záznamom v Ledgeri]
```

## 2. Handoff & Sync Template
```markdown
### Odovzdanie stavu (Handoff)
- **Odosielateľ:** [Worker / Agent A]
- **Prijímateľ:** [Worker / Agent B]
- **Doručené zmeny:** [Zoznam commitov / upravených súborov]
- **Overovacie doklady (Truth Policy 2.1):** [Príkazy, exit kódy, počty testov]
- **Identifikované riziká a výhrady:** [Potenciálne kolízie / neoverené externé závislosti]
- **Ďalší krok:** [Konkrétna akcia pre prijímateľa]
```

## 3. Final Synthesis & Truth Receipt Template
```markdown
### Záverečná syntéza a audit (Truth Policy 2.1)
- **Commit SHA / Vetva:** [40-znakový SHA / branch]
- **Stav nasadenia:** [Live `/health` + `/ready` receipt alebo `pre-flight only` ak chýbajú CF kredenciály]
- **Výsledok testov a buildov:** [X / X úspešných, exit code 0]
- **Sovereign Ledger Status (`GET /api/audit-ledger/verify`):** [valid: true / dĺžka reťazca]
- **Zhrnutie doručených hodnôt:** [Popis overenej funkcionality pre vlastníka]
```
