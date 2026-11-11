# Sovereign Ledger — MMR audit proof

## Stav implementácie

V tomto worktree je modul packages/crypto-core/src/merkle-mountain-range.js s append, node positions, peaks, bagged root, inclusion proof a verifierom.

Legacy MerkleExecutionTree v proof-of-execution.js používa komutatívny hash páru. MMR používa iný domain-separated a orientovaný hash. Formáty sa nesmú zamieňať.

Treasury endpoint POST /api/treasury/poe/epoch/commit validuje receipts, tvorí MMR root a vracia peaks a inclusion proofs. Epoch tabuľka sa vytvára v runtime handleri a dostáva immutable update/delete triggers.

**Kritické:** epoch root v aktuálnom endpoint-e nie je kryptograficky podpísaný. persisted=true znamená zápis do D1, nie podpis. Audítor potrebuje dôveryhodný root cez samostatný podpísaný checkpoint/trust anchor. Podpis epochy nemožno odvodiť z MMR rootu.

## Matematika MMR

Počet listov N sa rozloží na binárne mocniny. Každý nastavený bit od najvyššieho po najnižší je jedna hora s výškou h_i:

N = Σ 2^h_i

Počet uzlov bez duplicitného paddingu:

nodeCount = 2N - popcount(N)

Peaks sú root uzly hôr v poradí zľava doprava. Pozície uzlov sú zero-based v poradí append; pole nodes obsahuje listy aj rodičov.

## Hash domény

- Pomocný hashMmrLeaf(value): Keccak256(0x00 || UTF8(value)).
- Parent: Keccak256(0x01 || left32 || right32).
- Bagging: od pravého peak-u sa smerom doľava počíta Keccak256(0x02 || uint32_be(left_height) || left_peak || bag).
- Prázdny MMR root: Keccak256(0x02).

V PoE epoch flow sú leaves receipt hash z hashLeaf(receipt), nie pomocný hashMmrLeaf. Audítor musí použiť presnú canonicalization z proof-of-execution.js.

## Verifikácia v Node.js

~~~js
import { MerkleMountainRange, verifyMmrProof } from '../packages/crypto-core/src/merkle-mountain-range.js';
import { hashLeaf } from '../packages/crypto-core/src/proof-of-execution.js';
const leaf = hashLeaf(receipt);
const valid = verifyMmrProof(leaf, inclusionProof, trustedEpochRoot);
if (!valid) throw new Error('MMR_INCLUSION_PROOF_INVALID');
~~~

Proof obsahuje format, leafIndex, leafCount, mountainStart, mountainHeight, peakIndex, siblings a peaks. Verifier kontroluje očakávané výšky peaks podľa binárneho rozkladu leafCount.

## PowerShell test run

~~~powershell
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction Stop
node --test packages/crypto-core/test/merkle-mountain-range.test.mjs
if ($LASTEXITCODE -ne 0) { throw "MMR_TEST_FAILED:$LASTEXITCODE" }
~~~

PowerShell tu nedefinuje druhú kryptografickú implementáciu. Na nezávislý audit použi auditovaný JS verifier alebo nezávislú implementáciu s golden vectors.

## Otvorené body

- podpísaný epoch checkpoint s key ID a rotáciou verejných kľúčov;
- nezávislý export peak/root metadát;
- inclusion proof API pre historické epochy;
- concurrency-safe append/persistence;
- nezávislé golden test vectors a trust-anchor auditor.

MMR dokazuje inclusion vzhľadom na dôveryhodný root; sám osebe nedokazuje pravosť rootu.


## Samostatný CLI verifier

Pripravený skript docs/scripts/verify-mmr-proof.mjs načíta receipt JSON, proof JSON, dôveryhodný root a leaf index. Overí receipt leaf cez kanonickú hashLeaf funkciu a následne MMR inclusion proof.

~~~powershell
node docs/scripts/verify-mmr-proof.mjs .\\audit\\receipt.json .\\audit\\proof.json 0xTRUSTED_64_HEX_ROOT 12
if ($LASTEXITCODE -ne 0) { throw 'MMR_AUDIT_PROOF_FAILED' }
~~~

Proof JSON môže byť priamo inclusion proof alebo objekt obsahujúci pole proof. Root musí pochádzať z dôveryhodného checkpointu mimo auditovaného requestu. CLI úmyselne nevyhlasuje podpis epochy za overený: podpisový checkpoint v aktuálnom treasury flow nie je implementovaný.
