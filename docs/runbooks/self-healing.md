# Runbook — AST self-healing a evolučné mantinely

## Overené existujúce hranice

- Local Gateway má capability/risk/approval metadáta v Local-Gateway/src/policy.mjs.
- Zmenové akcie majú approval flag.
- Návrh prechádza proposal → approval → execution → receipt.
- selfwrite má byť obmedzený na projekt Trinity a používa kontrolu SHA-256 podľa README.
- Súborová politika blokuje citlivé cesty a cesty mimo workspace.
- Skript nie je OS sandbox; beží s oprávneniami Windows používateľa.

## Povinná cieľová politika

1. Žiadna zmena packages/contracts/** bez explicitného schválenia/podpisu BASTERIX_ROOT.
2. Každá automatická zmena má pred zmenou diff snapshot a po zmene auditný diff report.
3. Pred commitom musí prejsť contract schema check, syntetické regresné testy, unit testy a build.
4. Každý write má base SHA-256; zmena súboru medzi inspect a write operáciu zastaví.
5. Automatický commit/push/deploy je zakázaný bez samostatných approval gates.
6. Neúspešný test smie rollbackovať iba presný patch, nie celý worktree.
7. Receipt musí obsahovať actor, approval ID, changed paths, before/after hashes, test results a exit codes.

## Lokálny postup

~~~powershell
$ErrorActionPreference = 'Stop'
git status --short
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'DIFF_CHECK_FAILED' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$audit = Join-Path $env:TEMP "trinity-selfheal-$stamp"
New-Item -ItemType Directory $audit | Out-Null
git diff --binary | Set-Content (Join-Path $audit 'working-tree.patch')
git status --short | Set-Content (Join-Path $audit 'status-before.txt')
npm --prefix packages/contracts run schema:check
if ($LASTEXITCODE -ne 0) { throw 'CONTRACT_SCHEMA_CHECK_FAILED' }
npm --prefix packages/contracts test
if ($LASTEXITCODE -ne 0) { throw 'CONTRACT_TESTS_FAILED' }
npm --prefix packages/crypto-core test
if ($LASTEXITCODE -ne 0) { throw 'CRYPTO_TESTS_FAILED' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'ROOT_TESTS_FAILED' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'FINAL_DIFF_CHECK_FAILED' }
git diff --binary | Set-Content (Join-Path $audit 'working-tree-after.patch')
git status --short | Set-Content (Join-Path $audit 'status-after.txt')
Write-Output "AUDIT_DIR=$audit"
~~~

## Rollback hranica

Rollback je povolený len pre presný patch daného self-healing behu a len ak sa base hash nezmenil. Nepoužívaj git reset --hard, git clean -fd ani hromadný checkout. Pri súbežných zmenách zastav a vyžiadaj manuálnu kontrolu.

## Otvorený implementačný bod

Univerzálny AST engine policy, podpisový gate pre packages/contracts a povinný diff report pred každým commitom neboli potvrdené. Táto kapitola definuje požadovaný bezpečný kontrakt, nie tvrdenie o už aktívnom enforcemente.
