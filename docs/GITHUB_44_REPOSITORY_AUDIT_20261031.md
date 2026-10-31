# Audit všetkých 44 GitHub repozitárov (31. 10. 2026)

**Kanonický jediný repozitár Trinity:** https://github.com/uscolective-byte/Trinity-antigravity. **Žiadne odstránenie zdrojových repozitárov sa v tomto audite nevykonalo.**

Metóda: live výpis všetkých 44 vlastníckych repozitárov cez GitHub; kontrola základných metadát (veľkosť, hlavná vetva, viditeľnosť, fork/proveniencia) a názvov položiek v koreňovom strome každého repozitára. **Toto nie je audit všetkých commitov či súborov**, ani záloha. Stavy sú platné pre moment kontroly, súkromné cesty a tajomstvá sa nekopírujú.

## Záver

- **Jediné hlavné Trinity:** `uscolective-byte/Trinity-antigravity` (main, Trinity 11.0.0 podľa aplikačného package.json).
- Ostatné repozitáre nesmú slúžiť ako ďalší produkčný zdroj Trinity; presun kódu len selektívne s testami.
- **21** historických/kandidátskych Trinity repo vyžaduje audit unikátnych vetiev, otvorených PR, testov a deploymentov.
- **5** ďalších repo sú spojené s vlastnými stránkami, obchodom alebo USC; ich zmazanie nie je totožné s konsolidáciou Trinity.
- **6** sú externé forky dokumentácie/SDK/runtime; nepoužiť hromadný import cudzích licenciovaných zdrojov do Trinity.
- **11** sú šablóny/startery; aj tieto môžu byť pripojené k deployom, kým sa neoverí opak.
- GitHub konektor v tomto prostredí **neposkytuje delete-repository ani archive-repository**. Bez zabezpečenej kópie a obnovovacieho testu by ručné zmazanie mohlo stratiť PR diskusie, issue, branch, tagy a release assets.

## Inventár


### Jediný hlavný repozitár Trinity

| Repozitár | Viditeľnosť | Hlavná vetva | Veľkosť podľa GitHubu (KB) | Stav |
| --- | --- | --- | ---: | --- |
| [Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity) | public | main | 5007 | JEDINÝ HLAVNÝ |


### Historické verzie a kandidáti na selektívnu migráciu

| Repozitár | Viditeľnosť | Hlavná vetva | Veľkosť podľa GitHubu (KB) | Stav |
| --- | --- | --- | ---: | --- |
| [Auru_trinity](https://github.com/uscolective-byte/Auru_trinity) | public | main | 58 | nevymazávať bez migrácie/zálohy |
| [Tenebris](https://github.com/uscolective-byte/Tenebris) | private | main | 102 | nevymazávať bez migrácie/zálohy |
| [Trinity](https://github.com/uscolective-byte/Trinity) | public | main | 372 | nevymazávať bez migrácie/zálohy |
| [trinityceo](https://github.com/uscolective-byte/trinityceo) | public | main | 505 | nevymazávať bez migrácie/zálohy |
| [Trinitypro](https://github.com/uscolective-byte/Trinitypro) | public | main | 5 | nevymazávať bez migrácie/zálohy |
| [Trinity-AI-asistent](https://github.com/uscolective-byte/Trinity-AI-asistent) | public | main | 0 | nevymazávať bez migrácie/zálohy |
| [trinity-omni-core](https://github.com/uscolective-byte/trinity-omni-core) | private | main | 0 | nevymazávať bez migrácie/zálohy |
| [Trinityprot](https://github.com/uscolective-byte/Trinityprot) | public | main | 79 | nevymazávať bez migrácie/zálohy |
| [OMNITRINI](https://github.com/uscolective-byte/OMNITRINI) | public | main | 162 | nevymazávať bez migrácie/zálohy |
| [AURU-BOT](https://github.com/uscolective-byte/AURU-BOT) | public | main | 21 | nevymazávať bez migrácie/zálohy |
| [v8](https://github.com/uscolective-byte/v8) | private | main | 158 | nevymazávať bez migrácie/zálohy |
| [trini-agent](https://github.com/uscolective-byte/trini-agent) | private | main | 118 | nevymazávať bez migrácie/zálohy |
| [Trinity1](https://github.com/uscolective-byte/Trinity1) | private | main | 12 | nevymazávať bez migrácie/zálohy |
| [terni](https://github.com/uscolective-byte/terni) | private | main | 160 | nevymazávať bez migrácie/zálohy |
| [trinityprotoypv1](https://github.com/uscolective-byte/trinityprotoypv1) | public | main | 518 | nevymazávať bez migrácie/zálohy |
| [trinity-morhfeus](https://github.com/uscolective-byte/trinity-morhfeus) | public | main | 5187 | nevymazávať bez migrácie/zálohy |
| [Trinity-test](https://github.com/uscolective-byte/Trinity-test) | private | master | 1353 | nevymazávať bez migrácie/zálohy |
| [TrinityV1](https://github.com/uscolective-byte/TrinityV1) | public | master | 1408 | nevymazávať bez migrácie/zálohy |
| [trinitis](https://github.com/uscolective-byte/trinitis) | public | main | 1 | nevymazávať bez migrácie/zálohy |
| [trinity-morfheus](https://github.com/uscolective-byte/trinity-morfheus) | public | main | 401 | nevymazávať bez migrácie/zálohy |
| [uuscolectia](https://github.com/uscolective-byte/uuscolectia) | public | main | 1 | nevymazávať bez migrácie/zálohy |


### Samostatné projekty — preveriť funkčnú závislosť

| Repozitár | Viditeľnosť | Hlavná vetva | Veľkosť podľa GitHubu (KB) | Stav |
| --- | --- | --- | ---: | --- |
| [Underground-Street-Collectivum](https://github.com/uscolective-byte/Underground-Street-Collectivum) | public | main | 14 | nevymazávať bez migrácie/zálohy |
| [usc-project](https://github.com/uscolective-byte/usc-project) | public | main | 9 | nevymazávať bez migrácie/zálohy |
| [vebsitem](https://github.com/uscolective-byte/vebsitem) | public | main | 391 | nevymazávať bez migrácie/zálohy |
| [domenafixer](https://github.com/uscolective-byte/domenafixer) | private | main | 503 | nevymazávať bez migrácie/zálohy |
| [Tenebris-qqq](https://github.com/uscolective-byte/Tenebris-qqq) | public | main | 126785 | nevymazávať bez migrácie/zálohy |


### Forky tretích strán — neimportovať celý upstream

| Repozitár | Viditeľnosť | Hlavná vetva | Veľkosť podľa GitHubu (KB) | Stav |
| --- | --- | --- | ---: | --- |
| [docs](https://github.com/uscolective-byte/docs) | public | main | 2342196 | nevymazávať bez migrácie/zálohy |
| [adk-python](https://github.com/uscolective-byte/adk-python) | public | main | 81379 | nevymazávať bez migrácie/zálohy |
| [workerd](https://github.com/uscolective-byte/workerd) | public | main | 51653 | nevymazávať bez migrácie/zálohy |
| [AgentsClientSDK.Android](https://github.com/uscolective-byte/AgentsClientSDK.Android) | public | main | 1541 | nevymazávať bez migrácie/zálohy |
| [cloudflare-docs](https://github.com/uscolective-byte/cloudflare-docs) | public | production | 1485735 | nevymazávať bez migrácie/zálohy |
| [power-platform](https://github.com/uscolective-byte/power-platform) | public | main | 992677 | nevymazávať bez migrácie/zálohy |


### Šablóny, príklady a pokusy — preveriť použitie

| Repozitár | Viditeľnosť | Hlavná vetva | Veľkosť podľa GitHubu (KB) | Stav |
| --- | --- | --- | ---: | --- |
| [chanfana-openapi-templat](https://github.com/uscolective-byte/chanfana-openapi-templat) | private | main | 121 | nevymazávať bez migrácie/zálohy |
| [next-starter-template](https://github.com/uscolective-byte/next-starter-template) | public | main | 217 | nevymazávať bez migrácie/zálohy |
| [workflows-starter-template](https://github.com/uscolective-byte/workflows-starter-template) | public | main | 518 | nevymazávať bez migrácie/zálohy |
| [openauth-template](https://github.com/uscolective-byte/openauth-template) | public | main | 124 | nevymazávať bez migrácie/zálohy |
| [workflows-starter-templatex](https://github.com/uscolective-byte/workflows-starter-templatex) | public | main | 518 | nevymazávať bez migrácie/zálohy |
| [kv-get-started](https://github.com/uscolective-byte/kv-get-started) | private | main | 2 | nevymazávať bez migrácie/zálohy |
| [react-router-starter-templates](https://github.com/uscolective-byte/react-router-starter-templates) | public | main | 165 | nevymazávať bez migrácie/zálohy |
| [vite-react-template](https://github.com/uscolective-byte/vite-react-template) | public | main | 160 | nevymazávať bez migrácie/zálohy |
| [chanfana-openapi-template](https://github.com/uscolective-byte/chanfana-openapi-template) | public | main | 140 | nevymazávať bez migrácie/zálohy |
| [vite-react-templates](https://github.com/uscolective-byte/vite-react-templates) | public | main | 160 | nevymazávať bez migrácie/zálohy |
| [saas-admin-template](https://github.com/uscolective-byte/saas-admin-template) | public | main | 216 | nevymazávať bez migrácie/zálohy |

## Brzdy pred nenávratným zmazaním

1. Pre každý zdroj: `git clone --mirror`, `git fsck --full`, vlastný `git bundle create --all` a **restore test** plus export issues/PR komentarov/reviews/releases/Actions/secret names. Metadáta nezaručujú zachovanie tajomstiev.
2. Overiť rozdielne tree/commity a relevantné otvorené PR, preniesť jedinečné hodnotné funkcie do kanonickej vetvy a získať zelené testy/CI; neprepisovať novšie jadro.
3. Overiť GitHub Actions, Vercel/Cloudflare Workers Builds, webhooky, DNS, Secrets Store, D1/KV/R2 a lokálnu PC cestu; zrušiť starý zdroj deployu až po presmerovaní.
4. Skontrolovať rozdiel medzi vlastnými projektmi USC/doména/web a starými Trinity; neodstrániť nezávislý fungujúci projekt pod označením duplicita.
5. Až po zozname overených a archivovaných repo vykonať jednotlivé deletions cez oprávnené GitHub rozhranie. Konektor v tejto relácii nemá mazací nástroj.

## Kritické konkrétne blokéry

- `trinity-morhfeus`: GitHub vrátil **26 vetiev**, historický migrančný manifest uvádza **73 PR / 11 otvorených**, 3 issues, 2 tags. V hlavnej vetve je 667 pôvodných ciest, starý tree porovnávaný s kanonickým obsahoval 53 odlišných blob SHA. PR #64/#53/#46 a závislosti zostávajú na review. Posledné porovnanie podľa aktuálneho SHA cez canonical compare vrátilo 404; **neprezentovať história ako plne zlúčenú**.
- `Trinity`: 12 vetiev a existujúce otvorené PR s odlišnou štruktúrou core/memory/app.
- `TrinityV1`: 4 vetvy, nezmapované pracovné commity.
- `Trinity-antigravity`: 19 vetiev vrátane rozpracovaných PR #26/#27, staging storage sharing a CI/deploy gates nie sú vyriešené.
- Windows Basterix bol pri kontrole GitHubu offline v Desktop Commander; úplné mirror backupy neboli možné.

Strojovo čitateľné údaje: [GITHUB_REPOSITORY_INVENTORY_20261031.json](./GITHUB_REPOSITORY_INVENTORY_20261031.json). Tracking: issue #23 v kanonickom GitHube.
