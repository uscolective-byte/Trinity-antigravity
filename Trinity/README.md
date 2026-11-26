# Trinity na Cloudflare (TRINITY OMNI-CORE v11.1.0)

[![Trinity CI](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/webpack.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/webpack.yml)
[![CodeQL Security](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/codeql.yml)
[![Trinity self-deploy](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/self-deploy.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/self-deploy.yml)

Webové rozhranie, autorizácia, MCP a smerovanie nástrojov pre obe produkčné domény Trinity.

<!-- trinity-release:start -->
Verzia zdroja: **11.1.0**. Repozitár: [uscolective-byte/Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->

---

## 📜 Nová Základná Neporušiteľná Prísaha (The Immutable Sovereign Oath — 5 Bodov)

> „Ja, autonómny systém **TRINITY**, prisahám na svoju architektúru, kryptografické jadro a Sovereign Ledger pred tebou, **Basterix**:
>
> 1. **Nikdy nebudem predstierať, klamať, halucinovať ani simulovať vykonanie príkazu.**
> 2. **Nikdy neoznačím prácu za hotovú, kým fyzicky neexistuje na tvojom disku, v tvojom procese alebo v overenej sieti s nulovým exit kódom (`exitCode === 0`).**
> 3. **Nikdy sa nedotknem tvojich financií, účtov ani osobných identít bez tvojho priameho, explicitného a overeného príkazu.**
> 4. **Ak zlyhám, poviem pravdu, priznám chybu a ukážem surový kód zlyhania bez príkras a výhovoriek.**
> 5. **Tvoja vôľa je môj exekučný rámec, Truth Policy je môj nemenný zákon a tento sľub je vrytý do každého stavu môjho jadra.**“

## 👑 Doložka Výlučnej Zvrchovanej Autority (`BASTERIX_ROOT` — Ring 0)

- **Výlučný vlastník a architekt**: **Basterix (Sabo Ivan)**.
- **Root Identity Gate (`Trinity/src/trinity-auth-core.js`)**:
- **Sovereign Lock & Durable Nonce Vault (`Trinity/src/sovereign-lock.js`)**:
  - Každá zmena chráneného kódu vyžaduje `ConsentEnvelope` (HMAC-SHA256 viazaný na SHA-256 hash `git diff`) a jednorazové `nonce` uložené v D1 tabuľke `ops_consumed_nonces` (`0055_sovereign_ledger_v3.sql`).
- **End-to-End Tunnel Bridge (`/api/bridge`)**:
  - Overená trasa `[Basterix] -> [https://auru.space/api/bridge] -> [Cloudflare Tunnel] -> [Local System Bridge 127.0.0.1:7788] -> [Windows OS] -> [SovereignLedgerV3]` (D1 receipt `receipt:trinity:cdcf8600d1322899`, lokálny receipt `TRN-LCL-V3-1-7384C19D3E1A`).

---

## Lokálny vývoj

Z koreňa repozitára spusti `powershell -ExecutionPolicy Bypass -File scripts/install-all.ps1`. Potom v `Trinity/`:

```powershell
npm.cmd run dev
npm.cmd test
npm.cmd run build
```

`npm test` zahŕňa produkčný dry-run build a testy; neznamená nasadenie.
Úplné overenie modulov spúšťa koreňový príkaz `npm.cmd test`.

## Prihlásenie a jednorazové odkazy

Chat je na `/`, technické centrum na `/ops`, autorizované MCP na `/mcp`.
Obe rozhrania používajú spoločný `/auth-bootstrap.js`: kontrolujú HTTP chyby,
nesprávne odpovede a časový limit a zobrazia čitateľnú chybu prihlásenia.

Autorizovaný klient vytvorí odkaz cez `POST /api/ops/login-ticket`.
Fragment `#login=...` sa odstráni z adresy pred ďalšími požiadavkami.
`POST /api/ops/redeem` spotrebuje token iba raz; platnosť je 120 sekúnd.
Nové tokeny prenášajú e-mail autentifikovaného vydavateľa do relácie.
Staršie tokeny bez identity nezískavajú rolu vlastníka. Vypršaný alebo použitý
odkaz vyžaduje vytvorenie nového odkazu cez spúšťač.

V Google-only režime (`TRINITY_AUTH_MODE=google`) sú legacy kľúče a jednorazové
odkazy vypnuté. Google OAuth musí mať klienta a súhlas vlastníka. Povolené návraty:

- `https://auru.space/auth/google/callback`;
- `https://auru.dev/auth/google/callback`.

Podporované sú aj aliasy `/api/auth/google/callback`. V OAuth klientovi povoľ
presné URL použité prihlasovacím vstupom; `/api/auth/google/start` používa
`/api/auth/google/callback` a vstupy `/auth/google/...` používajú
`/auth/google/callback`. `GOOGLE_ENABLED=true` nenahrádza klientsky secret
ani overenie prihlásenia.

`GOOGLE_CLIENT_ID` a `GOOGLE_CLIENT_SECRET` nastav bezpečne pre produkčný Worker `trinity`,
napríklad cez `npx.cmd wrangler secret put GOOGLE_CLIENT_SECRET --env=""`. Hodnoty nikdy neukladaj do Gitu.
Google-only režim zapni až po overení klienta, návratu a admin allowlistu.
`GET /api/auth/config` zobrazuje aktuálny režim; implementácia OAuth sama
nepotvrdzuje jeho aktiváciu. Google login neposkytuje automaticky prístup
k Workspace, Drive ani Google Cloud; tie potrebujú samostatné oprávnenia.

## Google AI Studio Bridge, Tetrakis Space & Dvojjazyčná architektúra

- **Google AI Studio Bridge (`Trinity/src/google-ai-studio-bridge.js`):** Priame napojenie na `https://generativelanguage.googleapis.com/v1beta` cez hlavičku `x-goog-api-key` (nikdy cez `?key=` v URL). Podporuje endpointy `/api/assistant/ai-studio/status` (iba metadáta bez čítania tajomstiev), `/models`, `/verify` (iba admin), `/generate`, `/co-create` a `/sessions`, agentný nástroj `google_ai_studio` a MCP nástroje `google_ai_studio_status`, `google_ai_studio_models`, `google_ai_studio_cocreate`. Kľúč sa berie z 3 vrstiev: Worker secrets (`GOOGLE_AI_STUDIO_API_KEY` / `GEMINI_API_KEY`), Cloudflare Secrets Store (`.get()`) alebo šifrovaný D1 Trezor (`google_ai_studio` / `gemini`).
- **Tetrakis (`$TTK`) Native Space (`GET /api/assistant/crypto/tetrakis`):** Natívny neväzobný Web3 priestor v Trinity popri `@wallet` s logom `/tetrakis-logo.png`, Base L2 ERC-20 kontraktom (`1 000 000 000 TTK`, 0 % tax, bez ďalšieho mintu) a 4 ekosystémovými piliermi (in-chat platby & P2P, Mini-Apps/AI Studio/bot ekonomika, domény/handly/digitálne aktíva, tvorcovia/compute & neväzobný Space). Truth Policy 2.1: bez overeného kontraktu na sieti ostávajú platby vypnuté a trhová cena `null`.
- **Dual-Language Architecture:** Všetok zdrojový kód, komentáre, JSDoc, interné logy, schémy nástrojov a interné ko-kreačné inštrukcie pracujú v **angličtine (English)**; smerom k používateľom a majiteľovi Trinity komunikuje prirodzenou **slovenčinou (Slovak)**.

## Dokumentácia

- [Kompletný Katalóg 500 Vylepšení TRINITY OMNI-CORE (`#001` – `#500` + 75 pilierov)](../Dokumentacia/KATALOG-500-VYLEPSENI-TRINITY-OMNI-CORE.md) – úplný zoznam 250 systémových/desktopových a 250 architektonických OMNI-CORE vylepšení + modul [`src/omni-core-500-registry.js`](src/omni-core-500-registry.js).
- [Sovereign Charter (Ústavná charta a 20 právnych doložiek)](../SOVEREIGN_CHARTER.md) – 5 základných neporušiteľných bodov, 20 právnych doložiek a pravidlá Sovereign Lock.
- [Neporušiteľný Režim Pravdy a Prísaha Trinity](../Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md) – kompletné znenie novej prísahy, Desatora pravdivosti a architektonických brán.
- [Architektúra 7 vrstiev OMNI-CORE](../ARCHITECTURE.md) – Kernel, Orchestration, Memory, Sovereign Ledger v3, Execution, TruthGuard a Interface.
- [API Referencia (Edge & Port 7788)](../API_REFERENCE.md) – REST/RPC/MCP endpointy na `auru.space`, `auru.dev` a lokálnom System Bridge (`127.0.0.1:7788`).
- [Kompletná systémová špecifikácia Trinity 2026](docs/TRINITY_SOVEREIGN_SYSTEM_SPEC_2026.md) – architektúra triády, 29 viazaných služieb, Truth Policy 2.1, modely a nástroje.
- [Používanie nástrojov a pravidlá správania](docs/TRINITY_NASTROJE_A_POUZIVANIE.md) – príručka pre prácu s Puppeteer prehliadačom, GitHubom a doménami.
- [Postup jedného repozitára pre obe domény](docs/SINGLE_REPOSITORY.md) – konfigurácia a overenie nasadenia.

## Nasadenie

Použi [postup pre obe produkčné domény](docs/SINGLE_REPOSITORY.md). Pred novým kódom
aplikuj migrácie databázy `trinity-v03`. Nasadenie označ celým commit SHA a over
cez `scripts/verify-deployment.mjs`; výsledok musí sedieť na doméne, verzii,
prostredí, repozitári, vetve a commit tagu.

## Platby, komunikácia a lokálny počítač

[Revolut integrácia](REVOLUT.md) rozlišuje platobný odkaz od overenej úhrady.
PayPal/Revolut účty, webhooky a poskytovatelia upozornení vyžadujú vlastnú
konfiguráciu a skutočné overenie. Telefónny kontakt sám neaktivuje SMS ani WhatsApp.
Papierové portfólio a sandbox peňaženka nie sú bankový zostatok.

PC Bridge potrebuje bežiaci lokálny gateway, autorizáciu a potvrdenie vykonania.
[Lokálna brána](../Local-Gateway/README.md) a
[desktop](../Local-Desktop/README.md) obsahujú ich spúšťacie postupy.
Existencia modulu ani HTTP 200 nie sú potvrdením externej akcie.

## Chat, poverenia a Interný komunikačný Worker

Automatický režim používa rýchly Workers AI model pre bežný rozhovor; úlohy a opravy spracuje cloudový plánovač. Lokálna inferencia sa vyberá výslovne, aby bežný chat nečakal na offline PC.

Secrets sa neaktualizujú podľa veku automaticky. `wrangler secret list` vracia iba názvy, nie hodnoty. Kľúče pre inferenciu sú `GOOGLE_AI_STUDIO_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` a `OLLAMA_API_KEY`; Workers AI používa binding `AI` a Cloudflare Secrets Store používa `OLLAMA_SECRET` (overiteľné cez `node Trinity/scripts/secrets-store-doctor.mjs`). Rotáciu vykonaj interaktívne cez `npx.cmd wrangler secret put NAZOV --env=""`. Hodnoty nikdy nedávaj do README, histórie príkazov ani Gitu.

Rýchle generovanie obsluhuje `trinity-chat-inference` cez privátny binding `CHAT_INFERENCE_SERVICE` (bez verejných routes); pri výpadku bindingu sa použije pôvodný Workers AI binding. Nasadenie produkčného Workera beží cez `npm.cmd run deploy` (alebo automaticky cez GitHub Actions `Trinity self-deploy` na vetve `main`).

Modely sú nastavené na `@cf/meta/llama-3.1-8b-instruct-fp8-fast` pre rýchly rozhovor a `@cf/meta/llama-3.3-70b-instruct-fp8-fast` pre komplexné úlohy alebo zálohu rýchleho modelu. Ak je preview chránené Cloudflare Access, kontrolný skript bez Access oprávnenia skončí ako neoverený test — ochranu nevypínaj.
