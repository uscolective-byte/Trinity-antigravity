# Fleet Registry — 47 Workerov a Service Binding topológia

## Kanonický zdroj 47 Workerov

Úplná deklarácia flotily je v Trinity/src/fleet-clusters.js. Zdroj definuje 6 klastrov a 47 Workerov s číslom, názvom a rolou. Patrí sem aj Worker #26 jericho123 a Worker #47 trinity-profile (ProfileMaker).

Generované výstupy:
- [Interaktívne vyhľadávateľná matica 47 Workerov](../registry/fleet-workers.md)
- [Strojovo čitateľný fleet-registry.json](../registry/fleet-registry.json)
- [Strojovo čitateľný inventár Service Bindingov](../registry/service-bindings.json)

Matica sa generuje skriptom docs/scripts/generate-fleet-registry.mjs. Názvy a roly pochádzajú z fleet-clusters.js; bindingy sa mapujú presnou zhodou na wrangler.jsonc.

## Čo sa počíta

- **Declared Worker:** položka v TRINITY_FLEET_CLUSTERS.
- **Worker config:** samostatný wrangler.jsonc alebo pomenované environment v koreňovom configu.
- **Service Binding:** alias v services[].
- **Nasadený Worker:** stav potvrdený Cloudflare API/deployment metadátami.

Aktuálny snapshot:
- 47 deklarovaných Workerov v 6 klastroch;
- 9 Wrangler config súborov v repozitári vrátane hlavného configu;
- 8 deklarovaných Workerov sa mapuje na nájdený samostatný config/environment;
- 39 Service Bindingov v production a 39 v staging v koreňovom wrangler.jsonc.

Tieto počty sa nevylučujú: deklarovaný Worker môže existovať vo fleet manifeste bez vlastného Wrangler configu alebo môže byť volaný cez alias Service Binding.

## Limity údajov

Timeout, compute budget a circuit-breaker policy sú UNSPECIFIED_IN_SOURCE, ak neexistuje konkrétny runtime dôkaz. Live status je NOT_QUERIED. Tento register nie je potvrdením, že všetkých 47 Workerov je nasadených alebo online.

## Pravidlá aktualizácie

1. Worker ID prideľovať iba podľa fleet-clusters.js.
2. Bindingy mapovať podľa wrangler.jsonc; aliasy zachovať.
3. Timeout, budget a fallback musia mať odkaz na konkrétny zdroj.
4. Live status a posledný deploy aktualizovať read-only Cloudflare inventárom.
5. Pri zmene fleet-clusters.js spustiť node docs/scripts/generate-fleet-registry.mjs a skontrolovať diff.
