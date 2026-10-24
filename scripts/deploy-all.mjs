#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║               ✦ TRINITY UNIFIED DEPLOY ALL ✦                       ║');
console.log('║   Kompletné nasadenie všetkých modulov na Cloudflare (auru.dev/space)║');
console.log('╚════════════════════════════════════════════════════════════════════╝');

function run(command, args, cwd = root) {
  console.log(`\n[Deploy] Spúšťam: ${command} ${args.join(' ')} v ${cwd === root ? 'root' : cwd.slice(root.length)}`);
  const res = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (res.status !== 0) {
    console.error(`[Deploy CHYBA] Príkaz ${command} zlyhal s kódom ${res.status}`);
    process.exit(res.status || 1);
  }
}

function runCapture(command, args, cwd = root) {
  const res = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env });
  return (res.stdout || '').trim();
}

const commitSha = runCapture('git', ['rev-parse', 'HEAD']);
console.log(`[Deploy] Git Commit: ${commitSha}`);

// 1. Deploy Sub-workers
console.log('\n--- 1/4 Nasadzujem podporné cloudové moduly ---');
run(npx, ['--no-install', 'wrangler', 'deploy'], resolve(root, 'Knowledge-Worker'));
run(npx, ['--no-install', 'wrangler', 'deploy', '--env', 'development'], resolve(root, 'Knowledge-Worker'));
run(npx, ['--no-install', 'wrangler', 'deploy'], resolve(root, 'Integrations-Worker'));
run(npx, ['--no-install', 'wrangler', 'deploy'], resolve(root, 'PC-Bridge-Worker'));
run(npx, ['--no-install', 'wrangler', 'deploy'], resolve(root, 'Capacity-Worker'));

// 2. Deploy Development (auru.dev)
console.log('\n--- 2/4 Nasadzujem Development (auru.dev) ---');
run(npm, ['run', 'deploy:development', '--', '--tag', commitSha], resolve(root, 'Trinity'));
run(process.execPath, ['scripts/verify-deployment.mjs', 'https://auru.dev', commitSha], resolve(root, 'Trinity'));

// 3. Deploy Production (auru.space)
console.log('\n--- 3/4 Nasadzujem Production (auru.space) ---');
run(npm, ['run', 'deploy', '--', '--tag', commitSha], resolve(root, 'Trinity'));
run(process.execPath, ['scripts/verify-deployment.mjs', 'https://auru.space', commitSha], resolve(root, 'Trinity'));

console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║            ✦ VŠETKO BOLO ÚSPEŠNE NASADENÉ A OVERENÉ! ✦              ║');
console.log('║   auru.dev (Owner Lab) & auru.space (Klientsky Portál) sú 100% LIVE ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
