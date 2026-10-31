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
