# Trinity / Morhfeus


Osobná asistentka, webové rozhranie a Cloudflare backend v jednom repozitári.
Hlavná aplikácia a konfigurácia sú v `Trinity/`. Koreňové `src/` a `tests/`
obsahujú kompatibilné vstupy; zdrojové zmeny smerujú do kanonických modulov.

<!-- trinity-release:start -->
Verzia zdroja: **11.0.0**. Repozitár: [uscolective-byte/Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |
| auru.dev | staging | `trinity-staging` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->

## Spustenie a overenie

Použi Node.js 22 alebo novší a npm. Na Windows používaj `npm.cmd`, ak
PowerShell blokuje `npm.ps1`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-all.ps1
node scripts/sync-release-docs.mjs --check
npm.cmd run build
npm.cmd run check
```

`setup` inštaluje závislosti cloudových modulov a lokálnej brány. `build`
vykonáva dry-run zostavenia; nič nenasadzuje. `check` spúšťa testy modulov,
integračný runtime a kontrolu závislostí. Skutočný výsledok určuje návratový kód.

Na synchronizáciu čistého `main` s `origin/main` a následné overenie:

```powershell
npm.cmd run sync
```

Synchronizácia odmietne nesprávny repozitár, vetvu aj rozpracované súbory.
Starší Windows vstup `SYNC-BUILD.ps1` zostáva podporovaný; `-SkipSync` umožňuje
lokálne overenie rozpracovaného stromu a `-Deploy` vyžaduje čistý kanonický zdroj.
NPM chyby z tohto vstupu sa ukladajú do ignorovaného priečinka `logs/`.

Verzia, domény a vetva v oboch README sa generujú z aplikácie a Wrangler
konfigurácie. Po zmene vydania spusti `node scripts/sync-release-docs.mjs`; CI kontroluje
`node scripts/sync-release-docs.mjs --check`.

## Dokumentácia a Špecifikácia 2026 (TRINITY OMNI-CORE)

- [ARCHITECTURE.md](ARCHITECTURE.md): Detailný rozpad 7 systémových vrstiev (Kernel, Orchestration, Memory, Sovereign Ledger v3, Execution, TruthGuard, Interface) a dátových tokov.
- [API_REFERENCE.md](API_REFERENCE.md): Kompletná dokumentácia REST/RPC/MCP endpointov na Cloudflare Edge (`auru.space`, `auru.dev`) a lokálnom System Bridge (port `7788` a `3333`).
- [SOVEREIGN_CHARTER.md](SOVEREIGN_CHARTER.md): Ústavná charta (5 základných neporušiteľných bodov + 20 právnych doložiek legality) a kryptografický Sovereign Lock.
- [CHANGELOG.md](CHANGELOG.md): Záznam bezpečnostných záplat (P0/P1 audit remediations), integrácií a aktualizácií.
- [DEPLOYMENT_RECEIPT.json](DEPLOYMENT_RECEIPT.json): Kryptografický a verifikačný doklad o nasadení na Cloudflare Edge a lokálnom moste.
- [Kompletná systémová špecifikácia Trinity 2026](Trinity/docs/TRINITY_SOVEREIGN_SYSTEM_SPEC_2026.md): Detailný prehľad architektúry, 29 viazaných služieb, Truth Policy 2.0, nástrojov, modelov a nasadenia.
- [Príručka používania nástrojov](Trinity/docs/TRINITY_NASTROJE_A_POUZIVANIE.md): Pravidlá pre Truth Policy, Puppeteer browser, GitHub Engine a Domain Engine.
- [Postup jedného repozitára pre obe domény](Trinity/docs/SINGLE_REPOSITORY.md): Nasadenie, tagovanie a overenie produkcie a stagingu.

## Architektúra OMNI-CORE, Porty a Bezpečnosť

- **Cloudflare Edge (`https://auru.space` — Produkcia / `https://auru.dev` — Staging & Antigravity Omni-Dev Workspace):**
  - 7-vrstvové jadro (`Trinity/src/sovereign-core-v3.js`), nemenná účtovná kniha `SovereignLedgerV3` (`Trinity/migrations/0055_sovereign_ledger_v3.sql`), `SovereignTruthGuard` (`Trinity/src/truth.js`) a `OmniDev Studio` AST diagnostika (`Trinity/src/omnidev-diagnostics.js`).
- **Lokálny System Bridge (`http://127.0.0.1:7788` — `system-bridge.js` / `Local-Gateway/src/system-bridge.mjs`):**
  - Lokálny most pre Ring 0 operácie, AST diagnostiku `OmniDev Studio` (`/api/omnidev/diagnose`) a privilegované vykonávanie (`/api/execute-privileged`).
- **Autorizačné Jadro (`Trinity/src/trinity-auth-core.js` & `Local-Gateway/src/trinity-auth-core.mjs`):**
  - Striktné **fail-closed** overenie identity vlastníka **Basterix (Sabo Ivan)**:
    - Windows účty `saboi` / `basterix` vyžadujú autentický OS prístupový token (`osTokenVerified === true`) a platné Windows SID (`/^S-1-5-21-\d+-\d+-\d+-\d+$/`) zo `[System.Security.Principal.WindowsIdentity]::GetCurrent()`.
    - Google účty (`saboivan2008@gmail.com`, `uscolective@gmail.com`, `cadjavadvocecka013@gmail.com`) vyžadujú `verifiedGoogleToken === true`.
    - Mobilné čísla (`+421949009722`, `0949009722`, `+421949515777`, `0949515777`) vyžadujú `verifiedWebhookSignature === true`.
- **Sovereign Lock & Durable Nonce Vault (`Trinity/src/sovereign-lock.js`):**
  - HMAC-SHA256 `ConsentEnvelope` viazaný na SHA-256 hash `git diff` a trvalé atomické úložisko spotrebovaných `nonce` v D1 (`ops_consumed_nonces`), KV (`Mastermind` / `PC_STATE`) a lokálnom Disk Vaulte.

## Moduly

- `Trinity/`: zjednotené suverénne jadro, chat, AI Studio, domény, pamäť, platobné terminály, API a MCP (29 viazaných služieb).
- `Jericho-Worker/`: autonómny krypto super-agent, Binance live feed, DeFi výnosy a správa pokladnice Tetrakis ($TTK) s hodinovým cronom.
- `contracts/tetrakis/`: oficiálny ERC-20 smart kontrakt Tetrakis ($TTK) podľa štandardu OpenZeppelin v5.1.0, 1 miliarda TTK celková zásoba, 15/15 EVM testov.
- `Knowledge-Worker/`, `Integrations-Worker/`, `Capacity-Worker/`: znalosti, konektory a kapacity.
- `PC-Bridge-Worker/`, `Local-Gateway/`, `Local-Desktop/`, `trinity-mcp-bridge/`: cloudový most a lokálne PC nástroje na porte 3333.
- `Audit-Worker/`: kryptograficky podpísané auditné záznamy v D1.

Lokálnu bránu spusti cez `npm.cmd run gateway`; desktop cez
`npm.cmd run desktop`. Spúšťacie súbory a oprávnenia opisujú README týchto modulov.

## Nasadenie a integrácie

[Postup jedného repozitára pre obe domény](Trinity/docs/SINGLE_REPOSITORY.md)
opisuje nasadenie vývoja, overenie commitu a následnú produkciu. Primárne
D1/KV/R2 úložiská sú oddelené; niektoré pomocné Workers služby sú spoločné.
Staršie repozitáre sa synchronizáciou nemažú.

[Konfigurácia aplikácie a prihlasovania](Trinity/README.md) odlišuje hotový kód
od aktivovaných účtov. E-mail, RevTag ani telefónne číslo nenahrádzajú
OAuth súhlas, platobný checkout alebo pripojenú SMS bránu.

`/health` potvrdzuje dostupnosť a verziu; `/ready` pripravenosť väzieb a schémy.
Samy nepotvrdzujú vykonanie platby, registráciu domény ani dostupnosť každého modelu.
Tajomstvá patria do Worker secrets alebo ignorovaných lokálnych súborov.


## Chat a poverenia — aktualizácia 24. 10. 2026

Automatický režim používa rýchly Workers AI model pre bežný rozhovor; úlohy a opravy spracuje cloudový plánovač. Lokálna inferencia sa vyberá výslovne, aby bežný chat nečakal na offline PC. Prijatie správy sa zobrazí hneď; modelová odpoveď vzniká až po dokončení úlohy. Sieťové požiadavky majú časový limit; pri nedokončenej úlohe zostane viditeľné jej ID.

Secrets sa neaktualizujú podľa veku automaticky. `wrangler secret list` vracia iba názvy, nie hodnoty. Produkcia a development majú samostatné secrets. Kľúče pre inference sú `GEMINI_API_KEY`, `OPENAI_API_KEY` a `OLLAMA_API_KEY`; Workers AI používa binding `AI`. Prítomnosť názvu nepotvrdzuje platnosť kľúča, kredit ani úspešné generovanie. Nikdy nekopíruj produkčné oprávnenia do developmentu len na odstránenie chyby.

Rotáciu vykonaj iba s platnou novou hodnotou cez interaktívny `npx.cmd wrangler secret put NAZOV --env development`, over vývoj a potom samostatne nastav produkciu s `--env=""`. Hodnoty nedávaj do README, príkazovej histórie ani Gitu. Nemeň bez migračného postupu `TRINITY_VAULT_KEY` (šifrované údaje) alebo `TRINITY_SESSION_SECRET` (existujúce relácie). Lokálne súbory s API kľúčmi sú ignorované.

Audit názvov secrets bez ich hodnôt: `node scripts/audit-worker-secrets.mjs`. Skript nič nemení a nevypisuje neznáme názvy. Kontrola 24. 10. 2026: produkcia má 24 secrets vrátane Gemini/OpenAI/Ollama; development má 4 secrets a žiadny z týchto externých AI kľúčov. `GOOGLE_CLIENT_SECRET` nie je prítomný ani v jednom prostredí. To nie je overenie platnosti poskytovateľov ani dôvod zapínať neúplný Google login. Používateľ si môže externý model zvoliť výslovne; automatický chat zostáva pri Workers AI.
