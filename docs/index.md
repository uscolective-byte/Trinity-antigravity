# Trinity Omni-Core — technický manuál

**Dokumentačná revízia:** v11.3  
**Checkout:** codex/omni-core-improvements-20261110

Manuál rozlišuje implementované, čiastočné a navrhované funkcie. Dokumentácia nie je dôkazom, že cieľová schopnosť beží v produkcii.

## Navigácia
- [Architektúra](architecture/overview.md)
- [Zod a kontrakty nástrojov](architecture/tool-contracts.md)
- [Fleet Registry — 47 Workerov](architecture/fleet-registry.md)
- [Vyhľadávateľná matica 47 Workerov](registry/fleet-workers.md)
- [Service Binding inventár](registry/service-bindings.json)
- [Sovereign Ledger a MMR](ledger/mmr-audit.md)
- [Lokálny most](bridge/protocol.md)
- [Build, backup a migrácie](runbooks/deploy-and-migrate.md)
- [Ring 0 a rotácia kľúčov](runbooks/ring0-key-rotation.md)
- [AST self-healing](runbooks/self-healing.md)
- [Katalóg 500 vylepšení / 75 pilierov](registry/catalogue-status.md)
- [Úplný katalóg IMP-001 až IMP-500 a P-01 až P-75](registry/KATALOG-500-VYLEPSENI-TRINITY-OMNI-CORE.md)

## Primárne zdroje
- Dokumentacia/KATALOG-500-VYLEPSENI-TRINITY-OMNI-CORE.md
- Trinity/src/omni-core-500-registry.js a Trinity/src/fleet-clusters.js
- packages/contracts/src/tap.js, receipt.js a packages/contracts/schema/
- packages/crypto-core/src/proof-of-execution.js a merkle-mountain-range.js
- services/trinity-treasury/src/index.js
- Local-Gateway/src/server.mjs, trinity-auth-core.mjs a desktop.mjs
- wrangler.jsonc

## Hranice dôvery
Dokumentácia nenahrádza runtime validáciu. Záznam v registri nie je dôkaz nasadenia ani zdravia Workeru. HTTP 200 a exitCode 0 samy osebe nepotvrdzujú správnosť výsledku. Produkčné migrácie, rotácie a deploye vyžadujú samostatné schválenie.
