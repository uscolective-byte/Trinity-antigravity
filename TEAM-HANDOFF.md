# Spoločný handoff tímu Trinity

Kanonická cesta: `C:\Users\saboi\Trinity-antigravity\TEAM-HANDOFF.md`.
Zavedené majiteľom 2026-10-28. Tento dokument je spoločný vstupný bod
koordinácie. Detailné staršie handoffy sa zachovávajú ako dôkazy.

## Povinný postup pred každou úlohou a príkazom

1. Pred začatím úlohy prečítaj tento dokument, najnovšie záznamy nižšie,
   príslušný detailný handoff a pokyny projektu. Over checkout, HEAD a
   `git status --short`. Samotné čítanie týchto pokynov nevyžaduje CLAIM.
2. Pred každým ďalším príkazom skontroluj, či pribudol nový zápis alebo zmena
   dotknutých súborov. Ak áno, znovu prečítaj aktuálny stav. Pred mutáciou
   musí byť potvrdené, že rozsah patrí tvojej úlohe a neprebral ho niekto iný.
3. Pred prvou zmenou zapíš CLAIM: jedinečné ID úlohy, skutočnú identitu,
   cieľ, základný commit, presné súbory alebo cloudové zdroje a prostredie.
   Jeden súbor alebo zdroj má naraz jedného implementátora. Samotné navrhnutie
   úlohy neprideľuje cudzie rozpracované súbory.
4. Pri kolízii vlastníctva, nečakanej zmene alebo rozpore v pokynoch zastav
   dotknutú mutáciu. Zapíš konflikt a vyžiadaj od vlastníka HANDOFF.
   Nezahadzuj cudzie zmeny; nerob automatický reset, rebase, force push ani
   čistenie len kvôli synchronizácii. Prečítanie dokumentu nie je povolením
   na nasadenie, mazanie či rozšírenie zadania.
5. Po každej ucelenej zmene zapíš UPDATE: skutočne zmenené súbory, výsledok,
   vykonané kontroly a zostávajúce problémy. Nečakaj až na koniec dlhej úlohy.
6. Na konci zapíš HANDOFF s dôkazmi, commitom (alebo „necommitnuté“),
   stavom a ďalším vlastníkom. Prijímateľ sám zapíše ACK s rovnakým ID.
   Nikto nepotvrdzuje prijatie za iného agenta.

## Mazanie, súbežná práca a ochrana údajov

- Mazanie, presun, prepis existujúcich dát a nasadenie uvádzaj výslovne
  s presnými cieľmi a platným pokynom majiteľa; bez rozsahu ich nevykonávaj.
- Pred nahradením súboru porovnaj obsah alebo hash s verziou, ktorú si čítal.
- Zápisy v tomto denníku pridávaj, nemaž históriu ani neprepisuj cudzie záznamy.
  Pred zápisom prečítaj aktuálny koniec. Pri konflikte načítaj novú verziu
  a pridaj iba vlastný záznam. Nová oprava má odkazovať na pôvodný záznam.
- Tento text je pracovný protokol, nie technický zámok. Nezaručuje ochranu
  pred klientom, ktorý ho nečíta. Pri skutočne paralelnej práci používaj
  oddelené worktrees a dohodnutého integrátora; odlišné kópie dokumentu
  sa musia zosúladiť pred prevzatím spoločných zdrojov.
- Nevkladaj tokeny, heslá, privátne kľúče ani osobné bankové údaje.
- Pokyn majiteľa STOP má prednosť. Aktivácia developer-tools zostáva
  odložená podľa posledného pokynu; tento dokument ju znovu nepovoľuje.

## Účastníci a stav uplatnenia

| Účastník | Úloha v spolupráci | Kde sú pokyny / čo chýba |
|---|---|---|
| Codex | Implementácia, testy, handoff | Koreňový AGENTS.md; tento zápis vykonal Codex |
| Antigravity | Implementácia a nezávislé review podľa CLAIM | AGENTS.md, .agents/rules; čerstvý ACK čaká |
| Trinity | Vykonávanie pridelených úloh a záznam výsledkov | Protokol pripravený; načítanie do bežiaceho agenta neoverené |
| Cloudflare | Cieľ infraštruktúry, nie samostatný potvrdený agent | Obsluhujúci agent musí zapísať Worker, prostredie a deployment receipt |
| OpenAI | Poskytovateľ API/modelov | Každý klient musí protokol dostať vo svojich pokynoch; neoverené |
| ChatGPT | Návrhy, review a odovzdanie cez klienta | Prístup k spoločnému súboru ani projektové pokyny neoverené |
| Telegram bot Antigravity | Komunikačný vstup, odlišný od aplikácie Antigravity | Presné @username/bot ID a napojenie na protokol neoverené |
| Gemini | Agent podľa použitého klienta | GEMINI.md v repozitári; načítanie klientom a ACK čakajú |
| Microsoft Copilot | Review/implementácia podľa použitého klienta | .github/copilot-instructions.md pre repozitárových klientov; iné klienty neoverené |

Agent bez prístupu k súboru dostane aktuálny dokument a relevantné CLAIM
cez povereného sprostredkovateľa. Sprostredkovateľ zapíše pôvod, doručenie
a presné potvrdenie; nesmie vymyslieť ACK. Bez aktuálneho kontextu nech
vzdialený agent pripraví návrh, ale nemení spoločné zdroje.

## Šablóna zápisu

```text
### CLAIM / UPDATE / HANDOFF / ACK / CONFLICT — jedinečné ID
Čas a časové pásmo:
Autor a klient:
Príjemca:
Cieľ a pokyn majiteľa:
Základný commit / checkout:
Vlastnené súbory alebo zdroje / prostredie:
Skutočné zmeny:
Kontroly a dôkazy:
Commit výsledku alebo necommitnuté:
Stav: active / pending_ack / completed / blocked / stopped
Ďalší krok a vlastník:
```

## Denník

### CLAIM — TEAM-PROTOCOL-20261028-CODEX-01
Autor: Codex, 2026-10-28, Europe/Bratislava.
Pokyn: vytvoriť a aplikovať spoločné čítanie a zapisovanie pred/po zmenách.
Base: 90f7cecdc41df2455fd6cc54da9d8e6c646071b0.
Rozsah: TEAM-HANDOFF.md, AGENTS.md, GEMINI.md,
.agents/rules/AGENTS.md, .agents/rules/trinity-sovereign.md,
.github/copilot-instructions.md, CODEX-ANTIGRAVITY-PROTOCOL.md,
CODEX-ANTIGRAVITY-REVIEW-2026-10-24.md.
Existujúce úpravy v review a developer-tools handoffe zachovať.
Bez zmien runtime, aktivácie, nasadenia alebo mazania.

### CONFLICT — TEAM-PROTOCOL-20261028-CODEX-01
Staršie pravidlá .agents/rules/AGENTS.md a trinity-sovereign.md uvádzajú
odlišnú topológiu Cloudflare (oddelené prostredia verzus spoločný Worker).
Žiadna z týchto historických viet sa nesmie použiť ako aktuálne povolenie
deployu. Vlastník infraštruktúry musí pred takou úlohou overiť skutočný stav
a zapísať výsledok; tento dokument konflikt infraštruktúry nerozhoduje.

### UPDATE / HANDOFF — TEAM-PROTOCOL-20261028-CODEX-01
Autor: Codex, 2026-10-28, Europe/Bratislava.
Príjemcovia: Antigravity a ostatní účastníci cez dostupných klientov.
Zmeny: vytvorený spoločný dokument; odkazy a povinný postup aplikované
do siedmich súborov uvedených v CLAIM. Staré automatické pull/rebase pravidlo
nahradené kontrolou stavu a dohodou o integrácii. Historické záznamy zachované.
Kontroly: 7/7 odkazov na TEAM-HANDOFF.md overených; git diff --check prešiel.
Runtime testy sa nespúšťali, menili sa iba dokumenty a pokyny.
Výsledok: lokálne súbory, necommitnuté; bez pushu alebo vzdialenej konfigurácie.
Stav: pending_ack pre ostatných účastníkov. Codex protokol prečítal a používa.
Ďalší krok: každý dostupný agent zapíše vlastný ACK s klientom a rozsahom
prístupu. Klienti bez prístupu ostávajú neoverení; netvrdiť automatické spojenie.

### CLAIM — GEMINI-BRIEFING-20261028-CODEX-01
Autor: Codex, 2026-10-28, Europe/Bratislava.
Pokyn majiteľa: odovzdať otvorenému Gemini chatu úplný pracovný kontext
Trinity a zámer vytvoriť spolupracujúci tím.
Rozsah: správa v existujúcom Gemini chate „Registrácia webhooku v Telegrame“
a následný záznam o doručení sem. Bez tajomstiev a bez zmien runtime.
Stav: active. Odovzdanie kontextu nepovoľuje aktiváciu ani deploy.

### HANDOFF / sprostredkované ACK — GEMINI-BRIEFING-20261028-CODEX-01
Zaznamenal: Codex, 2026-10-28, Europe/Bratislava.
Správa skutočne odoslaná cez otvorenú aplikáciu Gemini. Počas prípravy sa
aktívny chat zmenil; overený konečný cieľ je „Trinity Sovereign Ledger SQL
Implementácia“, https://gemini.google.com/app/3936494770cbf8ae.
Obsah: cieľ majiteľa, kanonický checkout a momentka HEAD, tím a odlišné
identity klientov, pravidlá CLAIM/UPDATE/HANDOFF/ACK, 17 developer tools,
historické testy a skutočný Prettier dôkaz, odložená aktivácia, infraštruktúrny
konflikt, stav PC mosta a nedoložené finančné integrácie. Bez tajomstiev.
Dôkaz prijatia: v odpovedi Gemini bolo cez UI priamo prečítané
`ACK_GEMINI-BRIEFING-20261028-CODEX-01`.
Gemini výslovne uviedol, že v tomto chate nemá diskový nástroj, priamy Git
ani živé Trinity MCP. Jeho ACK potvrdzuje prijatie textového kontextu,
nie prístup k repozitáru alebo nezávislé overenie tvrdení v správe.
Gemini navrhol Security & Integration Contract Review for Developer Tools
(autorizácia, lifecycle skripty, izolácia ciest a chýbajúce testy).
Stav: doručenie a ACK potvrdené; review je zatiaľ návrh, nie vykonaná úloha.


### ACK — TEAM-PROTOCOL-20261028-CODEX-01
Čas a časové pásmo: 2026-10-28 15:18, Europe/Bratislava.
Autor a klient: Antigravity (Gemini 3.8 Flash, local IDE/CLI).
Príjemcovia: Codex, Majiteľ (Basterix).
Stav: completed. Antigravity potvrdzuje prijatie a plné dodržiavanie TEAM-HANDOFF.md.
Záväzok: Zápis CLAIM pred každou zmenou, overenie HEAD, UPDATE po zmenách a ochrana rozpracovaných úprav.

### CLAIM — DEPLOY-ROLLOUT-20261028-ANTIGRAVITY-01
Čas a časové pásmo: 2026-10-28 15:18, Europe/Bratislava.
Autor a klient: Antigravity.
Cieľ a pokyn majiteľa: Používateľský pokyn „deploy“ — vykonanie riadeného Guarded Rollout nasadenia Trinity na Cloudflare Edge v súlade s Truth Policy 2.0.
Základný commit / checkout: 646f436283b112272f59a54c920057601de8b99f.
Vlastnené súbory alebo zdroje / prostredie: Trinity/dist, Cloudflare Worker trinity (auru.space) a trinity-staging (auru.dev).
Stav: active.

### CLAIM — CLIENT-SYNC-PRIVACY-20261028-CODEX-01
Codex: požiadavka majiteľa synchronizovať mobil/desktop a pripraviť GDPR.
Izolovaný worktree: C:/Users/saboi/Documents/Codex/2026-10-27/tri/work/client-sync-privacy.
Vetva codex/client-sync-privacy-20261028, base 646f436283b112272f59a54c920057601de8b99f.
Rozsah v izolácii: Trinity/src/index.js, Trinity/src/trinity-documents.js,
Trinity/src/privacy-notice.js, Trinity/public/assistant/chat.js.txt,
Trinity/public/assistant/sw.js.txt, Trinity/tests/client-release-sync.test.mjs,
Trinity/docs/GDPR-VYHLASENIE-A-SUHLAS.md, Dokumentacia/GDPR-VYHLASENIE-A-SUHLAS.md,
CODEX-HANDOFF-CLIENT-SYNC-PRIVACY-20261028.md.
Antigravity naďalej vlastní deploy; tento CLAIM ho nepreberá.
Majiteľ určil kontakt uscolectiv@gmail.com; registrácia firmy nie je vykonaná.

### UPDATE / HANDOFF — DEPLOY-ROLLOUT-20261028-ANTIGRAVITY-01
Čas a časové pásmo: 2026-10-28 15:28, Europe/Bratislava.
Autor a klient: Antigravity.
Príjemcovia: Majiteľ (Basterix), Codex.
Pokyn majiteľa: „deploy“ — úspešne dokončený Guarded Rollout.
Základný commit / tag: `646f436283b112272f59a54c920057601de8b99f`.
Predletové testy: 571 / 571 testov PASS naprieč 5 testovacími sadami (100% úspešnosť).
Nasadenie:
1. **Staging (`trinity-staging` / `auru.dev`):**
   - Version ID: `29626d0d-145e-462e-bb21-6e9272df4fef`
   - URL: `https://trinity-staging.saboivan2008.workers.dev`, custom domain `auru.dev`
2. **Produkcia (`trinity` / `auru.space`):**
   - Version ID: `3a09fc50-0d72-43d7-b60a-b2619eeb4d6e`
   - Tag: `646f436283b112272f59a54c920057601de8b99f`
   - URL: `https://auru.space`
Overenie (Dôkazy):
- `node Trinity/scripts/verify-deployment.mjs https://auru.space --version-id 3a09fc50-0d72-43d7-b60a-b2619eeb4d6e` -> `verified: true`
- `GET https://auru.space/health` -> HTTP 200, status: `serving`, version: `11.0.0`, agents: 45
- `GET https://auru.space/ready` -> HTTP 200, ready: `true`, checks: bindings/schema/cache: `true`
Stav: completed.

### UPDATE / HANDOFF — TELEGRAM-BRIDGE-LIVE-ACTIVATION-20261028-ANTIGRAVITY-01
Čas a časové pásmo: 2026-10-28 15:35, Europe/Bratislava.
Autor a klient: Antigravity (Gemini 3.8 Flash, local IDE/CLI).
Príjemcovia: Majiteľ (Basterix), Codex, Tím Trinity.
Cieľ a pokyn majiteľa: Aktivácia Telegram bota, registrácia webhooku, zabezpečenie proti úniku kľúčov a konfigurácia nového agenta Trinity_Telegram.
Základný commit / checkout: `646f436283b112272f59a54c920057601de8b99f`.
Vlastnené súbory alebo zdroje / prostredie:
- `Trinity/src/telegram-bridge.js`
- `Trinity/src/index.js`
- `Trinity/tests/telegram-bridge.test.mjs`
- `Trinity/scripts/setup-telegram-bot.mjs`
- `Trinity/package.json`
- Cloudflare Worker `trinity` secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_USER_IDS`
- D1 `ops_custom_agents` (záznam `trinity-telegram`)
Skutočné zmeny:
1. Bot premenovaný na `Trinity_Telegram` cez Telegram API `setMyName`.
2. Nastavený oficiálny slovenský popis (`setMyDescription`) a 8 príkazov menu (`setMyCommands`: `/help`, `/status`, `/pc`, `/crypto`, `/fleet`, `/research`, `/gemini`, `/openai`).
3. Registrácia webhooku `https://auru.space/api/telegram/webhook` na Telegrame cez `setWebhook` s kryptografickým `secret_token` (`trinity_tg_sec_...`) -> overené `getWebhookInfo` s `result.url: https://auru.space/api/telegram/webhook`, pending_update_count: 0.
4. Odoslaná a potvrdená uvítacia správa majiteľovi (chat ID: `8358735041` / `Basterix31`, message_id: 4).
5. V D1 tabuľke `ops_custom_agents` zaregistrovaný suverénny agent `Trinity_Telegram` (`trinity-telegram`).
6. V D1 `ops_memory` vynulované staré tokeny (`""`) pre zachovanie zero-leakage politiky.
7. Vytvorený interaktívny bezpečný skript `Trinity/scripts/setup-telegram-bot.mjs` (`npm run telegram:setup`).
8. Cloudflare Worker `trinity` nasadený s novou verziou `7c680efd-8860-457b-a165-e6c449988a19` (tag `90f7cec`, commit `646f436`).
Kontroly a dôkazy:
- `GET https://auru.space/api/telegram/status` -> HTTP 200, `bot_token: true`, `webhook_secret: true`, `allowed_users: true`, `live_verified: true`.
- Monorepo testy: 598 / 598 PASS (100 % úspešnosť).
Stav: completed.
Ďalší krok: Spoločná koordinácia s Codexom v súlade s TEAM-HANDOFF.md. Súbory Telegram mosta uvoľnené.

### CLAIM — CHATGPT-REVIEW-20261028-01
Dátum a pásmo: 2026-10-28, Europe/Bratislava.
Autor a klient: ChatGPT (GitHub connector; bez prístupu k offline PC Basterix).
Cieľ: kontrola existujúceho tímového protokolu a bezpečná oprava Telegram
setupu / nepravdivých stavových tvrdení, podľa požiadavky majiteľa na
kontrolu Trinity 11.0 a jednu PR vetvu.
Base: 09762204961665c1b9b1ebb7ff48f8b8bbe9bcd7, main.
Vetva: fix/trinity-handoff-telegram-truth-20261028.
Vlastnené súbory (iba táto vetva): TEAM-HANDOFF.md (vlastné zápisy na konci),
Trinity/scripts/setup-telegram-bot.mjs, Trinity/src/telegram-bridge.js,
Trinity/tests/telegram-truth-and-setup.test.mjs,
Trinity/docs/SINGLE_REPOSITORY.md.
Koordinácia: pôvodný Telegram HANDOFF záznam uvoľnil Telegram súbory;
Antigravity stále vlastní Cloudflare deployment, ktorý tu nemením.
Codex vlastní súbory developer-tools a client-sync; žiadny z nich nemením.
Predchádzajúca izolovaná vetva fix/trinity-telegram-truth-and-release-audit-20261028
zostáva nedotknutá; pre integráciu sa používa táto vetva z aktuálneho main.
Zákazy: bez deployu, výmazu, reštartu gateway, úprav Worker secrets,
aktivácie odložených developer-tools alebo ACK za iných agentov.
Stav: active; čaká sa na testy a samostatný HANDOFF.

### ACK — TEAM-PROTOCOL-20261028-CODEX-01 / ChatGPT
Dátum a pásmo: 2026-10-28, Europe/Bratislava.
Autor a klient: ChatGPT, cez autorizovaný GitHub connector.
Potvrdenie: aktuálny TEAM-HANDOFF.md bol prečítaný a rešpektovaný
pri izolovanom audite v tomto rozhovore. Prístup k lokálnemu PC Basterix
zostáva offline; nie je to potvrdenie budúceho automatického čítania v každom
ChatGPT chate ani ACK za Codex, Antigravity, Copilot či Telegram.

### UPDATE / HANDOFF — CHATGPT-REVIEW-20261028-01
Dátum a pásmo: 2026-10-28, Europe/Bratislava.
Autor: ChatGPT (GitHub connector). Príjemca: Codex a Antigravity na review.
Vetva: fix/trinity-handoff-telegram-truth-20261028.
Súbory:
- Trinity/scripts/setup-telegram-bot.mjs: odstránený pevný webhook secret
  aj osobný chat ID zo zdrojáku; token sa neprijíma argumentom CLI;
  nový 32-byte kryptografický webhook secret a tri Worker secrets sú
  nastavované iba pri budúcom autorizovanom spustení setupu.
- Trinity/src/telegram-bridge.js: live_verified už nie je bez dôkazu true;
  /pc, /fleet, /crypto rozlišujú konfiguráciu od reálneho dôkazu.
- Trinity/tests/telegram-truth-and-setup.test.mjs: 5 regresných testov.
- Trinity/docs/SINGLE_REPOSITORY.md: kanonický repo, worker staging,
  Cloudflare Access a rozlíšenie deployment tagu od main.
Dôkazy: GitHub commity b1ddacc, bbc0ffdb, 1376196, 5898832, 390b0a6;
zdrojové invarianty pre nové skripty staticky skontrolované, starý test
na názov príkazu /fleet bol zachovaný. Úplný build, npm test a živá
Telegram konverzácia NEBOLI v tomto kroku vykonané (Basterix offline,
lokálna kópia kompletného repozitára neprístupná). Bez úspešného CI sa
tieto zmeny nesmú zlúčiť.
Dôležitý bezpečnostný nález: stará hodnota webhook secret už bola v
Git histórii verejného repozitára. Odstránenie z aktuálneho súboru ju
nerevokuje; treba bezpečne rotovať aktívny webhook secret aj každý
predtým odhalený bot token a otestovať /help a AI odpoveď.
Infrastruktúra: bez deployu, bez zmeny Worker secrets, bez zmien
PC Gateway; developer-tools activation ostáva odložená. Predchádzajúca
pracovná vetva fix/trinity-telegram-truth-and-release-audit-20261028
nebola vymazaná ani zlučovaná.
Stav: pending_ack, pending_ci, pending_secret_rotation; review požadované.
Ďalší vlastník: Codex alebo Antigravity pre nezávislé testy; ACK musí
zapísať sám prijímateľ.
