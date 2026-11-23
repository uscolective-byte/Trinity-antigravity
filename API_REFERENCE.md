# TRINITY OMNI-CORE — API REFERENCE

**Version:** `11.1.0`  
**Authority:** Basterix (Sole Owner & Chief Architect)  
**Dual-Language Architecture:** English internal engineering layer / Slovak user communication layer.

---

## 1. Cloudflare Edge Endpoints (`https://auru.space` & `https://auru.dev` — Unified Production Worker `trinity`)

### `GET /api/status`
Public status endpoint returning the live TRINITY OMNI-CORE status, owner authority metadata, bound Cloudflare resources, and integration metadata (zero secret values).
- **Response (`200 OK`):**
```json
{
  "status": "ONLINE",
  "service": "TRINITY OMNI-CORE",
  "version": "11.1.0",
  "environment": "production",
  "host": "auru.dev | auru.space",
  "mode": "omni-dev | production",
  "root_authority": {
    "sole_owner": "Basterix",
    "role": "Chief Architect & Root Administrator",
    "code_modification_policy": "STRICT_MANUAL_CONSENT_ONLY",
    "windows_users": ["saboi", "basterix"],
    "google_accounts": [
      "saboivan2008@gmail.com",
      "uscolective@gmail.com",
      "cadjavadvocecka013@gmail.com"
    ],
    "phone_channels": 4,
    "legal_clauses_count": 20
  },
  "bindings": {
    "d1_sovereign_ledger": true,
    "kv_mastermind": true,
    "kv_pc_state": true,
    "r2_artifacts": true,
    "workers_ai": true,
    "memory_service": true
  }
}
```

### `GET /health` & `GET /api/health`
Worker liveness, runtime version (`11.1.0`), canonical source (`uscolective-byte/Trinity-antigravity@main`), deployment commit tag, and `truth_mode: "evidence-required"`.

### `GET /ready`
Deep readiness verification of Cloudflare D1 `trinity-v03`, schema tables, and cache bindings.

### Google AI Studio Bridge (`/api/assistant/ai-studio/*`)
All endpoints require an authenticated session (`401` when unauthenticated) and resolve credentials server-side via Worker secrets (`GOOGLE_AI_STUDIO_API_KEY` / `GEMINI_API_KEY`), Cloudflare Secrets Store (`.get()`), or encrypted AES-GCM D1 Vault (`google_ai_studio` / `gemini`), always sending `x-goog-api-key` header only (never `?key=`).

- **`GET /api/assistant/ai-studio/status`** — Metadata-only bridge configuration status (`live_verified: false`, `secret_values_accessed: false`, never reads secret values).
- **`GET /api/assistant/ai-studio/models`** — Discovers available Gemini models from `generativelanguage.googleapis.com/v1beta/models`.
- **`POST /api/assistant/ai-studio/verify`** — Admin-only (`403` for ordinary users) live probe verifying model listing and minimal `generateContent` execution.
- **`POST /api/assistant/ai-studio/generate`** — Direct text/JSON generation or SSE streaming (`stream: true`) with 404 model fallback and fail-closed auth/quota errors.
- **`POST /api/assistant/ai-studio/co-create`** — Multi-turn collaborative co-creation between Trinity and Google AI Studio (`{ task, mode, session_id?, model?, context?, artifact?, reply_language? }`), using English internal reasoning prompts and Slovak user synthesis by default, persisting bounded session turns in D1/KV.
- **`GET /api/assistant/ai-studio/sessions`** & **`GET /api/assistant/ai-studio/sessions/:id`** — Retrieve persisted co-creation sessions.

### Tetrakis (`$TTK`) Native Space (`GET /api/assistant/crypto/tetrakis`)
Returns fail-closed Base L2 ERC-20 contract verification status (`1,000,000,000 TTK` fixed supply, `market_price: null` under Truth Policy 2.1) and the 4 native ecosystem utility pillars (in-chat P2P payments, Mini-Apps/AI Studio/bot economy, domains/handles/digital assets, creator/compute economy & non-custodial Space).

### `POST /mcp`
JSON-RPC 2.0 endpoint for Model Context Protocol (MCP) clients, including `google_ai_studio_status`, `google_ai_studio_models`, and `google_ai_studio_cocreate`.

### `POST /api/mcp/invoke`
REST gateway for invoking registered Trinity tools (including `google_ai_studio`) with automatic Truth Policy 2.1 `receipt_id`.

---

## 2. Local System Bridge (`http://127.0.0.1:7788` — `system-bridge.js`)

### `GET /health` | `GET /api/status` | `GET /api/auth/status`
Overí stav lokálneho mosta na porte `7788`, výsledok kontroly autentického Windows SID zo systémového tokenu `[System.Security.Principal.WindowsIdentity]::GetCurrent()` a stav modulu `OmniDev Studio`.
- **Response (`200 OK`):**
```json
{
  "status": "ONLINE",
  "service": "Trinity Local System Bridge (OmniDev & Ring 0 Gate)",
  "port": 7788,
  "binding": "127.0.0.1",
  "windows_sid_validation": true,
  "active_operator": "saboi",
  "domain": "basterix",
  "is_root_authorized": true,
  "system_role": "BASTERIX_ROOT",
  "os_token_verified": true,
  "sid_verified": true,
  "omnidev_studio": {
    "status": "READY",
    "diagnostics_engine": "OmniDev-AST-Recovery-v3",
    "bridge_connected": true
  }
}
```

### `POST /api/omnidev/diagnose`
Spustí deterministickú AST a stack-trace diagnostiku pre `OmniDev Studio` a pripraví opravný Git diff podliehajúci Ring 0 schváleniu Basterixa.
- **Request Body:**
```json
{
  "errorText": "SyntaxError: Expected corresponding JSX closing tag for <div>",
  "filePath": "Trinity/src/studio.js",
  "sourceCode": "..."
}
```

### `POST /api/execute-privileged`
Chránená exekučná brána (`executePrivileged`). Vyžaduje kryptograficky/OS overenú identitu Basterixa. Akýkoľvek neoverený textový vstup (`email`, `phone`, `windowsUser` bez platného tokenu/podpisu/SID) je okamžite odmietnutý stavom `403 ACCESS DENIED` (`SPOOFED_UNVERIFIED_*_INPUT`).
