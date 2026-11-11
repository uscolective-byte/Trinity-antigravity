# Runbook â€” build, backup, D1 migrĂˇcie a deploy

## BezpeÄŤnostnĂ© pravidlĂˇ

- Najprv staging; produkcia vyĹľaduje samostatnĂ© schvĂˇlenie.
- Pred migrĂˇciou musĂ­ existovaĹĄ ÄŤerstvĂ˝ export a potvrdenĂ© DB ID.
- Destructive rollback sa nespĂşĹˇĹĄa automaticky.
- Wrangler pouĹľĂ­va existujĂşcu bezpeÄŤnĂş autentizĂˇciu; tokeny nevkladaj do prĂ­kazov.

## 1. Preflight PowerShell

~~~powershell
$ErrorActionPreference = 'Stop'
foreach ($name in @('node','npm','git')) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "DEPENDENCY_MISSING:$name"
  }
}
node --version
npm --version
git status --short --branch
git diff --check
if ($LASTEXITCODE -ne 0) { throw "GIT_DIFF_CHECK_FAILED:$LASTEXITCODE" }
~~~

## 2. Preflight Bash

~~~bash
set -euo pipefail
for cmd in node npm git; do
  command -v "$cmd" >/dev/null || { echo "DEPENDENCY_MISSING:$cmd" >&2; exit 10; }
done
node --version
npm --version
git status --short --branch
git diff --check
~~~

## 3. Build a test

~~~powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "NPM_CI_FAILED:$LASTEXITCODE" }
npm test
if ($LASTEXITCODE -ne 0) { throw "TESTS_FAILED:$LASTEXITCODE" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "BUILD_FAILED:$LASTEXITCODE" }
~~~

## 4. D1 export pred migrĂˇciou

Najprv si over presnĂş syntaxe nainĹˇtalovanej Wrangler verzie pomocou node node_modules/wrangler/bin/wrangler.js d1 export --help. ZĂˇlohu ukladaj mimo repozitĂˇra a chrĂˇĹ ACL.

~~~powershell
$ErrorActionPreference = 'Stop'
$dbName = 'trinity-development'
$envName = 'staging'
$backupDir = Join-Path $env:TEMP ('trinity-d1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupDir | Out-Null
$backupFile = Join-Path $backupDir ($dbName + '.sql')
# Po potvrdenĂ­ syntaxe pre konkrĂ©tnu Wrangler verziu:
node node_modules/wrangler/bin/wrangler.js d1 export $dbName --remote --output $backupFile --config Trinity/wrangler.jsonc --env $envName
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
  throw 'D1_BACKUP_FAILED'
}
Get-FileHash $backupFile -Algorithm SHA256
~~~

Pred exportom over wrangler d1 list, sprĂˇvny environment, databĂˇzovĂ˝ nĂˇzov/ID, kompletnosĹĄ exportu a ACL. NevykonĂˇvaj export do tracked prieÄŤinka.

## 5. Apply iba po schvĂˇlenĂ­

~~~powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations list $dbName --remote --config Trinity/wrangler.jsonc --env staging
if ($LASTEXITCODE -ne 0) { throw 'D1_MIGRATION_STATUS_FAILED' }
# Spusti iba po review, zĂˇlohe a explicitnom schvĂˇlenĂ­:
node node_modules/wrangler/bin/wrangler.js d1 migrations apply $dbName --remote --config Trinity/wrangler.jsonc --env staging
if ($LASTEXITCODE -ne 0) { throw 'D1_MIGRATION_APPLY_FAILED' }
~~~

## 6. Invarianty

- migration status potvrdzuje oÄŤakĂˇvanĂş migrĂˇciu;
- oÄŤakĂˇvanĂ© tabuÄľky, indexy a triggers existujĂş;
- poÄŤty riadkov a referenÄŤnĂ© hashe zodpovedajĂş plĂˇnu;
- receipt integrity testy prejdĂş;
- exitCode === 0 je procesnĂ˝ invariant, nie dĂ´kaz sprĂˇvnosti dĂˇt.

## 7. Rollback / recovery

1. Zastav ÄŹalĹˇie write operĂˇcie a oznaÄŤ systĂ©m degraded.
2. Zachovaj logy, migration status, backup SQL a SHA-256.
3. PouĹľi len otestovanĂş down-migrĂˇciu, ak existuje.
4. Inak obnov export do izolovanej recovery DB, over integritu a naplĂˇnuj cutover cez samostatnĂ© schvĂˇlenie.
5. Nikdy neprepisuj produkÄŤnĂş DB exportom bez recovery plĂˇnu.

D1 SQL export nie je automatickĂˇ point-in-time rollback funkcia. AutomatickĂ˝ destructive rollback sa tĂ˝mto runbookom nezavĂˇdza.



## Deterministický automatizovaný runbook

V repozitári je pomocný skript docs/scripts/d1-migration-runbook.ps1. Základný režim robí preflight, kontrolu migration status, export D1 a SHA-256 zálohy; migráciu nevykoná.

~~~powershell
# Iba preflight + backup + migration status, bez zápisu:
powershell.exe -NoProfile -File docs/scripts/d1-migration-runbook.ps1 -Database trinity-development -Environment staging -Config Trinity/wrangler.jsonc

# Apply vyžaduje vlastný post-migration invariant checker a explicitný parameter:
powershell.exe -NoProfile -File docs/scripts/d1-migration-runbook.ps1 -Database trinity-development -Environment staging -Config Trinity/wrangler.jsonc -Apply -InvariantCheck scripts/check-staging-invariants.ps1

# Production vyžaduje aj samostatné potvrdenie:
powershell.exe -NoProfile -File docs/scripts/d1-migration-runbook.ps1 -Database trinity-v03 -Environment production -Config Trinity/wrangler.jsonc -Apply -ConfirmProduction -InvariantCheck scripts/check-production-invariants.ps1
~~~

### Exit code kontrakt

| Exit code | Význam |
|---:|---|
| 0 | preflight/backup úspešný alebo apply + invariants úspešné |
| 10 | chýbajúca závislosť, config alebo povinné schválenie/checker |
| 20 | D1 list/auth/target chyba |
| 30 | migration status chyba |
| 40 | backup export zlyhal alebo je prázdny |
| 50 | migration apply zlyhal |
| 60 | post-migration invariant zlyhal; zastav writes a spusti recovery plán |
| 70 | neočakávaná chyba runbooku |

Skript nikdy automaticky neprepisuje produkčnú DB backupom. Exit 60 vyžaduje manuálne rozhodnutie a recovery do izolovanej databázy; automatický destructive rollback by mohol zničiť nové validné zápisy.
