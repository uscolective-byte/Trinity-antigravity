# Trinity — architektúra a prevádzkový opis

**Stav:** zdrojovo podložený technický opis; nie je potvrdením živej dostupnosti ani právnej zhody.
**Aktualizované:** 12. 11. 2026.
**Kanonický zdroj:** repozitár `uscolective-byte/Trinity-antigravity`, vetva `main`.

## 1. Rozsah a hranice

Trinity je viacvrstvová aplikácia s Cloudflare Workerom, používateľským rozhraním, dátovými službami, konektormi a voliteľnými lokálnymi komponentmi. Zdrojový kód a konfigurácia popisujú zamýšľanú topológiu; samotná existencia bindingu, agenta, integrácie alebo endpointu nedokazuje, že je nasadený, dostupný alebo autorizovaný. Živý stav sa uvádza iba s časovo označeným výstupom kontroly.

## 2. Komponenty

| Oblasť | Zdrojová pravda | Úloha | Dôležitá hranica |
|---|---|---|---|
| Hlavný runtime a HTTP API | `Trinity/src/index.js`, `Trinity/wrangler.jsonc` | routovanie, autentifikácia, chat, API, status | binding ≠ dostupný downstream Worker |
| Rozhranie | `Trinity/public/assistant/` | chat, nastavenia, právne stránky | UI tvrdenie ≠ serverová autorizácia |
| Orchestrácia a nástroje | `Trinity/src/engine.js`, `Trinity/src/tools.js` | výber modelu, nástrojov a konektorov | každá externá zmena potrebuje konkrétnu serverovú kontrolu |
| Trvalý stav | migrácie `Trinity/migrations/`; D1/KV/R2 podľa wrangler konfigurácie | účty, projekty, pamäť, audity a objekty | retenčné lehoty a rezidencia musia byť overené u poskytovateľov |
| Tajomstvá | `Trinity/src/secret-vault.js`, Cloudflare Secrets/Secrets Store | šifrované tajomstvá a provider credentials | nikdy nelogovať ani vložiť do repozitára; overiť kľúč, prístup a obnovu |
| Lokálna integrácia | `Local-Gateway/`, `Local-Desktop/`, `PC-Bridge-Worker/` | lokálne akcie po explicitnom overení | offline stav znamená, že lokálna akcia nie je vykonateľná |
| Asistentské a externé integrácie | `Trinity/src/external-integrations.js`, príslušné konektory a service bindings | OpenAI, Gemini, GitHub, Cloudflare a ďalšie | konfigurácia, pripojenie, oprávnenie a úspešná akcia sú odlišné stavy |
| Audit a bezpečnostné kontroly | `Trinity/src/compliance-shield.js`, ledger, audit moduly | limity, auditné záznamy a ochrana pred zneužitím | auditný receipt potvrdzuje len opísanú udalosť, nie právny súlad |

## 3. Prostredia a nasadenie

Produkčné a vývojové profily sú určené v `Trinity/wrangler.jsonc`. Pred zmenou treba overiť environment, Worker name, routes, D1/KV/R2 bindingy a secrets. Nikdy neodvodzuj produkčný stav z lokálneho dry-run buildu. Migrácie sa aplikujú na pomenovanú databázu a prostredie; záloha a rollback plán musia predchádzať nekompatibilnej migrácii.

Repozitár sa vyvíja priamo na hlavnej vetve `main` podľa pokynu vlastníka. Zmena sa musí najprv skontrolovať, zostaviť a otestovať. Priamy deploy je povolený len do skutočne nakonfigurovaných cieľov a po potvrdení výstupov; „všade“ nie je identifikátor prostredia. Každý deploy sa zaznamená s commit SHA, Worker/version ID, časom, migráciami, kontrolami a rollback cestou.

## 4. Identita a vykonávanie

1. Požiadavka vstupuje cez HTTP/MCP/UI a prejde validáciou schémy, limitmi a autentifikáciou.
2. Server overí rolu, vlastníctvo a oprávnenie pre konkrétny nástroj a operáciu.
3. Čítanie vracia iba povolené údaje. Zápis sa vykoná iba vtedy, keď existuje podporovaná operácia a jej serverová politika to dovolí.
4. Lokálny príkaz ide cez samostatnú bránu a musí mať dôkaz vykonania. Cloudový status nedokazuje, že lokálny počítač je online.
5. Výsledok sa označí ako úspech len pri potvrdenom receipts/evidence od cieľového systému; požiadavka, návrh, odoslaný deploy či HTTP 202 samy osebe nie sú dokončenie.

Schvaľovanie je osobitná produktová politika. Ak niektoré operácie vyžadujú schválenie človekom, rozhodujúci je serverový stav a overená identita, nie tlačidlo v notifikácii. Aktuálna politika sa musí zhodovať s UI, endpointmi a dokumentáciou.

## 5. Dáta a dôvernosť

Možné kategórie podľa zdrojového kódu a funkcionality: identifikátory účtu a relácie, prompty a chatová história, nahraté súbory, projektové dáta, integračné identifikátory, bezpečnostné/auditné udalosti a používateľom pridané credentials. Presné polia, účely, právne základy, retenčné lehoty, regióny, subdodávatelia a prenosy sa musia odvodiť z produkčnej konfigurácie, databázových schém, zmlúv a logov — tento zoznam ich nepredstiera.

Tajomstvá patria do Cloudflare Secrets/Secrets Store alebo do aplikáciou šifrovaného vaultu s obmedzeným prístupom. Plaintext sa nesmie zapisovať do Git, bežnej dokumentácie, chatu, telemetry, URL alebo logov. Používateľské dáta a tajomstvá sa oddeľujú; prístup k trezoru sa audituje a treba zdokumentovať obnovu, rotáciu a zrušenie.

## 6. Zlyhania a degradácia

- Nedostupný provider: vrátiť pravdivú chybu/degradovaný stav; nevymýšľať úspech.
- Chýbajúce oprávnenie alebo token: operáciu zastaviť; neobchádzať autorizáciu.
- D1/KV/Workflow nedostupný: neoznačiť nevykonanú akciu ako uloženú alebo dokončenú.
- PC Bridge offline: nepredstierať lokálne vykonanie.
- Neúplný auditný dôkaz: výsledok uviesť ako nepotvrdený.
- Nasadenie alebo migrácia zlyhá: zastaviť ďalšie kroky a použiť pripravenú rollback cestu.

## 7. Zdrojové mapovanie na zmenu

Pred úpravou over `Trinity/src/index.js`, `Trinity/src/tools.js`, `Trinity/src/security.js`, `Trinity/src/secret-vault.js`, `Trinity/wrangler.jsonc`, migrácie a cieľový konektor. Over live Cloudflare stav samostatne. Tento dokument sa musí meniť spolu s architektonickou zmenou; automatické generovanie z konfigurácie je vhodnejšie pre počty bindingov a environment mapy.

## 8. Otvorené dôkazy

- Aktuálna produkčná verziu, routes a všetky živé bindings: doplniť artefakt kontroly Cloudflare.
- Reálne regióny, subprocesori, DPA a medzinárodné transfery: doplniť z účtov poskytovateľov/zmlúv.
- Retencia a mazanie záloh: doplniť z nastavení D1/KV/R2, logov a backup procesov.
- Právny subjekt, adresa, kontakty, ceny, spotrebiteľský proces a SLA: potvrdiť vlastníkom.
- Bezpečnostné kontroly, DPIA/DPO povinnosť, AI Act klasifikácia: zdokumentovať po posúdení reálneho použitia.
