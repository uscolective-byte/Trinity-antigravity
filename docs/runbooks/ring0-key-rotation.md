# Runbook — Ring 0 a rotácia kľúčov

## Existujúce mechanizmy

- packages/contracts/src/tap.js definuje TapKeyManager a TapTokenEngine.
- TAP používa RSASSA-PKCS1-v1_5 / SHA-256 (JWT alg RS256).
- Token obsahuje kid, iat, exp, iss=trinity-ring0 a aud=aura-fleet.
- verify kontroluje podpis a expiráciu.
- Local-Gateway vyžaduje TRINITY_LOCAL_TOKEN; README opisuje DPAPI uloženie.
- Lokálna Root identita používa Windows username a SID z OS identity.

## Kritické zistenia

- generateKeyPair vytvára extractable key pair.
- Kód obsahuje export privátneho kľúča do PKCS#8.
- importPrivateKey nastavuje extractable=true.
- Funkcia secureZeroBuffer sa v preskúmaných zdrojoch nenašla.
- TAP verify tu nekontroluje iss, aud ani allowlist kid.
- Dual-Key Overlap/retirement workflow sa nepotvrdil.

Nemožno teda tvrdiť, že privátne kľúče sa nikdy neexportujú alebo že rotácia bez prestoja je hotová.

## Cieľový bezpečný protokol

1. Generovať kľúč v dôveryhodnom KMS/HSM; preferovať neexportovateľný privátny kľúč.
2. Verejný kľúč publikovať s unikátnym kid.
3. Overovače nakonfigurovať na súčasné prijímanie starého a nového verejného kľúča.
4. Nové tokeny podpisovať novým kľúčom.
5. Počkať minimálne maximálnu životnosť tokenu + clock-skew + cache TTL.
6. Overiť, že starý kid už nie je používaný.
7. Odobrať starý verejný kľúč a bezpečne zrušiť starý privátny kľúč v KMS.
8. Vytvoriť audit receipt rotácie bez uloženia secret material.

## Predrotácia PowerShell

~~~powershell
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'NODE_NOT_FOUND' }
git status --short
npm --prefix packages/contracts test
if ($LASTEXITCODE -ne 0) { throw 'CONTRACT_TESTS_FAILED' }
npm --prefix packages/crypto-core test
if ($LASTEXITCODE -ne 0) { throw 'CRYPTO_TESTS_FAILED' }
~~~

Samotnú aktiváciu kľúča vykonaj až po zavedení KMS-backed dual-key verifiera. Neexportuj PKCS#8 do súboru ani terminálu. secureZeroBuffer nie je zárukou vymazania kópie z GC heapu; preferuj neexportovateľný kľúč a krátko žijúce buffery.


## Best-effort nulovanie bufferov

V runtime možno pred uvoľnením vlastného mutable bufferu vykonať:

~~~js
export function secureZeroBuffer(view) {
  if (!ArrayBuffer.isView(view) || typeof view.fill !== 'function') {
    throw new TypeError('EXPECTED_MUTABLE_TYPED_ARRAY');
  }
  view.fill(0);
}
~~~

Toto je iba best-effort nulovanie danej view. Nevymaže kópie, ktoré už vytvorili runtime, garbage collector, crypto provider alebo serializácia. Nie je to náhrada neexportovateľného KMS/HSM kľúča. Funkcia secureZeroBuffer sa v aktuálnom zdrojovom stave nenašla.
