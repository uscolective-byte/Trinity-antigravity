#!/usr/bin/env node
// Convenience wrapper: delegates to the repo-level read-only verifier (scripts/verify-tetrakis.mjs).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('../../../scripts/verify-tetrakis.mjs', import.meta.url));
process.exitCode = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1;
