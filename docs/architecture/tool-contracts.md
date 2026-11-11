# Typizované kontrakty nástrojov

## Existujúci runtime kontrakt

Repozitár obsahuje Zod 4 v packages/contracts:
- MessageSchema, ReceiptSchema a Status v src/tap.js;
- UnifiedReceiptSchema, EvidenceSchema a LedgerProofSchema v src/receipt.js;
- JSON Schema artefakty v packages/contracts/schema;
- príkazy schema a schema:check.

TAP správy používajú strict objekty, enumy, UUID, limity dĺžok a stavové invarianty.

## Povinný štandard pre nové tool špecifikácie

Každá nová špecifikácia má definovať stabilné tool_id, verziu, Zod vstupnú schému s .strict(), generované JSON Schema, JSON-LD identitu, limity, autorizáciu, idempotency, timeout, výstup a chybové kódy.

- [JSON Schema Tool Invocation](tool-invocation.schema.json)
- [JSON-LD Context](tool-invocation.context.jsonld)

### Referenčný Zod kontrakt

~~~js
import { z } from 'zod';
export const ToolInvocationSchema = z.object({
  protocol: z.literal('trinity.tool.v1'),
  tool_id: z.string().min(1).max(100),
  schema_version: z.string().regex(/^\\d+\\.\\d+\\.\\d+$/),
  request_id: z.string().uuid(),
  idempotency_key: z.string().min(1).max(200),
  issued_at: z.iso.datetime(),
  timeout_ms: z.number().int().min(100).max(120_000),
  arguments: z.record(z.string(), z.json())
}).strict();
~~~

Toto je referenčná šablóna pre nové tool kontrakty. JSON Schema je samostatný interoperabilný artefakt; v CI sa musí kontrolovať, že je generovaný z rovnakej Zod definície. JSON-LD poskytuje sémantickú identitu, nie náhradu vstupnej validácie.

### JSON-LD obálka

~~~json
{
  "@context": "tool-invocation.context.jsonld",
  "@id": "urn:trinity:tool-invocation:REQUEST_UUID",
  "@type": "ToolInvocation",
  "protocol": "trinity.tool.v1",
  "tool_id": "example.read",
  "schema_version": "1.0.0",
  "request_id": "00000000-0000-4000-8000-000000000001",
  "idempotency_key": "example:request:1",
  "issued_at": "2026-11-10T00:00:00Z",
  "timeout_ms": 10000,
  "arguments": {}
}
~~~

## Edge validačný pipeline

1. Parse JSON a limit veľkosti.
2. Overiť autentizáciu/TAP.
3. Vybrať schému podľa tool_id + schema_version.
4. Zod safeParse; odmietnuť neznáme polia.
5. Overiť environment, capability, budget a idempotency.
6. Až potom zavolať Service Binding.
7. Uložiť receipt a audit metadáta.

**Otvorený bod:** Zod kontrakty existujú, ale nebola potvrdená centrálna mapa všetkých tool ID na schémy ani univerzálny middleware pred každým Service Bindingom. Kým nie je vytvorený takýto registry, nemožno deklarovať, že každý nástroj má už vlastnú schému.
