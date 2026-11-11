# Local Bridge Protocol

## Skutočná topológia

Local-Gateway/src/server.mjs vytvára Node HTTP server na 127.0.0.1:8791 (predvolené TRINITY_LOCAL_PORT). Port 7788 sa v preskúmanom serveri/README nepotvrdil. Nebol nájdený WebSocket upgrade handler; zdokumentované API je HTTP/JSON.

Cloud link a PC Bridge heartbeat sú samostatné odchádzajúce spojenia.

## Health a autorizácia

- GET /health je dostupný bez lokálneho tokenu.
- Ostatné cesty vyžadujú Authorization: Bearer <TRINITY_LOCAL_TOKEN>.
- Token sa porovnáva cez SHA-256 digest a timingSafeEqual.
- Bez nastaveného tokenu sú chránené požiadavky zamietnuté.
- Odpovede majú Cache-Control: no-store a X-Content-Type-Options: nosniff.

~~~powershell
$base = 'http://127.0.0.1:8791'
Invoke-RestMethod "$base/health"
# Token načítaj iba z DPAPI bootstrapu; nevkladaj ho do histórie ani logov.
~~~

## HTTP routes

| Metóda | Cesta | Účel |
|---|---|---|
| GET | /health | health a stav spojení |
| GET | /api/auth/status | lokálna identita a Root role |
| GET | /api/developer-tools | katalóg nástrojov |
| GET | /api/sync/status | cloud/PC bridge a queue |
| GET | /api/capabilities | capability |
| POST | /api/execute-privileged | privilegovaná akcia |
| POST | /api/read | bezpečné čítanie workspace |
| POST | /api/proposals | vytvorenie návrhu |
| POST | /api/proposals/{id}/approve | schválenie presným ID |
| POST | /api/proposals/{id}/execute | vykonanie schváleného návrhu |

## Desktop IPC

desktop.mjs používa PowerShell child process cez stdin. Operácie: list, launch, focus, type, screenshot. Písanie je obmedzené na Notepad a aplikácie sú definované allowlistom. Všeobecné Win32 RPC pre MoveWindow a ShowWindow sa nenašlo. SendKeys sa používa na vloženie textu cez clipboard do Notepadu.

## TAP a replay ochrana

packages/contracts/src/tap.js implementuje RS256 TAP JWT s kid, iat, exp, iss a aud. Lokálny bearer token je samostatný mechanizmus.

Jednorazová nonce kontrola v lokálnom gatewaye sa nepotvrdila. Tabuľka ops_consumed_nonces v D1 sama osebe nedokazuje, že ju každá bridge cesta používa. Replay protection je otvorený implementačný bod.

## Chybové stavy

Gateway vracia JSON error a HTTP status. Zdrojové kódy obsahujú 401 unauthorized, 400 invalid request, 403 authorization denial, 404 route not found, 413 oversized payload, 422 execution failure a 500 internal error. Supervisor loguje udalosti na stdout/stderr; nikdy nesmie logovať bearer token ani privátny kľúč.


## Cieľový RPC kontrakt pre budúce Win32 operácie

Nasledujúca obálka je cieľový návrh; aktuálny gateway zatiaľ neposkytuje všeobecné MoveWindow/ShowWindow/WebSocket RPC.

~~~json
{
  "protocol": "trinity.bridge.rpc.v1",
  "request_id": "00000000-0000-4000-8000-000000000001",
  "nonce": "base64url-256-bit-random",
  "issued_at": "2026-11-10T10:00:00Z",
  "expires_at": "2026-11-10T10:00:30Z",
  "operation": "window.move",
  "arguments": {
    "window_handle": "server-resolved-handle",
    "x": 100,
    "y": 100,
    "width": 1280,
    "height": 800
  },
  "tap": {
    "kid": "ring0-key-id",
    "token": "signed-TAP-JWT"
  }
}
~~~

Povolené operation ID musia byť allowlistované, nie voľné názvy Win32 funkcií. Window handle sa musí vyriešiť na serveri a overiť proti aktuálnemu procesu/session. SendKeys vyžaduje explicitný foreground target, obmedzený zoznam klávesových sekvencií a používateľské schválenie pre mutujúce akcie.

### Nonce / replay ochrana — požadované invarianty

1. Nonce musí mať minimálne 256 bitov kryptografickej náhodnosti.
2. Nonce je viazaný na request_id, principal, operation, payload hash a expiráciu.
3. Nonce sa spotrebuje atomicky pred vykonaním operácie; druhé použitie dostane 409 REPLAY_DETECTED.
4. Expirácia a clock-skew sa validujú server-side.
5. Zlyhanie nonce storage znamená fail-closed; nesmie sa pokračovať bez replay ochrany.
6. Nonce nesmie byť náhradou podpisu TAP ani autorizácie capability.

### Štruktúrovaná chyba supervisor procesu

~~~json
{
  "ok": false,
  "error": {
    "code": "WINDOW_TARGET_NOT_ALLOWED",
    "message": "Requested desktop target is not in the allowlist.",
    "retryable": false,
    "request_id": "00000000-0000-4000-8000-000000000001",
    "stage": "desktop_dispatch"
  }
}
~~~

Kódy majú byť stabilné a bez stack trace, tokenov, DPAPI blobov alebo interných secret názvov. Návrh RPC sa nesmie považovať za implementovaný, kým neexistuje server handler, Zod schéma, nonce store a integračné testy.
