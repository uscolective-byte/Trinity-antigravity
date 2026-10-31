# AGENTS.md — Trinity-antigravity

Pred každou úlohou povinne prečítaj [TEAM-HANDOFF.md](TEAM-HANDOFF.md).
Pred každým príkazom skontroluj jeho aktuálnosť; pred zmenou zapíš CLAIM,
over vlastníctvo súborov, po zmene UPDATE a pri odovzdaní HANDOFF/ACK.
Tento postup platí pre všetkých agentov v tomto repozitári. Zachovaj cudzie
zmeny; konflikt zastavuje dotknuté úpravy. Aktuálne úlohy hľadaj v TEAM-HANDOFF.md,
nie iba v historickom handoffe uvedenom nižšie.

## Cloudflare Secrets Store — záväzný skill pre všetkých agentov

Pri akejkoľvek zmene Cloudflare tajomstiev, bindingov, modelov alebo
nasadení si najprv načítaj
[cloudflare-secrets-store skill](.agents/skills/cloudflare-secrets-store/SKILL.md).
Pred deployom spusti čisto metadátový test:
`node Trinity/scripts/secrets-store-doctor.mjs`.
Cloudflare account Secrets Store používa `await env.BINDING.get()`,
nie čítanie textu z konfigurácie. Rozsah `workers` a oprávnenia
nasadzujúceho účtu sa musia overiť osobitne.

Cloudflare v `Trinity/wrangler.jsonc` používa `--env staging`,
nie historický názov `--env development`.
Súbor `C:\Users\saboi\.env` je len existujúca lokálna
vývojová konfigurácia mimo repozitára; **nie je zdrojom cloudových
Secrets Store hodnôt**. Skutočné produkčné hodnoty nikdy nekopíruj do
súborov, logov, komentárov, modelových promptov ani Gitu. Kľúč
zverejnený v chate sa nesmie použiť; okamžite ho zrušiť.
Antigravity používajúci tento skill musí mať skutočne dostupné PC
a autorizovanú Cloudflare reláciu. Samotný commit neznamená inštaláciu
na lokálny PC ani nasadenie.

Pokyny pre agentov (Codex, Antigravity). S majiteľom (Sabo Ivan / Basterix) komunikuj po slovensky.

1. Najprv prečítaj [CODEX-ANTIGRAVITY-PROTOCOL.md](CODEX-ANTIGRAVITY-PROTOCOL.md) a posledný HANDOFF (aktuálne `CODEX-HANDOFF-FROM-ANTIGRAVITY-CORE-TOOLS-20261027.md`).
2. **Kľúče a tajomstvá:** spoločný súbor je `C:\Users\saboi\.env` (mimo repa). Postup, zákazy a inventár sú v protokole, sekcia 7.
   - Prítomnosť over: `powershell -NoProfile -File scripts/shared-env.ps1 -Check` (hodnoty sa nevypisujú).
   - Hodnoty nikdy nevypisuj, nelogovaj ani necommituj. Chýbajúci kľúč pridá majiteľ, nežiadaj ho do chatu.
3. Pred deployom testy, deploy s `--tag <git-sha>`, overenie `node Trinity/scripts/verify-deployment.mjs`. Produkčný merge/deploy len po staging dôkaze a rozhodnutí majiteľa.

## Zjednotené oprávnenia a vývoj

Kanonický repozitár: `uscolective-byte/Trinity-antigravity@main`.
Pre Codex, ChatGPT, Antigravity, Gemini, Copilot Studio a Ollama platí
[AGENT_ACCESS_AND_AUTONOMY.md](Trinity/docs/AGENT_ACCESS_AND_AUTONOMY.md).
Pri autorizovanom vlastníkovi automatizuj bezpečné úpravy, build, testy,
commity a PR. Model nie je samostatná identita ani poverenie.
Merge, zmeny infraštruktúry a produkcie vykonaj iba po skutočnej kontrole
scope, výsledkov CI a aktuálnom HANDOFF; nikdy nevymýšľaj receipt.
