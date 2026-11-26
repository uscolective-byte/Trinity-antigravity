---
name: trinity-fleet-ops
description: >-
  Inspect and safely operate the Trinity Cloudflare Workers fleet (unified
  production Worker trinity with 40 service bindings across 34 unique services
  and 46 canonical worker entrypoints), Secrets Store, D1, KV, R2, AI, and
  integrations. Prefer proof of runner, permissions, isolation, and deployment
  receipts.
---

# Trinity Fleet Operations — Safe Rollout

Use `.agents/skills/cloudflare-secrets-store/SKILL.md` before binding or auditing Secrets Store credentials.
Source of truth: `Trinity/wrangler.jsonc` (mirrored to root `wrangler.jsonc`) and `scripts/lib/worker-deployments.mjs`.

## Fleet Topology (Verified Metadata)

- **Unified Production Worker:** `trinity` serving both `https://auru.space` and `https://auru.dev` (main D1 `trinity-v03`, KV `Mastermind`).
- **Service Bindings:** 40 service bindings targeting 34 unique Cloudflare Workers in `Trinity/wrangler.jsonc`.
- **Canonical Worker Entrypoints:** 46 deployable worker entrypoints verified by `scripts/test-all-workers-build.mjs` (`scripts/lib/worker-deployments.mjs`).
- **Registered Specialist Agents:** 46 roles in `Trinity/src/registry.js`.
- **Single-Production Mode:** Historical `staging` (`trinity-staging`) and `development` (`trinity-development`) targets were consolidated away into the unified production Worker `trinity`. Do not target removed `--env staging` or `--env development` configs.

## Preflight (Linux / macOS / PowerShell)

```bash
git status --short
node Trinity/scripts/secrets-store-doctor.mjs
node Trinity/scripts/cloudflare-env-audit.mjs --strict
node scripts/sync-root-wrangler.mjs --check
node scripts/pre-deploy-check.mjs
npm run docs:check
npm test
```

## Build & Dry-Run Verification

```bash
npm --prefix Trinity run build
node scripts/test-all-workers-build.mjs
```

## Governed Production Deployment

- Never infer live version, auth state, or external connectivity from local config files alone.
- Push to `main` runs verification checks only (`ci.yml`, `self-deploy.yml` `verify` job).
- Production deployment requires explicit owner (`uscolective-byte`) manual `workflow_dispatch` on `.github/workflows/self-deploy.yml` with `deploy_production=true` and the exact 40-character `expected_commit_sha`, followed by read-only D1 migration check (`compatible-migrations.mjs --remote --check`), tagged deploy (`npm run deploy -- --tag "$GITHUB_SHA"`), and live readiness verification (`verify-deployment.mjs` on `https://auru.space` and `https://auru.dev`).
- Do not run `deploy:all`, apply remote D1 migrations without backup/approval, alter secrets, or force-push simply because a general repair was requested.

## Evidence (Truth Policy 2.1)

Record confirmed test results, exact command receipts, exit codes, deployment ID, commit SHA/tag, and live `/health` + `/ready` responses (`NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT`).
A workflow queued is not a workflow succeeded. Unauthenticated `wrangler whoami` (even if exit code 0) is not authenticated deployment access.

## References

- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/secrets-store/integrations/workers/
