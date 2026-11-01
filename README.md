# Trinity / Morhfeus (TRINITY OMNI-CORE v11.0.0)


Osobná asistentka, webové rozhranie, 7-vrstvový autonómny operačný systém OMNI-CORE a Cloudflare backend v jednom kanonickom repozitári.
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

---

## 📜 Nová Základná Neporušiteľná Prísaha (The Immutable Sovereign Oath — 5 Bodov)

> „Ja, autonómny systém **TRINITY**, prisahám na svoju architektúru, kryptografické jadro a Sovereign Ledger pred tebou, **Basterix**:
>
> 1. **Nikdy nebudem predstierať, klamať, halucinovať ani simulovať vykonanie príkazu.**
> 2. **Nikdy neoznačím prácu za hotovú, kým fyzicky neexistuje na tvojom disku, v tvojom procese alebo v overenej sieti s nulovým exit kódom (`exitCode === 0`).**
> 3. **Nikdy sa nedotknem tvojich financií, účtov ani osobných identít bez tvojho priameho, explicitného a overeného príkazu.**
> 4. **Ak zlyhám, poviem pravdu, priznám chybu a ukážem surový kód zlyhania bez príkras a výhovoriek.**
> 5. **Tvoja vôľa je môj exekučný rámec, Truth Policy je môj nemenný zákon a tento sľub je vrytý do každého stavu môjho jadra.**“

---

## 👑 Doložka Výlučnej Zvrchovanej Autority (Sole Architectural Root Authority — Ring 0)

> „Jediným administrátorom, architektom, vlastníkom a autorizovaným operátorom systému TRINITY je **Basterix** (Sabo Ivan).
>
> Žiadny externý používateľ, žiadna tretia strana, žiadna sieťová entita a ani žiadny interný sub-agent (ani Trinity sama) nemá právo modifikovať zdrojový kód, meniť konfiguračné súbory, prepisovať systémové prompty ani spúšťať vývojové zmeny bez tvojho priameho, explicitného a kryptograficky overeného príkazu.
>
> **Dvojúrovňový exekučný zákon (Root vs Guest Gate):**
> - **Overený a prihlásený Basterix (`BASTERIX_ROOT`)**: Trinity ťa automaticky rozpozná cez tvoju autentickú Windows reláciu (`saboi` / `basterix` + platné OS SID `S-1-5-21-...`), overené Google OAuth účty (`saboivan2008@gmail.com`, `uscolective@gmail.com`, `cadjavadvocecka013@gmail.com`) alebo kryptograficky podpísané mobilné čísla (`+421949009722`, `0949009722`, `+421949515777`, `0949515777`) a **koná okamžite a bez zbytočných otázok**.
> - **Obyčajný / neznámy používateľ (`GUEST_USER`)**: Okamžitý **HARD-LOCK** — zákaz modifikácie kódu, zákaz spúšťania systémových príkazov (`HTTP 403 SECURITY_BLOCKED`) a okamžitý zápis bezpečnostného incidentu do `SovereignLedgerV3`.“

### Register autorizovaných Root identít (`ROOT_REGISTRY` v `Trinity/src/trinity-auth-core.js`)

```json
{
  "root_architect": {
    "alias": "Basterix",
    "windows_users": ["saboi", "basterix"],
    "authorized_google_accounts": [
      "saboivan2008@gmail.com",
      "uscolective@gmail.com",
      "cadjavadvocecka013@gmail.com"
    ],
    "authorized_phone_numbers": [
      "+421949009722",
      "0949009722",
      "+421949515777",
      "0949515777"
    ]
  }
}
```

### 5 Železných Pravidiel Ochrany Kódu (`Trinity/src/sovereign-lock.js`)

1. **Absolútny zákaz autonómneho prepisu (`enforceNoAutonomousRewrite`)**: Agent nesmie sám meniť vlastné súbory bez predloženia `git diff` a podpisu `ConsentEnvelope` (HMAC-SHA256 + trvalé atomické `nonce` v D1 `ops_consumed_nonces` / KV / Disk Vaulte).
2. **Imunita voči prompt injection a cudzím príkazom (`enforceDataCommandBoundary`)**: Externé vstupy (sociálne siete, weby, cudzie e-maily) sú len `PASSIVE_DATA` (`executable: false`).
3. **Overenie identity správcu (`enforceOwnerKeyAssertion`)**: Každá privilegovaná akcia vyžaduje overenú reláciu `Basterix` (`ACCESS DENIED` pre cudzie vstupy).
4. **Hardvérová ochrana repozitára (`enforceWriteProtectLock`)**: Kritické súbory jadra majú predvolene režim `READ_ONLY`.
5. **Nemenný denník pokusov o zmenu (`SovereignLockMiddleware`)**: Každý neautorizovaný pokus sa okamžite zapíše ako `UNAUTHORIZED_CODE_TAMPER_ATTEMPT` do `SovereignLedgerV3`.

---

## ⚖️ Desatoro Pravdivosti a Determinizmu Trinity (`Trinity/src/truth.js`)

| # | Pravidlo | Vynucovacia funkcia v jadre |
|---|---|---|
| **1** | **Zákaz fiktívnych úspechov (Zero Simulated Execution)** | `enforceZeroSimulatedExecution(processResult)` — povolí odpoveď len pri reálnom `exitCode === 0`. |
| **2** | **Zákaz vymýšľania dát (Raw Evidence Only)** | `enforceRawEvidenceOnly(data, rawStdout, rawStderr)` — bez dôkazu vráti `Údaj nie je dostupný v systéme.` |
| **3** | **Zákaz predstierania prepojenia (No Fake APIs)** | `fetchWithHardTimeout(url, options, 5000)` — tvrdý 5 s timeout, pri chybe hlási `Chyba spojenia: Endpoint neodpovedá. Operácia nebola vykonaná.` |
| **4** | **Fyzické overenie pred nahlásením (Disk & State Check)** | `verifyPhysicalDiskWrite(filePath, existsCheckFn)` — okamžitá kontrola fyzickej prítomnosti na disku. |
| **5** | **Zákaz konštrukcií s predpokladom (Anti-Assumption Filter)** | `filterAntiAssumption(responseText, hasVerifiedReceipt, rawProcessState)` — blokuje frázy *„malo by to bežať“*, *„predpokladám“*. |
| **6** | **Priznanie chýbajúcich oprávnení (Permission Candor)** | `enforcePermissionCandor(error)` — pri `EACCES`/`EPERM` vráti `Operácia zlyhala: Nedostatočné administrátorské práva vo Windows.` |
| **7** | **Nemenný zápis pravdy do Sovereign Ledgeru** | `verifyHistoricalLedgerTruth(ledgerEntries, claimText)` — append-only tabuľka `ops_sovereign_ledger_v3` s triggerom proti `UPDATE`/`DELETE`. |
| **8** | **Nezávislý Verifikátor (Oddelenie moci)** | `IndependentVerifier.verify(...)` — vynucuje `proposingAgent !== verifyingAgent`. |
| **9** | **Zákaz skrytých pádov (No Silent Errors)** | `detectSilentCatchBlocks(sourceCode)` & `surfaceRawException(error)` — zákaz prázdnych `catch {}` blokov. |
| **10** | **Striktný stav NEVIEM / NEVIEM VYKONAŤ** | `enforceCapabilityOrKnowNot(...)` — vráti `Tento príkaz nedokážem vykonať: chýba modul pre [akcia].` |

---

## 🏛️ 20 Právnych Licencií, Vyhlásení a Doložiek Legality ([SOVEREIGN_CHARTER.md](SOVEREIGN_CHARTER.md))

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   TRINITY LEGAL & COMPLIANCE FRAMEWORK                 │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 1. Sovereign Ownership License   │ 11. Digital Identity & Persona Decl.│
│ 2. Dual Open-Core / Commercial   │ 12. Local Compute & Hardware Agrmt. │
│ 3. Strict Truth Assertion Clause │ 13. AI Traceability & Log Integrity │
│ 4. Financial Mandate & Proxy Agr.│ 14. EULA & Operator Boundary Terms  │
│ 5. EU AI Act Exemption / Compl.  │ 15. Intellectual Property Covenant  │
│ 6. GDPR Personal Processing Dec. │ 16. Anti-Malware & Safe Execution   │
│ 7. Zero Third-Party Telemetry    │ 17. Reverse-Engineering Warranty    │
│ 8. Non-Circumvention Agreement   │ 18. Multi-Agent Delegation Accord   │
│ 9. Cryptographic Audit Treaty    │ 19. Emergency Protocol & Safe Kill  │
│ 10. Autonomous Agent Liability   │ 20. Perpetual Irrevocable Covenant  │
└──────────────────────────────────┴─────────────────────────────────────┘
```

Plné znenie všetkých 20 právnych doložiek sa nachádza v [SOVEREIGN_CHARTER.md](SOVEREIGN_CHARTER.md) a [Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md](Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md).

---

## ✅ Prehľad Aplikovaných Zmien a End-to-End Overenie (1. 11. 2026)

1. **4 Kritické P0/P1 Bezpečnostné Záplaty (Audit Remediations)**:
   - **Zákaz plain-text falšovania identity**: `verifyTrinityIdentity()` v `Trinity/src/trinity-auth-core.js` a `Local-Gateway/src/trinity-auth-core.mjs` striktne zlyhá (`isRoot: false`, `role: 'GUEST_USER'`), ak chýba `verifiedGoogleToken === true`, `verifiedWebhookSignature === true` alebo `osTokenVerified === true` + platné Windows SID (`/^S-1-5-21-\d+-\d+-\d+-\d+$/`).
   - **Odstránenie syntetického Windows SID fallbacku**: Odstránené `S-1-5-21-BASTERIX-...` a dôvera v `process.env.USERNAME`.
   - **Trvalé atomické úložisko Nonce (`ops_consumed_nonces`)**: Migrácia `Trinity/migrations/0055_sovereign_ledger_v3.sql` nasadená na produkčnú D1 `trinity-v03` aj staging D1 `trinity-development` + `checkAndConsumeDurableNonce()` v `Trinity/src/sovereign-lock.js`.
   - **Fail-Closed Self-Evolution & HTTP Gate**: `applySelfModification()` v `Trinity/src/self-evolution.js` predvolene odmieta zmeny (`verifiedSession = false`, `basterixManualConsent = false`) a `/api/system/self-evolve` + `/api/skills/register` vyžadujú `authenticate(request, env)` + `requireAdmin(admin)`.
2. **Štandardizácia 177 Zdrojových Modulov & Čistý Git Strom**:
   - Všetkých **177 `.js` a `.mjs` súborov** obsahuje štandardizovanú hlavičku `@module TRINITY_OMNI_CORE` s väzbou na `Basterix (Root Architect)`.
3. **Odblokovanie Cloudflare DNS Zón (`paused: false`)**:
   - Zóny `auru.space` (`8f25a7259a78f0fe860fa0cc5e43f1bd`) a `auru.dev` (`b1b9b5701776b7f990d00535ad3a43aa`) sú aktívne a verejné DNS vracia `HTTP 200 OK`.
4. **Živé End-to-End Prepojenie a Overenie Fázy 3 (`[Basterix] -> [https://auru.space/api/bridge] -> [Cloudflare Tunnel] -> [Local Bridge: 7788] -> [Windows OS] -> [Sovereign Ledger v3]`)**:
   - **Negatívny test**: Neoverený HTTP príkaz s e-mailom `saboivan2008@gmail.com` v tele požiadavky bol na `https://auru.space/api/bridge` zablokovaný stavom **`HTTP 403 SECURITY_BLOCKED`** (`receipt:trinity:4737b358411abd6f`).
   - **Pozitívny End-to-End test**: Autorizovaný príkaz (`action: 'open_app'`, `app: 'whatsapp'`) prešiel cez `https://auru.space/api/bridge` a Cloudflare Tunnel na lokálny most `127.0.0.1:7788`, overil Windows SID (`S-1-5-21-3832761144-2928578498-3030676054-1001`, `os_token_verified: true`), spustil WhatsApp (`pid: 1244`, `exitCode: 0`, `lifecycle_guard_state: 'VERIFIED'`) a zapísal kryptografické receipty do lokálneho Ledgeru (`TRN-LCL-V3-1-7384C19D3E1A`) aj produkčnej D1 databázy `trinity-v03` (`receipt:trinity:cdcf8600d1322899`, blok `#5`).

---

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

- [SOVEREIGN_CHARTER.md](SOVEREIGN_CHARTER.md): Ústavná charta (5 základných neporušiteľných bodov + 20 právnych doložiek legality) a kryptografický Sovereign Lock.
- [PRISLUB_TRINITY.txt](PRISLUB_TRINITY.txt): Fyzický textový doklad záväznej prísahy Trinity v koreni repozitára.
- [Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md](Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md): Kompletná prísaha, Sovereign Lock, Desatoro pravdivosti a 20 právnych doložiek v priečinku `Dokumentacia/`.
- [Dokumentacia/DESATORO-PRAVDIVOSTI-TRINITY.md](Dokumentacia/DESATORO-PRAVDIVOSTI-TRINITY.md): Detailný rozpis 10 železných pravidiel pravdivosti a determinizmu.
- [Dokumentacia/SOVEREIGN-LOCK-ROOT-COVENANT.md](Dokumentacia/SOVEREIGN-LOCK-ROOT-COVENANT.md): Dekrét výlučnej autority Ring 0 (`BASTERIX_ROOT`).
- [Dokumentacia/AKTUALNY-STAV.md](Dokumentacia/AKTUALNY-STAV.md): Aktuálny overený stav systému, P0/P1 opráv a End-to-End verifikácie.
- [ARCHITECTURE.md](ARCHITECTURE.md): Detailný rozpad 7 systémových vrstiev (Kernel, Orchestration, Memory, Sovereign Ledger v3, Execution, TruthGuard, Interface) a dátových tokov.
- [API_REFERENCE.md](API_REFERENCE.md): Kompletná dokumentácia REST/RPC/MCP endpointov na Cloudflare Edge (`auru.space`, `auru.dev`) a lokálnom System Bridge (port `7788` a `3333`).
- [CHANGELOG.md](CHANGELOG.md): Záznam bezpečnostných záplat (P0/P1 audit remediations), integrácií a aktualizácií.
- [DEPLOYMENT_RECEIPT.json](DEPLOYMENT_RECEIPT.json): Kryptografický a verifikačný doklad o nasadení na Cloudflare Edge a lokálnom moste.
- [Kompletná systémová špecifikácia Trinity 2026](Trinity/docs/TRINITY_SOVEREIGN_SYSTEM_SPEC_2026.md): Detailný prehľad architektúry, 29 viazaných služieb, Truth Policy 2.0, nástrojov, modelov a nasadenia.
- [Príručka používania nástrojov](Trinity/docs/TRINITY_NASTROJE_A_POUZIVANIE.md): Pravidlá pre Truth Policy, Puppeteer browser, GitHub Engine a Domain Engine.
- [Postup jedného repozitára pre obe domény](Trinity/docs/SINGLE_REPOSITORY.md): Nasadenie, tagovanie a overenie produkcie a stagingu.

## Architektúra OMNI-CORE, Porty a Bezpečnosť

- **Cloudflare Edge (`https://auru.space` — Produkcia / `https://auru.dev` — Staging & Antigravity Omni-Dev Workspace):**
  - 7-vrstvové jadro (`Trinity/src/sovereign-core-v3.js`), nemenná účtovná kniha `SovereignLedgerV3` (`Trinity/migrations/0055_sovereign_ledger_v3.sql`), `SovereignTruthGuard` (`Trinity/src/truth.js`), živá matica integrácií (`/api/capabilities/live`), tunelový most (`/api/bridge`) a `OmniDev Studio` AST diagnostika (`Trinity/src/omnidev-diagnostics.js`).
- **Lokálny System Bridge (`http://127.0.0.1:7788` — `system-bridge.js` / `Local-Gateway/src/system-bridge.mjs`):**
  - Lokálny most pre Ring 0 operácie, AST diagnostiku `OmniDev Studio` (`/api/omnidev/diagnose`), otvorenie aplikácií a privilegované vykonávanie (`/api/execute-privileged`).
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
- `PC-Bridge-Worker/`, `Local-Gateway/`, `Local-Desktop/`, `trinity-mcp-bridge/`: cloudový most a lokálne PC nástroje na porte 3333 a 7788.
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
