# Trinity Task & Handoff Templates

## 1. Orchestration Plan Template
```markdown
### Plán orchestrácie
- **Cieľ:** [Stručný popis cieľa]
- **Prostredie:** [auru.dev / auru.space]
- **Zodpovední agenti:**
  - `CORE-DEV-WORKER`: [Podúloha A]
  - `INFRA-EDGE-WORKER`: [Podúloha B]
  - `TRUTH-VERIFIER-WORKER`: [Verifikácia a audit]
- **Vstupy a závislosti:** [D1 / KV / API keys]
- **Očakávaný výstup:** [Overený výsledok so záznamom v Ledgeri]
```

## 2. Handoff & Sync Template
```markdown
### Odovzdanie stavu (Handoff)
- **Odosielateľ:** [Agent A]
- **Prijímateľ:** [Agent B]
- **Doručené zmeny:** [Zoznam commitov / súborov]
- **Identifikované riziká:** [Potenciálne kolízie / limity pamäte]
- **Ďalší krok:** [Konkrétna akcia pre prijímateľa]
```

## 3. Final Synthesis Template
```markdown
### Záverečná syntéza a audit
- **Stav nasadenia:** [Servíruje / Verzia ID]
- **Výsledok testov:** [X / X úspešných]
- **Sovereign Ledger Status:** [valid: true / dĺžka reťazca]
- **Zhrnutie doručených hodnôt:** [Popis funkcionality pre používateľa]
```
