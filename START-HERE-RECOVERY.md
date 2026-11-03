# Trinity — začni tu

Overené 3. novembra 2026. Kanonický projekt: uscolective-byte/Trinity-antigravity, vetva main.

## Obnova

```powershell
git clone https://github.com/uscolective-byte/Trinity-antigravity.git
cd Trinity-antigravity
git switch main
```

Používaj jeden hlavný checkout. Čítaj AGENTS.md a aktuálny TEAM-HANDOFF.md. Závislosti obnov podľa README konkrétneho balíka. Prihlásenia, PC bridge ani cloudové dáta samotný clone neobnoví.

## Kde je práca

- main: hlavný vývoj, aktuálnu verziu zisťuj z origin/main.
- backup/pre-reset-20261103/: 11 zachovaných lokálnych vetiev.
- backup/pre-reset-20261103/worktree-0: rozpracovaný spoločný denník.
- backup/pre-reset-20261103/worktree-2: Copilot secret-vault a denník.
- backup/pre-reset-20261103/worktree-8: zmena generovanej contracts schémy.
- codex/recovery-index-20261103: tento prehľad a manifest.

Presné SHA, pôvodné cesty a súbory: docs/recovery/github-backup-20261103.json. Všetky uvedené zálohy boli overené cez vzdialené Git refs. Snapshot je nepreverená rozpracovaná práca; nie release. Pred zlúčením treba review vlastníka a testy. Pre zálohu neboli spúšťané runtime testy.

## Ďalší poriadok

Nová úloha má jednu vetvu a vlastníka. Záložné vetvy zostávajú archívom; nezlučovať ich hromadne do main. Existujúce cudzie zmeny sa neprepisujú. Tento dokument nerobí produkčný deploy.

## Pred vymazaním disku

GitHub nie je úplná záloha PC. Samostatne na šifrované úložisko mimo počítača treba zachrániť osobné súbory, Dokumenty, projektové výstupy, lokálne databázy, ignorované Local-Desktop/Data, runtime, Workspace a Local-Gateway/data, konfigurácie Codex/Antigravity/VS Code/tunela a obnoviteľné poverenia.

.env, tajomstvá a credentials do Gitu nepatria. DPAPI súbory samotné nemusia po reinštalácii fungovať; pôvodné poverenia musia mať bezpečný obnoviteľný zdroj. Cloudové databázy týmto neboli exportované. Negitované súbory mimo inventarizovaných worktrees neboli zálohované.

**Disk zatiaľ nie je potvrdený ako pripravený na vymazanie.** Úplná externá záloha ignorovaných a osobných dát ešte nie je overená.
