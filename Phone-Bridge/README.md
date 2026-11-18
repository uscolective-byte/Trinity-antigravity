# Trinity Phone Bridge — implementation status (Android + iOS)

This folder contains the **shared command protocol and HMAC envelope**. The
browser companion is served by the main Worker at `/phone` after deployment.

## Implemented source code on main

- `shared/protocol.mjs`: action allowlist, strict expiry and bounded payloads.
- `shared/secure-envelope.mjs`: HMAC-SHA256 signing and verification for
  per-device commands; timestamp, device identity and nonce are signed together.
  Verification rejects a mismatched key/device, stale timestamp, tampering and
  duplicate nonce when backed by an **atomic durable** consumeNonce store.
- `shared/*.test.mjs`: regression tests (committed, not evidence of CI success).
- `Trinity/src/phone-bridge-ui.js`: no-install mobile browser companion with
  user-initiated battery probe (when supported), download request, photo picker,
  GPS, clipboard, vibration and local notifications. Runs on Android and iOS
  subject to each browser's API support. The UI does **not** transmit captured
  photo, GPS, clipboard or file data to the server.
- `Trinity/src/index.js`: route `GET /phone` and `GET /phone/bridge.js`.

## Not implemented / not verified

- No account/device pairing or six-digit PIN/QR enrollment service.
- No Cloudflare command queue, per-device authentication gateway, durable D1
  replay store or remote delivery to a phone.
- No native Android/iOS background service, push delivery or remote
  camera/file execution. iOS prohibits unrestricted background execution and
  arbitrary filesystem access.
- The browser cannot guarantee a file has been saved: it can only initiate
  a download and report what the browser accepted.
- No real phone has been connected or tested through this source change.
- No Cloudflare deployment has been verified by this repository change.

## Security requirements for future gateway

1. Owner/admin session required to pair and enqueue; separate per-device
   identity, explicit capabilities and instant revocation.
2. Scan-only high-entropy one-time pairing token (not a reusable six-digit PIN).
   Persist only hashed secrets, with rate limits and expiration.
3. Signature verification of exact canonical envelope + timestamp + nonce;
   atomically insert `(device_id, nonce)` into D1 with uniqueness. An in-memory
   set cannot protect against replay across Workers.
4. Bound all tasks to registered devices, expiry and user approval. Never
   auto-accept dangerous actions based on untrusted chat text.
5. Device response must be authenticated and audited. Device self-reports are
   **not independent evidence** that a physical action occurred.
6. Test with real Android and iOS devices before exposing remote commands.

## Truth policy

The browser page is usable for **manual local actions only**.
A signed envelope proves message integrity and key possession, not execution.
No `executed` or `connected` claims may be shown without verified evidence.

No git clone, separate repository, or new branch is required; all changes
belong in the canonical repository `uscolective-byte/Trinity-antigravity`
on `main`.
