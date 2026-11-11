# Architektúra Trinity Omni-Core

## Referenčný model 7 vrstiev

| Vrstva | Zodpovednosť | Zdrojové dôkazy |
|---|---|---|
| L1 Kernel | vstup, runtime a kontrakty | Trinity/src/index.js, packages/contracts |
| L2 Orchestration | smerovanie a Service Bindingy | wrangler.jsonc |
| L3 Memory | pamäťové služby, D1/KV/Vectorize | Worker konfigurácie a migrations |
| L4 Sovereign Ledger | receipt, provenance a epoch root | packages/crypto-core, services/trinity-treasury |
| L5 Execution | vykonávanie úloh a lokálne akcie | Local-Gateway/src/executor.mjs, desktop.mjs |
| L6 Security | identita, TAP, capability a schválenia | packages/contracts/src/tap.js, trinity-auth-core.mjs |
| L7 Evolution | testovanie a návrhy zmien | Local-Gateway/src/policy.mjs, CI a testy |

Ide o logické členenie. Neznamená to, že každá vrstva má vlastný Worker.

## Edge topológia

Hlavný wrangler.jsonc obsahuje 39 Service Binding záznamov v production a 39 v staging. V repozitári sa našlo 9 samostatných Wrangler konfigurácií: hlavný Worker a 8 ďalších worker konfigurácií. Tieto počty nedokazujú 47 aktívnych Workerov.

Service Binding je lokálny názov a cieľová Cloudflare service. Nie je to dôkaz deploymentu, dostupnosti ani samostatnej runtime identity.

## Environmenty

Root wrangler.jsonc odlišuje hlavný profil a env.staging. D1 binding DB smeruje v hlavnom profile na trinity-v03 a v staging profile na trinity-development. Každý D1 príkaz musí explicitne určiť environment a databázu.

## Neoverené garancie

- 39 bindingov neznamená 39 ani 47 zdravých Workerov.
- V konfigurácii sa nenašli univerzálne aplikačné timeouty a compute budget pre každý cieľ.
- Circuit breaker treba doložiť konkrétnym volajúcim kódom.
- Live status a posledný deploy vyžadujú Cloudflare API inventár.
