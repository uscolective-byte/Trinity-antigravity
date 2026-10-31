# ANTIGRAVITY — aktuálna Trinity z GitHubu (31.10.2026)

**Úloha:** pracovať na najnovšom správnom zdroji Trinity; NESMIEŠ zmazať rozpracované lokálne úpravy. Toto je GitHub handoff, NIE dôkaz, že lokálna Antigravity správu už prijala.

## Ktorá verzia je aktuálna?

Kanonický GitHub: https://github.com/uscolective-byte/Trinity-antigravity

- Aktuálny **main**: `df655686ece1f1048a0b63807aeee88c3a8dc6f2` (merged PR #25; schválené len Git merge, **nie doložený cloud deploy**).
- Najnovšia **rozpracovaná opravná vetva**: `feat/unified-agent-connection-bridge-20261031`, commit `052408c7740a01d7ebc611201d13bbb1100a8b94`; PR **#26 je stále DRAFT, OPEN, NOT MERGED**, 22 zmenených súborov.
- PR #26 opravuje Cloudflare staging chybu D1 10181, pripravuje Trinity/Cloudflare/PC/Codex/ChatGPT/Antigravity/Gemini/Copilot MCP a korektné hlásenie PC telemetrie. To je **najnovšia pracovná verzia**, nie schválené vydanie.
- **GitHub CI runner zlyháva bez pridelenia runnera**, nie sú potvrdené úspešné Node/Cloudflare tests.
- Produkčné a staging nasadenie nie je overené a nesmie byť odvodzované iba zo SHA.

## DÔLEŽITÉ: lokálny PC je zablokovaný, chráň prácu

Používateľ poskytol `git status --short` s vyše 400 zmenenými alebo staged súbormi v `C:\Users\saboi\Trinity-antigravity`. Pokus `git switch` zlyhal na existujúcom `.git/index.lock`; `npm run d1:doctor`/ `d1:test` hlásili Missing script, pretože vetva sa **neprepla**.

**NIKDY** tu nespúšťaj `git reset --hard`, `git clean -fd`, `git switch -f`, `git checkout -f`, nevymaž lock, kým nie je zistený aktívny proces, ani neprepíš rozpracované súbory.

### Bezpečný prístup k najnovšiemu kódu

Po overení skutočného online PC a pred začiatkom práce vytvor **samostatnú čistú kópiu**. Pôvodné `C:\Users\saboi\Trinity-antigravity` zostáva úplne nedotknuté:

```powershell
$repoUrl = 'https://github.com/uscolective-byte/Trinity-antigravity.git'
$target = Join-Path $env:USERPROFILE 'Trinity-bridge-test'
if (Test-Path -LiteralPath $target) { throw 'Cieľ existuje: neprepisovať, zvoľ iné meno.' }
git clone --single-branch --branch feat/unified-agent-connection-bridge-20261031 $repoUrl $target
if ($LASTEXITCODE -ne 0) { throw 'Git clone zlyhal.' }
git -C $target log -1 --format='%H%n%s'
Set-Location (Join-Path $target 'Trinity')
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci zlyhalo.' }
npm run d1:test
npm run secrets:test
npm run build:staging
```

Zapisuj exit kódy a prípadné chyby, nikdy nevypisuj tokeny. `npm run build:staging` je dry-run, nie nasadenie.

## Nasadenie a prepojenie

1. Najprv prečítaj `AGENTS.md`, `GEMINI.md`, `TEAM-HANDOFF.md`, `.agents/skills/cloudflare-secrets-store/SKILL.md`, `Trinity/docs/UNIFIED_AGENT_CONNECTIONS.md`.
2. Na autorizovanom PC over aktuálny účet `wrangler whoami`, potom `wrangler d1 list --json`, `npm run d1:doctor` **bez zmeny databáz**.
3. Zobrazené D1: `admin-db`, `trinity-development`, `trinity-v03`, `trinity-db`. Chýbajúcu `trinity-pc-bridge` DB nesmieš nahradiť produkčnou. PR #26 odstránil neexistujúci `trinity_basterix` z **env.staging**; nie z produkcie.
4. Pozor: staging stále zdieľa `rea` D1, `Mastermind` KV a `ARTIFACTS` R2 s produkciou. Mutačné testy sú blokované až do oddelenia úložísk.
5. Správne `wrangler` prostredie je **staging**, nie historické `development`.
6. Lokálny Desktop Commander `Basterix` bol pri poslednej kontrole **Offline**. Bez online spojenia a úspešného MCP `initialize`/ `tools/list` nehlás Antigravity ani PC ako prepojený.
7. **ŽIADNE API tokeny z chatu**. Cloudflare Secrets Store má vlastné obmedzené bindingy; `await env.BINDING.get()` iba v dôveryhodnom runtime. Externé ChatGPT/Copilot/Gemini/Codex účty vyžadujú vlastné OAuth/scopes.
8. Spusť a dolož skutočné Node testy + Wrangler dry-run, zabezpeč CI runner, až potom reálne staging deploy a overenie health/commit. Nenasadzuj na produkciu bez potvrdeného rollbacku a izolácie.

**Očakávaný HANDOFF od Antigravity:** overený lokálny Git SHA a vetva; Node test exit codes; Wrangler konto a D1 metadata bez secretov; výsledok dry-run; prípadný deploy ID a health receipt. Neoznačuj nevykonané činnosti ako completed.
