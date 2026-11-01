#!/usr/bin/env node
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTOMATION_AND_OPS_SCRIPTS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul run-all-tests.mjs (scripts/run-all-tests.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SUITES = [
  { name: 'TAP Contracts', dir: resolve(ROOT, 'packages/contracts'), cmd: 'npm', args: ['test'] },
  { name: 'TAP JSON Schema consistency', dir: resolve(ROOT, 'packages/contracts'), cmd: 'npm', args: ['run', 'schema:check'] },
  { name: 'Workspace policies and operations', dir: ROOT, cmd: process.execPath, args: ['--test', 'tests/*.test.mjs', 'scripts/*.test.mjs'] },
  { name: 'Trinity Main Fleet', dir: resolve(ROOT, 'Trinity'), cmd: 'npm', args: ['test'] },
  { name: 'Audit-Worker', dir: resolve(ROOT, 'Audit-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'Capacity-Worker', dir: resolve(ROOT, 'Capacity-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'Jericho-Worker', dir: resolve(ROOT, 'Jericho-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'Knowledge-Worker', dir: resolve(ROOT, 'Knowledge-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'Integrations-Worker', dir: resolve(ROOT, 'Integrations-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'PC-Bridge-Worker', dir: resolve(ROOT, 'PC-Bridge-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'Local-Gateway', dir: resolve(ROOT, 'Local-Gateway'), cmd: 'npm', args: ['test'] },
  { name: 'Local-Desktop', dir: resolve(ROOT, 'Local-Desktop'), cmd: 'npm', args: ['test'] },
  { name: 'Trinity MCP Bridge', dir: resolve(ROOT, 'trinity-mcp-bridge'), cmd: 'npm', args: ['test'] },
  { name: 'Trinity PC Bridge Client', dir: resolve(ROOT, 'Trinity/trinity-pc-bridge'), cmd: 'npm', args: ['test'] },
  { name: 'Tetrakis-Token ($TTK)', dir: resolve(ROOT, 'contracts/tetrakis'), cmd: 'npm', args: ['test'] }
];

console.log('🧪 RUNNING ALL SUITES...');
for (const s of SUITES) {
  console.log(`\n▶ [${s.name}] in ${s.dir}...`);
  const useNpmCli = s.cmd === 'npm' && Boolean(process.env.npm_execpath);
  const res = spawnSync(useNpmCli ? process.execPath : s.cmd, useNpmCli ? [process.env.npm_execpath, ...s.args] : s.args, {
    cwd: s.dir,
    stdio: 'inherit',
    shell: s.cmd === 'npm' && !useNpmCli,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }
  });
  if (res.status !== 0) {
    if (res.error) console.error(res.error.message);
    if (res.signal) console.error(`Suite terminated by ${res.signal}`);
    console.error(`❌ Suite failed: ${s.name} (exit code ${res.status})`);
    process.exit(res.status || 1);
  }
  console.log(`✅ Passed: ${s.name}`);
}

console.log('\n🎉 ALL SUITES PASSED CLEANLY!');
