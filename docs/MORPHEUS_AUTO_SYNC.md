# Morpheus → Trinity-antigravity: automatická jednosmerná synchronizácia

**Source:** `uscolective-byte/trinity-morhfeus` (len čítanie).
**Target:** `uscolective-byte/Trinity-antigravity` (jediný kanonický repo).
**Workflow:** [morpheus-sync.yml](../.github/workflows/morpheus-sync.yml).
**Schedule:** štyri kontroly za hodinu (`7,22,37,52 * * * *`), alebo ručne cez Actions → Morpheus to canonical Trinity sync → Run workflow. GitHub schedule nie je presný cron SLA, spúšťanie sa môže oneskoriť.

## Správanie

1. Skontroluje všetky existujúce vetvy v Morpheus a skopíruje ich ako **archivované vetvy** do `mirror/morpheus/<source-branch>`. Aktualizácia iba fast-forward; pri rewrite uloží nemennú vetvu `mirror/morpheus-rewrites/<source-branch>/<sha>` a vytvorí issue. Nikdy force-push.
2. Tagy uloží s prefixom `morpheus/<tag>`; nedotkne sa kanonických tagov.
3. Nové commity z **Morpheus main** vytvoria/aktualizujú vetvu `sync/morpheus-main` a pull request do kanonického `main`, bez prepisovania novšieho kódu. Pri merge konflikte sa nevytvára vymyslené zlúčenie — vznikne issue na ručné riešenie.
4. Synchronizačný PR explicitne spustí `webpack.yml`, `integrations-check.yml`, `dependency-security.yml` a `codeql.yml` cez `workflow_dispatch`. GitHub nemusí automaticky spúšťať všetky workflows po commitoch vytvorených s `GITHUB_TOKEN`.
5. **Len nízkorizikové textové dokumenty** sa automaticky mergujú, a iba ak presný PR commit prešiel všetkými požadovanými kontrolami a GitHub označuje merge ako `CLEAN`. Zmeny zdrojového kódu, konfigurácie, CI, migrácií, balíkov, účtov alebo bezpečnosti sa prenesú do review PR, **nie priamo do main bez review**.

## Aktivácia a aktuálne blokéry

- V **Trinity-antigravity → Settings → Actions → General → Workflow permissions** povoľte vytváranie pull requestov pomocou GitHub Actions, ak je to v organizácii blokované; bez toho má job skončiť chybou, nie hlásiť úspech.
- GitHub-hosted runner musí naozaj štartovať. Pri audite 31.10.2026 mali PR #22 jobs `runner_id=0`, `steps=[]` a logy 404. **Súbory workflow sú nainštalované, ale skutočný plánovaný sync a prvá archivácia ešte neboli preukázané.** Overte Actions billing, policy a runner allocation.
- Nie je potrebné posielať API token do chatu ani kopírovať cloudové secrets. Job používa jedine dočasný `GITHUB_TOKEN` v kanonickom repozitári.
- Zastaraný Morpheus nevymazávajte, kým zrkadlenie všetkých vetiev a tagov, PR history/komentárov, externých GitHub nastavení a záloha s obnovovacím testom nie sú preukázateľne dokončené. Tento job **nekopíruje GitHub PR komentáre, nastavenia webhookov, užívateľské secrets ani Cloudflare D1/KV/R2**.
- Zdrojové PR a nové commity na vývojových vetvách sa **archivujú v namespaced mirrors**, ale do hlavnej vetvy sa uplatnia až po ich merge do Morpheus/main a úspešnej review synchronizačného PR.

## Overenie

```bash
node --check scripts/morpheus-sync-runner.mjs
node --test tests/morpheus-sync-policy.test.mjs
```

GitHub Actions v kanonickom repozitári musí zobrazovať úspešný job `Morpheus to canonical Trinity sync` a vytvorené `mirror/morpheus/main`, `mirror/morpheus/<...>` a `morpheus/v11.0.0`. Bez týchto dôkazov nehovorte, že systém už automaticky synchronizuje dáta.

Cieľ: nemať dve nezávislé produkčné vetvy; `Trinity-antigravity/main` zostáva jediný zdroj produkčného nasadenia.

## Overenie prvého automatického behu — 31.10.2026

Synchronizačný workflow má teraz aj úzky `push` trigger pri zmene
vlastných skriptov a workflow súboru. GitHub ho skutočne vytvoril:
[run #41222912897](https://github.com/uscolective-byte/Trinity-antigravity/actions/runs/41222912897).

**Result: failure ešte pred spustením.** GitHub API pri jobe `124601005929`
vrátilo `runner_id=0`, `runner_name=""`, `steps=[]`. 
Žiadny fetch, Git mirror push, PR ani test neprebehol. Znova: nový GitHub
token nedokáže napraviť chýbajúci GitHub-hosted runner.

Konkrétny zoznam administrátorských kontrol a súvis s historickou
Actions policy `7283` (iba podozrenie, nie potvrdená príčina):
[GitHub issue #24](https://github.com/uscolective-byte/Trinity-antigravity/issues/24).
Skontrolovať Actions policy a oprávnenia, billing a Runner Smoke.
Po obnovení runnerov spustiť workflow manuálne cez GitHub Actions.

**Zmeny kódu:** aby sa detegovali a archívovali všetky zdrojové vetvy
vrátane force-rewrite, workflow zachová odlišné SHA pod osobitným
menom `mirror/morpheus-rewrites/*` a pozastaví automatický merge
pri prepísanej histórii. GitHub token nikdy nesmie force-pushnúť
kanonický `main`.

## Trinity 12 — zrkadlenie v opačnom smere

Historické repo `uscolective-byte/trinity-morhfeus` má workflow
[`canonical-main-mirror.yml`](https://github.com/uscolective-byte/trinity-morhfeus/blob/main/.github/workflows/canonical-main-mirror.yml).
Na harmonograme (dvakrát za hodinu) alebo manuálnym spustením prenáša
**iba fast-forward** `Trinity-antigravity/main` do
`trinity-morhfeus/mirror/canonical-main`. Nezapisuje do historického
`main`, nenasadzuje Worker a nenahrádza pôvodné vetvy/PR.

Opačný smer existuje v hlavnom repo ako `morpheus-sync.yml`: archívne
vetvy z historického repa a **review PR** na unikátne zmeny.
Nie je to automatický obojstranný konfliktový merge; produkčný
`main` má jediného vlastníka.

**Deployment gate:** historický `.github/workflows/self-deploy.yml`
bol 31.10.2026 upravený tak, že verify job na starom repo
nemôže autorizovať deploy. Overenie zatiaľ GitHub commitom, nie
úspešným Actions behom.

**Nevyriešené:** GitHub Actions runner allocation, oprávnenia
`GITHUB_TOKEN` pre mirror vetvu, úspešný prvý mirror, migrácia
source-only PR/issues/reviews a obnoviteľný Git backup.
Bez týchto dôkazov netvrdiť live synchronizáciu ani nezmazať starý repo.
