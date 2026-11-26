---
name: cloudflare-secrets-store
description: >-
  Configure and diagnose Cloudflare account Secrets Store bindings for the
  unified production Trinity Worker, Gemini, Copilot, and Antigravity/Codex
  agents. Use before editing Wrangler configuration, adding provider keys, or
  verifying production deployments.
---

# Cloudflare Secrets Store — Trinity + Google Antigravity

The authoritative repository is `uscolective-byte/Trinity-antigravity` (`main` branch).
Follow `AGENTS.md` active development rules and Truth Policy 2.1 (`NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT`).

## Three different mechanisms

1. Account-level Cloudflare Secrets Store securely holds encrypted values.
2. Per-Worker Secrets are injected as ordinary encrypted environment strings.
3. Account Secrets Store bindings are objects: **`await env.BINDING.get()`**.
   Never treat such a binding as a string, print its value, put credentials
   into a URL, expose them through a public API, or store them in Git.

`TRINITY_MASTER` is the *Trinity controller name*, not a Secrets Store name
or a universal admin token. A configured binding is never proof of a verified
provider login.

## Current configuration (metadata only)

| Worker | Domains | Binding | Cloudflare secret |
| --- | --- | --- | --- |
| `trinity` (unified production) | `auru.space`, `auru.dev` | `OLLAMA_SECRET` | `ollama` |

- Source of truth: `Trinity/wrangler.jsonc` (mirrored to root `wrangler.jsonc` via `node scripts/sync-root-wrangler.mjs`).
- Unified single-production topology: Worker `trinity`, main D1 `trinity-v03`, KV `Mastermind`.
- Do not follow older instructions using `--env staging` or `--env development` — `env.staging` and `env.development` were consolidated away into the unified production Worker `trinity` (`production_bindings: ["OLLAMA_SECRET"]`, `staging_bindings: []`).

## Read-only preflight (Linux / macOS / PowerShell)

```bash
node Trinity/scripts/secrets-store-doctor.mjs
node Trinity/scripts/cloudflare-env-audit.mjs --strict
node scripts/sync-root-wrangler.mjs --check
```

Then inspect remote metadata *without displaying secret values* (requires authenticated Wrangler session):

```bash
npx --prefix Trinity wrangler secrets-store store list --remote
npx --prefix Trinity wrangler secrets-store secret list <STORE_ID> --remote --per-page 100
```

Find `STORE_ID` in `Trinity/wrangler.jsonc` or the Cloudflare Secrets Store dashboard.
The list is metadata only: names, status, and scope — never plaintext values.
A Worker binding requires secret scope **`workers`** (AI Gateway-only scope is insufficient).
Binding deployment requires Account Secrets Store **Edit** API permission or the Super Administrator / Secrets Store Deployer role.

## Add a new binding safely

1. Confirm the target account, existing store ID, secret name, and `workers` scope.
2. Add the binding object (`binding`, `store_id`, `secret_name`) to `secrets_store_secrets` in `Trinity/wrangler.jsonc` (and keep `env.production` synchronized; run `node scripts/sync-root-wrangler.mjs`).
3. In trusted runtime code, read via `await env.<BINDING>.get()` (prefer `readTrinityMasterSecret(env, provider)` from `Trinity/src/trinity-master-secrets.js` for supported providers).
4. Do not add broad GitHub tokens or privileged PC keys to the public chat Worker. Use a separately authenticated privileged service with a scoped, auditable API instead.
5. Verify metadata, unit tests, and production dry-run build:

```bash
node Trinity/scripts/secrets-store-doctor.mjs
node Trinity/scripts/cloudflare-env-audit.mjs --strict
npm --prefix Trinity run secrets:test
npm --prefix Trinity run build
```

Production deployments are governed by `.github/workflows/self-deploy.yml` (manual owner `workflow_dispatch` with `deploy_production=true` and exact 40-char `expected_commit_sha`) or explicit owner-approved `npm --prefix Trinity run deploy:prod`. Never deploy while checks are failing.

## Secrets policy

NEVER paste key material into chats, shell history, logs, GitHub commits, URLs, Wrangler `vars`, or AI prompts. If exposed, rotate immediately.
Do not pass `--value` on the command line when creating secrets; use the Cloudflare dashboard or an interactive prompt.
Do not call `secret get` to print production secrets during troubleshooting.

Local Wrangler Secrets Store without `--remote` is isolated from production: local tests prove binding wiring only, never that remote keys are valid or scoped for `workers`.

## Who learns what

- Trinity can read allowlisted server-side `.get()` bindings without disclosing values. It reports `configured` separately from `verified` and `connected`.
- Antigravity / Codex agents can read this skill and run local checks, but remote Cloudflare verification requires real authenticated Wrangler/API credentials.
- External provider connections (ChatGPT, Copilot, Claude, Azure AI Foundry, Google AI Studio) each require their own independent credentials and scopes.

Record real command receipts and exit codes; never claim a binding or secret is verified without direct execution evidence.

## Official references

- https://developers.cloudflare.com/secrets-store/integrations/workers/
- https://developers.cloudflare.com/secrets-store/access-control/
- https://developers.cloudflare.com/workers/wrangler/commands/secrets-store/
- https://developers.cloudflare.com/workers/wrangler/configuration/
