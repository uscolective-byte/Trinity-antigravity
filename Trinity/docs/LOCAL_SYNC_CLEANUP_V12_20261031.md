# Trinity 12 — lokálna synchronizácia a odstránenie starých klonov

**Stav 31. 10. 2026:** Windows Desktop Commander `Basterix` je offline.
Tento postup je uložený v pracovnom PR, **nebol vykonaný na PC**.
Bez dostupného PC nie je možné potvrdiť lokálne súbory ani ich odstrániť.

## Zdroj pravdy

- Jediný hlavný GitHub repo: `uscolective-byte/Trinity-antigravity`.
- Lokálny hlavný checkout: `C:\Users\saboi\Trinity-antigravity`.
- Historický GitHub repo: `uscolective-byte/trinity-morhfeus` je zrkadlový/historický, nie druhý production zdroj.
- Zdrojová verzia **12.0.0** je momentálne pripravená v draft PR #26; `main` nemusí ešte obsahovať v12. **Skript nenasadzuje Cloudflare, nemerguje PR, a nesťahuje neotestovanú verziu do main**.

## Bezpečný lokálny postup (PowerShell)

Otvor normálny PowerShell a najskôr prever lokálne zmeny:

```powershell
Set-Location 'C:\Users\saboi\Trinity-antigravity'
git status --short --branch
git remote -v
git branch --show-current
```

Skript sa zatiaľ nachádza na vetve PR #26. Načítaj ho z explicitného
GitHub ref bez zmeny pracovného `main`:

```powershell
git fetch origin feat/unified-agent-connection-bridge-20261031
$helper = Join-Path $env:TEMP 'trinity-local-sync-cleanup.ps1'
git show 'FETCH_HEAD:scripts/local-trinity-sync-cleanup.ps1' |
    Set-Content -LiteralPath $helper -Encoding utf8

# Najskôr iba kontrola. Nič nemaže ani neaktualizuje:
& $helper
```

Po ručnom výbere a potvrdení presnej starej cesty:

```powershell
# Príklad, nie automatický zoznam na odstránenie!
$legacyClone = 'C:\Users\saboi\Documents\Codex\Morhfeus\Trinity'
& $helper -RemoveClonePaths @($legacyClone)

# Až po vyhodnotení kontroly; skontroluje remote, čistý stav,
# ignorované a lokálne súbory, porovná vetvy s upstreamom,
# vytvorí + overí Git bundle a iba potom odstráni zvolený klon:
& $helper -RemoveClonePaths @($legacyClone) -Apply
```

## Bezpečnostné pravidlá

1. Bez parametra `-Apply` vykoná kontrolu bez zmien.
2. Odmietne nečistý hlavný checkout, neznáme remote, nesprávnu hlavnú
   vetvu alebo chýbajúci `origin/main`. Nikdy nevykoná `git reset --hard`.
3. Aktualizácia hlavného repozitára používa iba `git fetch` a `git merge --ff-only` —
   žiadny force-push, rebase ani zmazanie rozpracovaných zmien.
4. `-RemoveClonePaths` musí obsahovať výslovne vybrané cesty;
   žiadne automatické prehľadanie a odstránenie iných projektov.
5. Môžu sa odstrániť iba čisté samostatné klony s overeným
   `origin` z dvoch Trinity repozitárov, bez neodoslaných branch tipov,
   ignorovaných/untracked súborov. Každý má pred zmazaním
   vlastný overený Git bundle v `C:\Users\saboi\Trinity-Repo-Backups`.
6. Neodstraňuj samostatné projekty `USC`, `domenafixer`, `Tenebris`
   ani lokálne dátové priečinky bez ich osobitného inventára.
7. `git bundle` nezálohuje GitHub issues, PR komentáre, cloud data,
   secrets, ani lokálne ignorované súbory. Prítomnosť ignorovaných
   súborov blokuje odstránenie.
8. Skript obsahuje ochranu hlavného checkoutu aj backup foldera
   proti odstráneniu a odmieta nestandardné Git worktrees.
9. Po schválení Trinity 12 PR, úspešnom CI a merge do `main`
   možno znova spustiť `& $helper -Apply` na aktualizáciu hlavnej
   lokálnej kópie na verziu 12.0.0.

## Čo zatiaľ nie je vykonané

- Vytvorenie/overenie lokálneho backupu ani mazanie priečinkov;
  PC konektor je offline.
- Lokálne spustenie PowerShell skriptu ani npm testov.
- Merge PR #26, Cloudflare migrácie ani produkčný deploy.
- Automatické GitHub zrkadlenie nemá potvrdený prvý úspešný runner beh.
