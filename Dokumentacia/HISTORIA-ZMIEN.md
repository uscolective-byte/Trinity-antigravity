# História zmien

## 1. november 2026 — TRINITY OMNI-CORE v11.0.0 (Nová Prísaha, Sovereign Lock, P0/P1 Záplaty & E2E Tunnel Bridge)

- **Nová Základná Neporušiteľná Prísaha (5 bodov) a 20 Právnych Doložiek Legality**:
  - Ustanovená ústavná charta `SOVEREIGN_CHARTER.md`, aktualizovaný `PRISLUB_TRINITY.txt`, `README.md`, `Trinity/README.md` a `Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md`.
- **Doložka Výlučnej Zvrchovanej Autority (`BASTERIX_ROOT` — Ring 0)**:
  - Implementované autorizačné jadro `Trinity/src/trinity-auth-core.js` a `Local-Gateway/src/trinity-auth-core.mjs` s registrom `ROOT_REGISTRY` (`saboi`, `basterix`, `saboivan2008@gmail.com`, `uscolective@gmail.com`, `cadjavadvocecka013@gmail.com`, `+421949009722`, `0949009722`, `+421949515777`, `0949515777`).
- **4 Kritické P0/P1 Bezpečnostné Záplaty (Audit Remediations)**:
  1. Zablokované plain-text falšovanie identity v HTTP/JSON požiadavkách (`verifyTrinityIdentity()` vyžaduje `verifiedGoogleToken === true`, `verifiedWebhookSignature === true` alebo `osTokenVerified === true` + reálne Windows SID `/^S-1-5-21-\d+-\d+-\d+-\d+$/`).
  2. Odstránený syntetický Windows SID fallback (`S-1-5-21-BASTERIX-...`) a dôvera v `process.env.USERNAME`.
  3. Nasadené trvalé atomické úložisko spotrebovaných `nonce` v D1 (`ops_consumed_nonces` v migrácii `0055_sovereign_ledger_v3.sql`), KV a lokálnom Disk Vaulte (`checkAndConsumeDurableNonce()`).
  4. Uzamknutá samomodifikácia v `Trinity/src/self-evolution.js` (fail-closed predvolené hodnoty) a autentifikačná brána na `/api/system/self-evolve` a `/api/skills/register`.
- **Štandardizácia 177 Zdrojových Modulov**:
  - Všetkých 177 `.js` a `.mjs` súborov obsahuje kanonickú hlavičku `@module TRINITY_OMNI_CORE`.
- **Odblokovanie Cloudflare DNS Zón (`paused: false`)**:
  - Obnovené Cloudflare zóny `auru.space` a `auru.dev`, verejné DNS vracia `HTTP 200 OK`.
- **Živé End-to-End Prepojenie Cez Cloudflare Tunnel (`https://auru.space/api/bridge` -> `127.0.0.1:7788`)**:
  - Overený negatívny test (`HTTP 403 SECURITY_BLOCKED`, receipt `receipt:trinity:4737b358411abd6f`).
  - Overený pozitívny End-to-End test otvorenia WhatsApp (`PID 1244`, `exitCode: 0`, `lifecycle_guard_state: 'VERIFIED'`, lokálny receipt `TRN-LCL-V3-1-7384C19D3E1A`, D1 receipt `receipt:trinity:cdcf8600d1322899`).

## 1. október 2026

- Vytvorený hlavný priečinok `Morhfeus`.
- Presunutý produkčný projekt Trinity, prototypy, pracovné záznamy a technické referencie.
- Vizuálny koncept Living Core uložený do `Navrhy`.
- Pridaný režim pravdy s blokovaním nepodložených tvrdení o vykonaných akciách.
- Pridaný trvalý profil osobnosti bez predstierania vedomia alebo biologických emócií.
- Nainštalovaný register 11 modulov Trinity.
- Pridané nástroje na aktuálny čas a výpis nainštalovaných schopností.
- Aplikované databázové migrácie a nasadená verzia 6.3.0 na Cloudflare.
- Nainštalovaný Docker Desktop ako príprava izolovaného jazykového prostredia.
- Živý test režimu pravdy prešiel na oboch verejných adresách.
- Pridaný strojovo čitateľný checkpoint `stav-projektu.json` a návod `POKRACOVANIE.md` pre pokračovanie po obnovení limitu alebo v novom chate.
- Pridaná privátna lokálna brána so systémovými operáciami, oddeleným schválením a auditnými potvrdeniami; lokálne testy 7/7 a živý cloudový tok prešli.
- Hlavné rozhranie bolo prebudované na dashboard jednej Trinity s oddeleným Chatom, AI Studiom, Projektmi a Nastaveniami.
- AI Studio teraz reálne generuje weby, zobrazuje sandboxovaný živý náhľad, zachováva verzie v D1/R2 a exportuje HTML.
- V produkcii bol vytvorený a vizuálne overený ukážkový web Morhfeus.
- Vytvorený a nasadený Firebase projekt `trinity-morhfeus-20261001` so stavovým mostom na produkčnú Trinity.
- Codex MCP konfigurácia bola rozšírená o lokálny Trinity most a Firebase MCP server.
- Aplikované migrácie `0009` a `0010` a nasadená verzia 6.5.0; Worker testy prešli 37/37.
- Pôvodný `trinity-pc-bridge` bol nahradený bezpečným Durable Object Workerom s interným RPC, heartbeatom a secretom namiesto plain-text kľúča.
- Trinity 6.7.0 zrkadlí životný cyklus systémových akcií do PC Bridge a zobrazuje živý stav lokálnej brány.
- Lokálna brána 1.2.0 používa `qwen3:4b-instruct`, automatický štart a bezpečný zoznam desktopových operácií; testy prešli 8/8.
- End-to-end test Cloudflare → lokálny Qwen → Cloudflare prešiel a potvrdená desktopová akcia otvorila Kalkulačku.
