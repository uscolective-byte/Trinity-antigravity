# Trinity Phone Bridge — implementation status

This directory contains a **shared command validation contract only**. It is not a connected Android/iOS device bridge. Do not report a device action as successful unless a real, paired device reports its execution and the result is verified.

## Current implementation

- `shared/protocol.mjs`: action allowlist, input limits, expiry and safe relative-path syntax, structured receipts.
- `shared/protocol.test.mjs`: Node built-in test suite (`node --test Phone-Bridge/shared/protocol.test.mjs`).

## Required before production

1. Authenticated account/device pairing with revocation and per-device permissions.
2. Cloudflare Worker API with persistent queue, per-device keys, signed messages, nonce/replay prevention, audit trail and rate limiting.
3. Android native companion app (Kotlin) using Android storage access framework and explicit runtime permissions.
4. iOS native companion app (Swift/App Intents) using document picker or app container; iOS cannot grant arbitrary filesystem or unrestricted background execution.
5. Per-command on-device consent for sensitive actions and verified receipts, including failure paths.
6. Real-device integration tests, security review, production configuration and deployment approval.

**Security:** Client-side validation alone is not an authorization boundary. Resolve and constrain filesystem paths in the native client, prevent symlink escapes, require explicit overwrite approval, and do not expose device commands to guest sessions. No API secrets should be committed to this repository.

**Scope:** Work only on the existing `main` branch; do not clone the repository or simulate device results.
