# Protokol spolupráce Codex (GPT) ↔ Antigravity

Platí pre repozitár `C:\Users\saboi\Trinity-antigravity` (vetva `main`). Komunikácia s majiteľom (Basterix) vždy po slovensky.

## 1. Rozdelenie práce
| Oblasť | Vlastník | Poznámka |
|---|---|---|
| `Trinity/public/assistant/*` (UI, garage.css, chat.html, chat.js.txt) | Dohodnúť na začiatku každej úlohy | Nikdy nie obaja naraz |
| `Trinity/src/*`, migrácie, wrangler, deploy | Antigravity (ak Codex neurčí inak) | Deploy len po testoch |
| Review, diagnostika, nezávislé overenie | Druhá strana | Read-only, nálezy do review súboru |

## 2. Odovzdávací cyklus (každá iterácia)
1. **Claim**: strana zapíše do `CODEX-ANTIGRAVITY-REVIEW-2026-10-24.md` sekciu `CLAIM` (súbory, cieľ, základný commit).
2. **Sync**: `git pull --rebase origin main` pred prácou, `git push` po každom commite.
3. **Práca** v oddelených súboroch alebo samostatnom worktree.
4. **Handoff**: zápis `HANDOFF` (commit SHA, zmenené súbory, výsledok testov, čo ostáva).
5. **Druhá strana** potvrdí slovom `ACK_<dátum>` a až potom preberá súbory.

## 3. Pravidlá kvality
- Pred deployom: `node --test --test-concurrency=1 tests/*.test.mjs` (v `Trinity/`), musí prejsť 100 %.
- Deploy: `npx wrangler deploy --tag <git-sha>`, potom `node Trinity/scripts/verify-deployment.mjs <ORIGIN> --version-id <ID>` pre `https://auru.dev` aj `https://auru.space`.
- Žiadne tajomstvá (kľúče, `.credentials/*.dpapi`) v commitoch, logoch ani review súbore.
- Tvrdenia o výsledku musia mať dôkaz (výstup testu, verifikácia nasadenia).

## 4. Riešenie konfliktov
- Ak obaja zmenili ten istý súbor: novší commit sa rebasuje, nič sa neprepisuje silou (`--force` je zakázaný).
- Spor o smere rozhoduje majiteľ.

## 5. Šablóna záznamu
```
### [CLAIM|HANDOFF|ACK] <strana> <dátum čas>
Súbory:
Commit:
Testy:
Ďalší krok:
```
