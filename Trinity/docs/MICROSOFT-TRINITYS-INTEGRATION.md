# Trinitys — Microsoft Copilot Studio + Entra / MSA / Graph

## Scope

Implemented in Local-Desktop only: two separately authenticated profiles (Entra organization and personal Microsoft account), Microsoft device-code OAuth, Windows DPAPI-backed token storage, read-only Microsoft Graph, and Guarded Action approval cards. These features are staged in a GitHub branch, not deployed to the PC.

Agent name: Trinitys (Microsoft Copilot Studio).
Power Platform Environment ID: b2ffa450-7427-e2dd-89dd-7df6a8c0a149.
Bot ID: 767f155a-5b45-15fc-17b1-e4d712682945.
Blueprint ID: 25664c89-cea5-4ab6-b924-a54fd8a19ae0.
Service Principal Object ID: d77169b1-e300-42da-88c3-e8df11b82604.

These identifiers are not an OAuth Application Client ID or Direct Line secret.

## Profiles

| Identity | OAuth authority | Display |
|---|---|---|
| usc31@saboivan2008gmail.onmicrosoft.com | organizations | Entra / M365 tenant |
| saboivan2008@gmail.com | consumers | Personal Microsoft account |

Local UI: Prepojenia -> Microsoft Trinitys. OAuth credentials and tokens are written only via existing Local-Desktop/modules/vault.mjs (Windows DPAPI). The user must provide a valid Entra App Registration Application Client ID, with public-client device code flow and supported account types. Admin consent may be needed for tenant account.

Flow: start device login, enter the short user code at the Microsoft URL, explicitly complete login, call Graph /me and verify the expected account email, then allow read-only Graph calls to /me/messages, /me/calendar/events, /me/drive/root.

Separate write scopes are opted into explicitly. The sendMail, createEvent, and uploadFile operations first produce a proposed action and require a second confirmation in the local Guarded Action Card. Each proposal is consumed before its remote call to avoid replay. No automatic retry of a remote mutation. Proposal state and receipts are local in-memory, reset on process restart.

Direct Line is already implemented in Local-Desktop/modules/providers.mjs. A dedicated manual Trinitys test performs a non-sensitive prompt and only reports verified after a real response from the configured Direct Line channel. This is not cryptographic proof of the exact Bot ID.

## Cloudflare and App Hub — not yet deployed

The Cloudflare Graph engine, live bidirectional routing between Trinitys and Trinity, and the dedicated auru.dev Omni-Dev App Hub card are NOT delivered by this PR. The active shared TEAM-HANDOFF records overlapping ownership of Trinity/src/index.js and Trinity/public/assistant/chat.js.txt by another agent. Those files must not be overwritten without handoff.

Existing Trinity/src/secret-vault.js stores AES-GCM-encrypted secrets in D1 using TRINITY_VAULT_KEY; plaintext KV is not an acceptable vault. Future cloud connector needs separate tenant/MSA authorized sessions, encrypted tokens, scope-specific read API, and writes via the existing ops_system_actions proposed/approved flow, plus audit receipts, expiry and replay protection.

No token values, Direct Line secret, or OAuth private keys appear in repository code or this documentation. The Microsoft Copilot conversation share link provided by owner redirected to a sign-in page, so its conversation content was not readable and was not used as a source of new settings.

## Required verification

From repo root:
- node --test Local-Desktop/tests/microsoft.test.mjs
- node --test Local-Desktop/tests/modules.test.mjs
- node --test Local-Desktop/tests/local.test.mjs
- npm run check

These checks must pass before merge. A mocked Graph test does not prove real Microsoft connectivity. Do not claim account ACTIVE without a successful OAuth consent and API identity check.

GitHub Actions currently reported a billing lock preventing jobs from starting. Actual live Cloudflare staging and production deployment are explicitly out of scope of this isolated PR; perform only after the approved TEST -> HANDOFF -> ACK -> staging -> receipt sequence.
