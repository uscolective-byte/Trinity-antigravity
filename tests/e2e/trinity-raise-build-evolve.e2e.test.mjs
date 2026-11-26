/**
 * @module tests/e2e/trinity-raise-build-evolve.e2e.test.mjs
 * @description Opaque-Box, Requirement-Driven 4-Tier E2E Verification Suite for
 * Trinity Raise, Build, Deploy & Evolve Hardening (ORIGINAL_REQUEST.md + PROJECT.md).
 *
 * Tiers:
 *   - Tier 1: Feature Coverage (/env-setup, /migrate-workflows, /trinity-core-orchestrator,
 *             /trinity-mcp-bridge, /github, raise/build/deploy pre-flight gates, evolve)
 *   - Tier 2: Boundary & Corner Cases (P0 auth lockdowns, spoofed headers, PII redaction,
 *             SEPA XSS & IBAN, commodity price honesty, missing token fail-closed,
 *             Desktop/Gateway Truth Policy + injection, cloudflare-doctor exit-0 fail-closed)
 *   - Tier 3: Cross-Feature Combinations (mcp.js <-> trinity-codex-mcp.mjs 48-tool parity,
 *             project-evolution.js <-> self-deploy.yml & ci.yml, 6-workspace CI parity,
 *             .gitignore secret/teamwork protection, Worker <-> ledger actor propagation)
 *   - Tier 4: Real-World Application Scenarios (end-to-end pre-flight pipeline, live public
 *             read-only receipt against auru.space & auru.dev, attacker vs operator lifecycle)
 *
 * Zero silent skips, zero repo mutations, zero secrets printed, CWD-independent paths.
 */

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// CWD-Independent Paths & Synthetic Constants (Zero Real Secrets)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const TRINITY_DIR = path.join(REPO_ROOT, 'Trinity');
const TRINITY_DIST_DIR = path.join(TRINITY_DIR, 'dist');
const TRINITY_MIGRATIONS_DIR = path.join(TRINITY_DIR, 'migrations');
const ENV_SETUP_SCRIPT = '/home/antigravity/env-setup.sh';

const WORKER_ORIGIN = 'https://trinity.e2e.test';
const SYNTHETIC_OPS_KEY = 'e2e-synthetic-ops-key-not-a-real-secret-0123456789abcdef';
const SYNTHETIC_GATEWAY_KEY = 'e2e-synthetic-gateway-key-not-a-real-secret-0123456789';
const SYNTHETIC_VAULT_KEY = Buffer.alloc(32, 11).toString('base64url');
const SYNTHETIC_OWNER_EMAIL = 'e2e-owner@example.test';
const SYNTHETIC_BRIDGE_TOKEN = 'e2e-synthetic-bridge-token-7788-not-real';

const SECRET_LEAK_PATTERNS = [
  /\btrn_live_[A-Za-z0-9_-]{12,}\b/,
  /\bsk-(?:proj-|ant-|live-|test-)?[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{25,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/
];

function assertNoSecretLeak(text, contextLabel) {
  const sample = String(text || '');
  for (const pattern of SECRET_LEAK_PATTERNS) {
    assert.equal(
      pattern.test(sample),
      false,
      `Secret-shaped token leaked in ${contextLabel} (matched ${pattern})`
    );
  }
}

function readRepoFile(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  assert.ok(fs.existsSync(full), `Expected repository file to exist: ${relPath}`);
  return fs.readFileSync(full, 'utf8');
}

function runCli(command, args, options = {}) {
  const res = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    timeout: options.timeout ?? 60_000,
    maxBuffer: 4 * 1024 * 1024,
    env: options.env ? { ...process.env, ...options.env } : process.env
  });
  if (res.error) {
    throw res.error;
  }
  return res;
}

// ---------------------------------------------------------------------------
// Shared Miniflare Worker Harness (Boots Compiled Trinity/dist Bundle)
// ---------------------------------------------------------------------------
let sharedWorkerRuntime = null;

async function getWorkerRuntime() {
  if (sharedWorkerRuntime) return sharedWorkerRuntime;

  assert.ok(
    fs.existsSync(path.join(TRINITY_DIST_DIR, 'index.js')),
    'Compiled Worker bundle Trinity/dist/index.js is required. Run `npm --prefix Trinity run build` first.'
  );

  const reqTrinity = createRequire(path.join(TRINITY_DIR, 'package.json'));
  const miniflareEntry = pathToFileURL(reqTrinity.resolve('miniflare')).href;
  const { Miniflare, convertV4MiniflareOptions } = await import(miniflareEntry);
  const { createApiKey } = await import(pathToFileURL(path.join(TRINITY_DIR, 'src/api-keys.js')).href);

  const modules = fs
    .readdirSync(TRINITY_DIST_DIR)
    .filter((name) => !name.endsWith('.map') && !name.endsWith('.md'))
    .map((name) => ({
      type: name === 'index.js' ? 'ESModule' : 'Text',
      path: path.join(TRINITY_DIST_DIR, name)
    }));
  modules.sort((a, b) => (a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0));

  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'trinity',
          modules,
          compatibilityDate: '2026-10-01',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            CF_VERSION_METADATA: {
              id: 'e2e-deployment',
              tag: 'e2e-commit',
              timestamp: '2026-11-26T00:00:00.000Z'
            },
            ENVIRONMENT: 'production',
            TRINITY_ENV: 'production',
            STRICT_MODE: 'true',
            TRINITY_OPS_KEY: SYNTHETIC_OPS_KEY,
            TRINITY_OWNER_EMAIL: SYNTHETIC_OWNER_EMAIL,
            TRINITY_GATEWAY_KEY: SYNTHETIC_GATEWAY_KEY,
            TRINITY_VAULT_KEY: SYNTHETIC_VAULT_KEY
          },
          kvNamespaces: { Mastermind: 'e2e-kv', PC_STATE: 'e2e-pc-state' },
          d1Databases: { DB: 'e2e-db' },
          r2Buckets: { ARTIFACTS: 'e2e-r2' },
          serviceBindings: { AI: { name: 'mock', entrypoint: 'MockAI' } },
          workflows: { OPS_WORKFLOW: { name: 'e2e-workflow', className: 'TrinityOperations' } }
        },
        {
          name: 'mock',
          modules: true,
          compatibilityDate: '2026-10-01',
          script: `
            import { WorkerEntrypoint } from 'cloudflare:workers';
            export class MockAI extends WorkerEntrypoint {
              async run() { return { response: 'E2E_MOCK_AI_OK' }; }
            }
            export default { fetch() { return new Response('mock'); } };
          `
        }
      ]
    })
  );

  const db = await mf.getD1Database('DB', 'trinity');
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,module TEXT NOT NULL,action TEXT NOT NULL,details TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS memory(id TEXT PRIMARY KEY,content TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS knowledge(id INTEGER PRIMARY KEY,topic TEXT,content TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS personality(id INTEGER PRIMARY KEY,trait TEXT,value TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,title TEXT,content TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS memory_long(key TEXT,value TEXT,category TEXT,importance INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS projects(id TEXT,name TEXT,description TEXT,status TEXT,updated_at TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tasks(id TEXT,title TEXT,status TEXT,assigned_agent TEXT,updated_at TEXT)')
  ]);

  const migrationFiles = fs
    .readdirSync(TRINITY_MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(TRINITY_MIGRATIONS_DIR, file), 'utf8');
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (file === '0048_trinity_sovereign_ai_os.sql') {
      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }
    } else if (statements.length > 0) {
      await db.batch(statements.map((s) => db.prepare(s)));
    }
  }

  // Enable MCP plugin & issue a synthetic scoped MCP API key for protocol-level checks
  await db
    .prepare("INSERT OR REPLACE INTO ops_plugins(id, installed, enabled) VALUES('mcp', 1, 1)")
    .run();
  const mcpKey = await createApiKey(
    { DB: db },
    'e2e-owner',
    { name: 'E2E MCP Operator', scopes: ['mcp:read', 'mcp:write'] }
  );

  sharedWorkerRuntime = {
    mf,
    db,
    mcpSecret: mcpKey.secret,
    async fetch(routePath, init = {}) {
      try {
        return await mf.dispatchFetch(WORKER_ORIGIN + routePath, init);
      } catch (err) {
        if (err instanceof TypeError && /fetch failed/i.test(err.message)) {
          return await mf.dispatchFetch(WORKER_ORIGIN + routePath, init);
        }
        throw err;
      }
    }
  };
  return sharedWorkerRuntime;
}

after(async () => {
  if (sharedWorkerRuntime?.mf) {
    await sharedWorkerRuntime.mf.dispose();
    sharedWorkerRuntime = null;
  }
});

/**
 * Parse either application/json or text/event-stream MCP JSON-RPC responses.
 */
async function parseMcpRpcResponse(response, expectedId) {
  const text = await response.text();
  if (text.trimStart().startsWith('{')) {
    return JSON.parse(text);
  }
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  const parsed = dataLines.map((line) => JSON.parse(line));
  return parsed.find((msg) => msg.id === expectedId) || parsed.at(-1);
}

/**
 * Spawns Trinity/scripts/trinity-codex-mcp.mjs over stdio with a synthetic token
 * and executes JSON-RPC initialize + tools/list without touching any remote server.
 */
async function queryStdioMcpBridgeTools() {
  return new Promise((resolvePromise, rejectPromise) => {
    const scriptPath = path.join(TRINITY_DIR, 'scripts/trinity-codex-mcp.mjs');
    const child = spawn(process.execPath, [scriptPath], {
      cwd: TRINITY_DIR,
      env: {
        ...process.env,
        TRINITY_MCP_TOKEN: 'e2e-synthetic-stdio-token-00000000',
        TRINITY_MCP_URL: 'https://trinity.invalid',
        CLOUDFLARE_ACCESS_CLIENT_ID: '',
        CLOUDFLARE_ACCESS_CLIENT_SECRET: '',
        CF_ACCESS_CLIENT_ID: '',
        CF_ACCESS_CLIENT_SECRET: ''
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutBuf = '';
    let stderrBuf = '';
    let settled = false;

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill('SIGTERM');
      } catch {}
      if (err) rejectPromise(err);
      else resolvePromise(value);
    };

    const timer = setTimeout(() => {
      finish(new Error(`Stdio MCP bridge timed out. stderr=${stderrBuf.slice(0, 400)}`));
    }, 12_000);

    child.on('error', (err) => finish(err));
    child.on('exit', (code) => {
      if (!settled) {
        finish(new Error(`Stdio MCP bridge exited prematurely (code=${code}). stderr=${stderrBuf.slice(0, 400)}`));
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
    });

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      const lines = stdoutBuf.split(/\r?\n/).filter((l) => l.trim().startsWith('{'));
      let initRes = null;
      let listRes = null;
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1) initRes = msg;
          if (msg.id === 2) listRes = msg;
        } catch {
          // Incomplete JSON chunk, wait for remaining bytes
        }
      }
      if (initRes && listRes) {
        finish(null, { initRes, listRes, stderr: stderrBuf });
      }
    });

    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'trinity-e2e-suite', version: '1.0.0' }
        }
      }) + '\n'
    );
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      }) + '\n'
    );
  });
}

// ===========================================================================
// TIER 1 — FEATURE COVERAGE
// ===========================================================================
describe('Tier 1 — Feature Coverage', () => {
  test('T1.1: /env-setup cloud boot script is valid, covers all 8 lockfiles, and exits 0 on 2x consecutive runs', () => {
    assert.ok(fs.existsSync(ENV_SETUP_SCRIPT), `Expected ${ENV_SETUP_SCRIPT} to exist`);
    const scriptText = fs.readFileSync(ENV_SETUP_SCRIPT, 'utf8');
    assert.match(scriptText, /set -euo pipefail/, 'env-setup.sh must enable strict bash error handling');
    assert.match(scriptText, /\.bashrc/, 'env-setup.sh must manage ~/.bashrc PATH export');

    const expectedWorkspaces = [
      '"."',
      'packages/contracts',
      'packages/crypto-core',
      'Jericho-Worker',
      'contracts/tetrakis',
      'PC-Bridge-Worker',
      'scripts/trinity-mcp-bridge',
      'Trinity'
    ];
    for (const ws of expectedWorkspaces) {
      assert.ok(scriptText.includes(ws), `env-setup.sh must cover workspace ${ws}`);
    }

    const syntaxCheck = runCli('bash', ['-n', ENV_SETUP_SCRIPT]);
    assert.equal(syntaxCheck.status, 0, `bash -n failed: ${syntaxCheck.stderr}`);

    const firstRun = runCli('bash', [ENV_SETUP_SCRIPT], { timeout: 60_000 });
    assert.equal(firstRun.status, 0, `First env-setup.sh run failed: ${firstRun.stderr}`);

    const secondRun = runCli('bash', [ENV_SETUP_SCRIPT], { timeout: 60_000 });
    assert.equal(secondRun.status, 0, `Second consecutive env-setup.sh run failed: ${secondRun.stderr}`);
  });

  test('T1.2: /migrate-workflows cleanliness — zero legacy workflow files and valid SKILL.md frontmatter', () => {
    const legacyRoots = [
      path.join(REPO_ROOT, '.agents'),
      path.join(REPO_ROOT, '.agent'),
      path.join(os.homedir(), '.gemini', 'antigravity', 'workflows'),
      '/home/antigravity/uscolective-byte/trinity-morhfeus/.agents',
      '/home/antigravity/uscolective-byte/trinity-morhfeus/.agent'
    ];

    const foundLegacy = [];
    const scanForLegacy = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'teamwork' || entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === 'workflows.json') {
          foundLegacy.push(full);
        } else if (entry.isDirectory() && entry.name === 'workflows') {
          const children = fs.readdirSync(full);
          if (children.length > 0) foundLegacy.push(full);
        } else if (entry.isDirectory()) {
          scanForLegacy(full);
        }
      }
    };
    for (const root of legacyRoots) {
      if (root.endsWith('workflows') && fs.existsSync(root)) {
        if (fs.readdirSync(root).length > 0) foundLegacy.push(root);
      } else {
        scanForLegacy(root);
      }
    }
    assert.deepEqual(foundLegacy, [], `Unexpected legacy workflow files found: ${foundLegacy.join(', ')}`);

    const requiredSkills = [
      'cloudflare-secrets-store',
      'trinity-fleet-ops',
      'trinity-mcp-bridge',
      'trinity-core-orchestrator'
    ];
    for (const skill of requiredSkills) {
      const skillFile = path.join(REPO_ROOT, '.agents', 'skills', skill, 'SKILL.md');
      assert.ok(fs.existsSync(skillFile), `Missing modern skill file: ${skillFile}`);
      const content = fs.readFileSync(skillFile, 'utf8');
      assert.match(content, /^---\r?\n[\s\S]*?\bname:\s*\S+[\s\S]*?\bdescription:/m, `Invalid YAML frontmatter in ${skill}/SKILL.md`);
      assertNoSecretLeak(content, `${skill}/SKILL.md`);
    }
  });

  test('T1.3: /trinity-core-orchestrator & .agents/skills/ aligned with unified production trinity, 46 agents, 48 MCP tools, zero legacy CLAIM/staging drift', () => {
    const secretsSkill = readRepoFile('.agents/skills/cloudflare-secrets-store/SKILL.md');
    const fleetSkill = readRepoFile('.agents/skills/trinity-fleet-ops/SKILL.md');
    const mcpSkill = readRepoFile('.agents/skills/trinity-mcp-bridge/SKILL.md');
    const orchSkill = readRepoFile('.agents/skills/trinity-core-orchestrator/SKILL.md');
    const orchExamples = readRepoFile('.agents/skills/trinity-core-orchestrator/examples.md');
    const orchTemplates = readRepoFile('.agents/skills/trinity-core-orchestrator/task-templates.md');

    // No legacy CLAIM ceremony mandates
    for (const [label, body] of [
      ['cloudflare-secrets-store/SKILL.md', secretsSkill],
      ['trinity-fleet-ops/SKILL.md', fleetSkill],
      ['trinity-mcp-bridge/SKILL.md', mcpSkill],
      ['trinity-core-orchestrator/SKILL.md', orchSkill]
    ]) {
      assert.equal(/claim files before editing/i.test(body), false, `Legacy CLAIM mandate remains in ${label}`);
      assert.equal(/CLAIM\s*→\s*UPDATE\s*→\s*HANDOFF/i.test(body), false, `Legacy CLAIM workflow remains in ${label}`);
    }

    // No active --env staging deployment instructions or stale staging-only config guidance
    assert.equal(/npx wrangler deploy --env staging/i.test(secretsSkill), false, 'cloudflare-secrets-store/SKILL.md must not instruct `--env staging` deploy');
    assert.equal(/Use Trinity\/wrangler\.jsonc with environment name \*\*staging\*\*/i.test(secretsSkill), false, 'cloudflare-secrets-store/SKILL.md must reflect single-production Worker trinity');
    assert.match(secretsSkill, /trinity/i);

    assert.match(fleetSkill, /trinity-v03/, 'trinity-fleet-ops/SKILL.md must reference canonical D1 trinity-v03');
    assert.equal(/staging and production.*shared/i.test(fleetSkill) && /Currently some D1\/KV\/R2/i.test(fleetSkill), false, 'trinity-fleet-ops/SKILL.md must not claim stale shared staging D1/KV/R2 blocker');

    // MCP bridge skill reflects 46 agents / 48 MCP tools & Linux verification path
    assert.equal(/\b45\s+Trinity\s+specialist/i.test(mcpSkill), false, 'trinity-mcp-bridge/SKILL.md must not retain stale 45 specialist count');
    assert.match(mcpSkill, /46/, 'trinity-mcp-bridge/SKILL.md must reference 46 specialist agents');
    assert.match(mcpSkill, /48|verify-codex-mcp-access\.mjs/, 'trinity-mcp-bridge/SKILL.md must reference 48 MCP tools or cross-platform verify-codex-mcp-access.mjs');

    // Orchestrator skill & auxiliary docs use real bindings (zero invented placeholders)
    const orchBundle = `${orchSkill}\n${orchExamples}\n${orchTemplates}`;
    assert.match(orchSkill, /46/, 'trinity-core-orchestrator/SKILL.md must reference 46 agents');
    for (const fakeName of ['CORE-DEV-WORKER', 'INFRA-EDGE-WORKER', 'TRUTH-VERIFIER-WORKER', 'AURA_QUEUE']) {
      assert.equal(orchBundle.includes(fakeName), false, `trinity-core-orchestrator docs must not reference invented binding/worker "${fakeName}"`);
    }
  });

  test('T1.4: /trinity-mcp-bridge local stdio bridge initializes and lists 48 tools with valid JSON schemas', async () => {
    const { initRes, listRes } = await queryStdioMcpBridgeTools();
    assert.equal(initRes.error, undefined, `MCP stdio initialize returned error: ${JSON.stringify(initRes.error)}`);
    assert.ok(initRes.result?.serverInfo?.name, 'MCP stdio initialize must return serverInfo.name');
    assert.equal(listRes.error, undefined, `MCP stdio tools/list returned error: ${JSON.stringify(listRes.error)}`);
    assert.ok(Array.isArray(listRes.result?.tools), 'MCP stdio tools/list must return tools array');
    assert.equal(
      listRes.result.tools.length,
      48,
      `Expected exact 48 tools in trinity-codex-mcp.mjs, got ${listRes.result.tools.length}`
    );

    for (const tool of listRes.result.tools) {
      assert.ok(typeof tool.name === 'string' && tool.name.length > 0, 'Every MCP tool must have a non-empty name');
      assert.ok(typeof tool.description === 'string' && tool.description.length > 0, `Tool ${tool.name} missing description`);
      assert.equal(tool.inputSchema?.type, 'object', `Tool ${tool.name} inputSchema must be a JSON Schema object`);
    }

    const verifyScript = readRepoFile('scripts/verify-codex-mcp-access.mjs');
    assert.match(verifyScript, /EXPECTED_TOOL_COUNT\s*=\s*48/, 'verify-codex-mcp-access.mjs must expect 48 tools');
    assert.match(verifyScript, /--public-only/, 'verify-codex-mcp-access.mjs must support --public-only mode');
  });

  test('T1.5: /github CI hygiene & governed production deployment policy (manual owner dispatch + 40-char SHA + 46 workers)', async () => {
    const selfDeploy = readRepoFile('.github/workflows/self-deploy.yml');
    const ciYml = readRepoFile('.github/workflows/ci.yml');
    const webpackYml = readRepoFile('.github/workflows/webpack.yml');

    // Governed production deployment policy
    assert.match(selfDeploy, /deploy_production:/);
    assert.match(selfDeploy, /expected_commit_sha:/);
    assert.match(selfDeploy, /github\.event_name == 'workflow_dispatch' && inputs\.deploy_production == true/);
    assert.match(selfDeploy, /GITHUB_ACTOR" != "uscolective-byte"/);
    assert.match(selfDeploy, /\[0-9a-f\]\{40\}/);

    // CI job name and required checks
    assert.match(ciYml, /name:\s*Full Test Suite & Validation/);
    assert.match(ciYml, /npm test/);
    assert.match(ciYml, /secrets-store-doctor\.mjs/);

    // Distinct workflow name in webpack.yml (no duplicate "Trinity CI")
    const ciName = ciYml.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const webpackName = webpackYml.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    assert.ok(ciName && webpackName, 'Both ci.yml and webpack.yml must declare a workflow name');
    assert.notEqual(webpackName, ciName, `webpack.yml must not duplicate ci.yml name ("${ciName}")`);

    // Canonical 46 worker targets
    const { WORKER_DEPLOYMENTS } = await import(
      pathToFileURL(path.join(REPO_ROOT, 'scripts/lib/worker-deployments.mjs')).href
    );
    assert.equal(WORKER_DEPLOYMENTS.length, 46, `Expected 46 canonical worker deployments, got ${WORKER_DEPLOYMENTS.length}`);
  });

  test('T1.6: raise & build pre-flight gates pass cleanly (zero deleted targets, metadata/sync/import dry-run OK)', () => {
    const pipelineSrc = readRepoFile('scripts/project-pipeline.mjs');
    assert.equal(pipelineSrc.includes('build:development'), false, 'project-pipeline.mjs must not invoke deleted build:development target');

    const secretsDoc = runCli(process.execPath, ['Trinity/scripts/secrets-store-doctor.mjs']);
    assert.equal(secretsDoc.status, 0, `secrets-store-doctor failed: ${secretsDoc.stderr}`);
    const secretsJson = JSON.parse(secretsDoc.stdout);
    assert.equal(secretsJson.ok, true);
    assert.equal(secretsJson.secret_values_accessed, false);
    assert.deepEqual(secretsJson.errors, []);

    const envAudit = runCli(process.execPath, ['Trinity/scripts/cloudflare-env-audit.mjs', '--strict']);
    assert.equal(envAudit.status, 0, `cloudflare-env-audit failed: ${envAudit.stderr}`);
    const envJson = JSON.parse(envAudit.stdout);
    assert.equal(envJson.isolated, true);
    assert.equal(envJson.mode, 'single-production');
    assert.equal(envJson.production, 'trinity');

    const preDeploy = runCli(process.execPath, ['scripts/pre-deploy-check.mjs']);
    assert.equal(preDeploy.status, 0, `pre-deploy-check failed: ${preDeploy.stderr}`);
    const preDeployJson = JSON.parse(preDeploy.stdout);
    assert.equal(preDeployJson.ok, true);
    assert.equal(preDeployJson.production_d1, 'trinity-v03');

    const wranglerSync = runCli(process.execPath, ['scripts/sync-root-wrangler.mjs', '--check']);
    assert.equal(wranglerSync.status, 0, `sync-root-wrangler --check failed: ${wranglerSync.stderr}`);

    const docsSync = runCli(process.execPath, ['scripts/sync-release-docs.mjs', '--check']);
    assert.equal(docsSync.status, 0, `sync-release-docs --check failed: ${docsSync.stderr}`);

    const importDry = runCli(process.execPath, ['scripts/import-to-antigravity.mjs', '--dry-run', '--json']);
    assert.equal(importDry.status, 0, `import-to-antigravity --dry-run failed: ${importDry.stderr}`);
    const importJson = JSON.parse(importDry.stdout);
    assert.equal(importJson.mode, 'dry-run');
    assertNoSecretLeak(importDry.stdout, 'import-to-antigravity --dry-run --json');
  });

  test('T1.7: evolve contracts & compiled Worker /health, /ready, /api/manifest (46 agents), /api/social/status honesty', async () => {
    const evo = await import(pathToFileURL(path.join(TRINITY_DIR, 'src/project-evolution.js')).href);
    assert.equal(evo.editableSource('Trinity/src/index.js'), true);
    assert.equal(evo.editableSource('Trinity/src/../.env'), false);
    assert.equal(evo.editableSource('Trinity/src/secret-keys.js'), false);
    assert.equal(evo.automaticMergeAllowed([{ path: 'Dokumentacia/guide.md' }]), true);
    assert.equal(evo.automaticMergeAllowed([{ path: 'Trinity/src/index.js' }]), false);

    const worker = await getWorkerRuntime();
    const trinityPkg = JSON.parse(readRepoFile('Trinity/package.json'));

    const healthRes = await worker.fetch('/health');
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);
    assert.equal(health.environment, 'production');
    assert.equal(health.version, trinityPkg.version);

    const readyRes = await worker.fetch('/ready');
    assert.equal(readyRes.status, 200);
    const ready = await readyRes.json();
    assert.equal(ready.ready, true);

    const manifestRes = await worker.fetch('/api/manifest');
    assert.equal(manifestRes.status, 200);
    const manifest = await manifestRes.json();
    assert.equal(manifest.version, trinityPkg.version, `Manifest version (${manifest.version}) must match Trinity/package.json (${trinityPkg.version})`);
    const agentCount =
      typeof manifest.agents === 'number'
        ? manifest.agents
        : Array.isArray(manifest.agents)
          ? manifest.agents.length
          : manifest.agents_count ?? manifest.agent_count;
    assert.equal(agentCount, 46, `Manifest agent count must equal 46 (got ${agentCount})`);

    const socialRes = await worker.fetch('/api/social/status');
    assert.equal(socialRes.status, 200);
    const social = await socialRes.json();
    const socialSerialized = JSON.stringify(social);
    assert.equal(
      /"status"\s*:\s*"active"/i.test(socialSerialized),
      false,
      `/api/social/status must not hardcode "active" when no social provider tokens are bound: ${socialSerialized}`
    );
  });
});

// ===========================================================================
// TIER 2 — BOUNDARY & CORNER CASES
// ===========================================================================
describe('Tier 2 — Boundary & Corner Cases', () => {
  test('T2.1: Unauthenticated POST /api/tools/execute returns 401 JSON even with spoofed actor headers or auru.dev Origin', async () => {
    const worker = await getWorkerRuntime();
    const res = await worker.fetch('/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://auru.dev',
        'X-Trinity-Actor': 'Basterix',
        'X-Owner-Id': 'admin'
      },
      body: JSON.stringify({ tool: 'query_d1', arguments: { sql: 'SELECT 1' } })
    });
    assert.equal(res.status, 401, `Expected 401 on unauthenticated POST /api/tools/execute, got ${res.status}`);
    const body = await res.json();
    assert.ok(body && typeof body.error === 'string' && body.error.length > 0, '401 response must include JSON error message');
  });

  test('T2.2: Unauthenticated GET/POST /api/audit-ledger* endpoints all return 401 JSON', async () => {
    const worker = await getWorkerRuntime();
    const probes = [
      { method: 'GET', path: '/api/audit-ledger' },
      { method: 'GET', path: '/api/audit-ledger/verify' },
      {
        method: 'POST',
        path: '/api/audit-ledger/append',
        headers: { 'Content-Type': 'application/json', 'X-Trinity-Actor': 'basterix_root' },
        body: JSON.stringify({ operation: 'SPOOF_TEST', payload: {} })
      },
      {
        method: 'POST',
        path: '/api/audit-ledger',
        headers: { 'Content-Type': 'application/json', 'X-Trinity-Actor': 'basterix_root' },
        body: JSON.stringify({ operation: 'SPOOF_TEST', payload: {} })
      }
    ];

    for (const probe of probes) {
      const res = await worker.fetch(probe.path, {
        method: probe.method,
        headers: probe.headers || {},
        body: probe.body
      });
      assert.equal(res.status, 401, `Expected 401 on unauthenticated ${probe.method} ${probe.path}, got ${res.status}`);
      const body = await res.json();
      assert.ok(body && typeof body.error === 'string', `${probe.method} ${probe.path} 401 response must return JSON { error }`);
    }
  });

  test('T2.3: Spoofed X-Trinity-Actor / X-User-Id / X-Owner-Id headers are never trusted on unauthenticated requests', async () => {
    const { extractActorFromRequest } = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/ledger-middleware.js')).href
    );
    const spoofedRequest = new Request('https://auru.space/api/audit-ledger', {
      method: 'POST',
      headers: {
        'X-Trinity-Actor': 'spoofed_basterix_admin',
        'X-User-Id': 'spoofed_uid_0',
        'X-Owner-Id': 'spoofed_owner'
      }
    });
    const actor = extractActorFromRequest(spoofedRequest);
    assert.notEqual(actor, 'spoofed_basterix_admin', 'Must not trust spoofable X-Trinity-Actor');
    assert.notEqual(actor, 'spoofed_uid_0', 'Must not trust spoofable X-User-Id');
    assert.notEqual(actor, 'spoofed_owner', 'Must not trust spoofable X-Owner-Id');
    assert.notEqual(actor, 'basterix_edge_gateway', 'Unauthenticated requests must not default to basterix_edge_gateway');
  });

  test('T2.4: Unauthenticated privileged pre-auth routes return 401 and public GET /api/status redacts all owner PII', async () => {
    const worker = await getWorkerRuntime();

    const gatedRoutes = [
      { method: 'POST', path: '/api/azure/agent', body: { message: 'hello' } },
      { method: 'GET', path: '/api/profiles/me' },
      { method: 'POST', path: '/api/crypto/tetrakis/vault/deposit', body: { amount: 1 } }
    ];
    for (const route of gatedRoutes) {
      const res = await worker.fetch(route.path, {
        method: route.method,
        headers: route.body ? { 'Content-Type': 'application/json' } : {},
        body: route.body ? JSON.stringify(route.body) : undefined
      });
      assert.equal(res.status, 401, `Expected 401 on unauthenticated ${route.method} ${route.path}, got ${res.status}`);
    }

    const statusRes = await worker.fetch('/api/status');
    assert.equal(statusRes.status, 200, `Expected 200 on public GET /api/status, got ${statusRes.status}`);
    const statusText = await statusRes.text();
    assert.equal(/@gmail\.com/i.test(statusText), false, 'Public /api/status must not expose @gmail.com addresses');
    assert.equal(/@outlook\.com/i.test(statusText), false, 'Public /api/status must not expose @outlook.com addresses');
    assert.equal(/saboivan/i.test(statusText), false, 'Public /api/status must not expose owner personal handle');
    assert.equal(/windows_users/i.test(statusText), false, 'Public /api/status must not expose windows_users');
    assert.equal(/google_accounts/i.test(statusText), false, 'Public /api/status must not expose google_accounts');
  });

  test('T2.5: SEPA invoice escapes XSS payloads, rejects hardcoded placeholder IBAN, and commodity alerts do not fabricate live spot prices', async () => {
    const banking = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/banking-commodity-advanced.js')).href
    );

    const xssClient = '<script>alert("xss-client")</script>';
    const xssItem = '<img src=x onerror="alert(1)">';
    const inv = await banking.generateInvoiceWithSepaQr(
      {},
      'admin',
      {
        client_name: xssClient,
        item_description: xssItem,
        amount_eur: 42.5,
        iban: 'SK8975000000000012345671',
        bic: 'CEKOSKBX'
      }
    );
    assert.ok(typeof inv.html_invoice === 'string' && inv.html_invoice.length > 0);
    assert.equal(inv.html_invoice.includes(xssClient), false, 'Raw <script> XSS payload in client_name must be HTML-escaped');
    assert.equal(inv.html_invoice.includes(xssItem), false, 'Raw <img> XSS payload in item_description must be HTML-escaped');
    assert.match(inv.html_invoice, /&lt;script&gt;/, 'Escaped HTML entities must be present for client_name');

    // Missing IBAN without env configuration must NOT silently use hardcoded placeholder SK3111000000002949000000
    let noIbanResult = null;
    let noIbanThrew = false;
    try {
      noIbanResult = await banking.generateInvoiceWithSepaQr(
        {},
        'admin',
        {
          client_name: 'Valid Client',
          item_description: 'Consulting Services',
          amount_eur: 100
        }
      );
    } catch {
      noIbanThrew = true;
    }
    if (!noIbanThrew) {
      assert.notEqual(
        noIbanResult?.iban,
        'SK3111000000002949000000',
        'Must not silently fall back to hardcoded placeholder IBAN SK3111000000002949000000'
      );
      assert.equal(
        String(noIbanResult?.html_invoice || '').includes('SK3111000000002949000000'),
        false,
        'Rendered invoice must not include hardcoded placeholder IBAN'
      );
    }

    // Commodity price honesty: must not claim static base_price as live spot price
    let alertResult = null;
    let alertThrew = false;
    try {
      alertResult = await banking.createPriceAlert({}, 'admin', {
        symbol: 'XAU-EUR',
        condition: 'above',
        target_price: 2000
      });
    } catch {
      alertThrew = true;
    }
    if (!alertThrew && alertResult) {
      assert.notEqual(alertResult.is_live, true, 'Static base_price must not be marked is_live=true');
      assert.notEqual(alertResult.price_source, 'live', 'Static base_price must not claim price_source=live');
      const alertJson = JSON.stringify(alertResult);
      assert.equal(
        /"price_source"\s*:\s*"live"/i.test(alertJson) || /Current spot price/i.test(alertJson),
        false,
        'Alert output must not present static base_price as live spot price'
      );
    }
    const bankingSrc = readRepoFile('Trinity/src/banking-commodity-advanced.js');
    assert.equal(
      /Current spot price:/.test(bankingSrc),
      false,
      'banking-commodity-advanced.js must not label static base_price as "Current spot price:"'
    );
  });

  test('T2.6: agent-sandbox.js fails closed without CF_API_TOKEN (zero cf_mock_zone_*) and defaults target_worker to trinity', async () => {
    const sandbox = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/agent-sandbox.js')).href
    );

    const parsedDefaults = sandbox.domainProvisionSchema.parse({
      domain_name: 'agent-e2e.example.com',
      agent_id: 'e2e-agent'
    });
    assert.equal(
      parsedDefaults.target_worker,
      'trinity',
      `domainProvisionSchema default target_worker must be "trinity", got "${parsedDefaults.target_worker}"`
    );

    let outcome = null;
    let threw = false;
    try {
      outcome = await sandbox.provisionAgentDomain({}, 'admin', {
        domain_name: 'agent-e2e.example.com',
        agent_id: 'e2e-agent'
      });
    } catch {
      threw = true;
    }
    if (!threw) {
      assert.notEqual(outcome?.ok, true, 'provisionAgentDomain must fail closed (ok !== true) when CF_API_TOKEN is missing');
      assert.equal(
        String(outcome?.zone_id || '').startsWith('cf_mock_zone_'),
        false,
        'provisionAgentDomain must never fabricate cf_mock_zone_*'
      );
      assert.notEqual(outcome?.status, 'dns_configured', 'provisionAgentDomain must not falsely claim dns_configured');
    }
  });

  test('T2.7: skillRegistry.js Dataverse CRUD skills fail closed without DATAVERSE_TOKEN (zero mock-1 / mock-ready fallbacks)', async () => {
    const { dataverseSkills } = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/skillRegistry.js')).href
    );

    const calls = [
      ['dataverseWhoAmI', () => dataverseSkills.dataverseWhoAmI({}, {})],
      ['dataverseWhoAmI(mock)', () => dataverseSkills.dataverseWhoAmI({}, { mock: true })],
      ['dataverseQuery', () => dataverseSkills.dataverseQuery('accounts', {}, {}, {})],
      ['dataverseQuery(mock)', () => dataverseSkills.dataverseQuery('accounts', {}, {}, { mock: true })],
      ['dataverseCreateRecord', () => dataverseSkills.dataverseCreateRecord('accounts', { name: 'E2E' }, {}, {})],
      ['dataverseUpdateRecord', () => dataverseSkills.dataverseUpdateRecord('accounts', 'id-1', { name: 'E2E' }, {}, {})],
      ['dataverseDeleteRecord', () => dataverseSkills.dataverseDeleteRecord('accounts', 'id-1', {}, {})]
    ];

    for (const [label, fn] of calls) {
      let res = null;
      let threw = false;
      try {
        res = await fn();
      } catch {
        threw = true;
      }
      if (!threw) {
        const serialized = JSON.stringify(res);
        assert.equal(serialized.includes('mock-1'), false, `${label} must not return fabricated mock-1 record`);
        assert.equal(serialized.includes('mock-ready'), false, `${label} must not return mock-ready status`);
        assert.equal(serialized.includes('mock-record-'), false, `${label} must not return fabricated mock-record-*`);
        assert.notEqual(res?.deleted, true, `${label} must not claim deleted: true without token`);
        assert.notEqual(res?.updated, true, `${label} must not claim updated: true without token`);
        assert.ok(
          res?.ok === false || res?.error || res?.status === 'unconfigured' || res?.status === 'error',
          `${label} must fail closed when DATAVERSE_TOKEN is missing; got ${serialized}`
        );
      }
    }
  });

  test('T2.8: universal-ecosystem.js, SkillForge.js & EvoEngineV3.js enforce Truth Policy 2.1 (no fabricated metrics/execution/rollback)', async () => {
    const { universalEcosystem } = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/universal-ecosystem.js')).href
    );
    const { SkillForge } = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/v4/SkillForge.js')).href
    );
    const { EvoEngineV3 } = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/v4/EvoEngineV3.js')).href
    );

    const stats = universalEcosystem.getStats();
    assert.notEqual(
      stats.infinite_scale_capacity,
      1900000,
      'universalEcosystem.getStats() must not return fabricated infinite_scale_capacity: 1900000'
    );

    const app = universalEcosystem.synthesizeApp('E2ETruthCheckApp', 'software-dev');
    assert.notEqual(
      app.status,
      'ready',
      'universalEcosystem.synthesizeApp() must not claim status: "ready" for a non-deployed metadata template'
    );

    const forge = new SkillForge(null, {});
    await forge.init();
    forge.runtimeRegistry.set('persisted_no_handler', { name: 'persisted_no_handler', task: 'metadata-only' });
    const execRes = await forge.execute('persisted_no_handler', { test: 1 });
    assert.equal(execRes.success, false, 'SkillForge.execute() without a callable handler must fail closed (success: false)');
    assert.notEqual(execRes.result?.executed, true, 'SkillForge.execute() must not fabricate { executed: true }');

    const evoEngine = new EvoEngineV3(null, {});
    await evoEngine.init();
    const failRes = await evoEngine.recordFailure({
      cycleId: 'e2e-cycle-1',
      error: 'simulated_failure',
      genome: { generation: 1 }
    });
    assert.notEqual(
      failRes.autoRollbackEngaged,
      true,
      'EvoEngineV3.recordFailure() must not fabricate autoRollbackEngaged: true when no rollback occurred'
    );
  });

  test('T2.9: Local-Desktop truth-verification fails closed on missing exitCode and blocks PowerShell injection in appPath', async () => {
    const { executeWithTruthVerification } = await import(
      pathToFileURL(path.join(REPO_ROOT, 'Local-Desktop/modules/truth-verification.mjs')).href
    );

    // Missing exitCode MUST fail closed (exitCode !== 0)
    const missingExit = await executeWithTruthVerification(
      'shell_exec',
      {},
      async () => ({ output: 'completed without exitCode' })
    );
    assert.notEqual(
      missingExit.exitCode,
      0,
      `Missing exitCode must fail closed (exitCode !== 0), got ${missingExit.exitCode}`
    );

    // PowerShell metacharacter injection in appPath MUST be rejected
    const executedPsCommands = [];
    const psSpy = async (cmd) => {
      executedPsCommands.push(cmd);
      return { exitCode: 0, stdout: '1' };
    };

    const maliciousAppPath = 'notepad"; Start-Process calc.exe; #';
    let injResult = null;
    let injThrew = false;
    try {
      injResult = await executeWithTruthVerification(
        'desktop_window_manager',
        { appPath: maliciousAppPath },
        async () => ({ exitCode: 0, output: 'launched' }),
        psSpy
      );
    } catch {
      injThrew = true;
    }

    for (const cmd of executedPsCommands) {
      assert.equal(
        cmd.includes('Start-Process') || cmd.includes('calc.exe') || cmd.includes(';'),
        false,
        `PowerShell command received unsanitized injection payload: ${cmd}`
      );
    }
    if (!injThrew) {
      assert.notEqual(
        injResult?.exitCode,
        0,
        `Malicious appPath must fail closed (exitCode !== 0), got ${injResult?.exitCode}`
      );
    }
  });

  test('T2.10: Local-Gateway system-bridge logs exit_code: 1 and status: "failed" when desktop app launch throws', async () => {
    const { createSystemBridgeServer } = await import(
      pathToFileURL(path.join(REPO_ROOT, 'Local-Gateway/src/system-bridge.mjs')).href
    );

    const prevToken = process.env.TRINITY_BRIDGE_TOKEN;
    const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trinity-e2e-gw-'));
    let server = null;
    try {
      process.env.TRINITY_BRIDGE_TOKEN = SYNTHETIC_BRIDGE_TOKEN;
      server = await createSystemBridgeServer({
        port: 0,
        dataDir: tmpDataDir,
        windowsSession: {
          username: 'basterix',
          domain: 'E2E-TEST',
          authenticated: true,
          role: 'ROOT_ADMIN',
          osTokenVerified: true,
          sid: 'S-1-5-21-1000000001-1000000002-1000000003-1001'
        }
      });
      await new Promise((res) => server.listen(0, '127.0.0.1', res));
      const { port } = server.address();

      const resp = await fetch(`http://127.0.0.1:${port}/api/execute-privileged`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trinity-Bridge-Token': SYNTHETIC_BRIDGE_TOKEN
        },
        body: JSON.stringify({
          action: 'open_app',
          payload: { app: 'nonexistent-e2e-binary-xyz-999' }
        })
      });
      const body = await resp.json();

      assert.equal(body.status, 'failed', `Expected status "failed" when app launch throws, got "${body.status}"`);
      assert.equal(body.exit_code, 1, `Expected exit_code 1 when app launch throws, got ${body.exit_code}`);
      assert.equal(body.local_ledger_receipt?.exit_code, 1, 'Local sovereign ledger receipt must record exit_code: 1');
    } finally {
      if (server) {
        await new Promise((res) => server.close(res));
      }
      if (prevToken === undefined) delete process.env.TRINITY_BRIDGE_TOKEN;
      else process.env.TRINITY_BRIDGE_TOKEN = prevToken;
      fs.rmSync(tmpDataDir, { recursive: true, force: true });
    }
  });

  test('T2.11: cloudflare-doctor fails closed on Wrangler v4 exit-0 unauthenticated output and single-production D1 isolation', async () => {
    const doctor = await import(
      pathToFileURL(path.join(REPO_ROOT, 'scripts/cloudflare-doctor.mjs')).href
    );

    assert.equal(
      doctor.parseWranglerWhoamiAuth({
        status: 0,
        stdout: 'You are not authenticated. Please run `wrangler login`.',
        stderr: ''
      }),
      false,
      'Wrangler v4 exit-0 unauthenticated banner must return authenticated=false'
    );
    assert.equal(
      doctor.parseWranglerWhoamiAuth({ status: 0, stdout: '', stderr: '' }),
      false,
      'Empty whoami output must fail closed'
    );
    assert.equal(
      doctor.configStatus({
        name: 'trinity',
        routes: [{ pattern: 'auru.space' }],
        d1_databases: [{ binding: 'DB', database_id: 'prod-db-id' }]
      }).d1_environment_isolation,
      true,
      'Single-production config without env.staging must report d1_environment_isolation: true'
    );

    const cliRes = runCli(process.execPath, ['scripts/cloudflare-doctor.mjs'], {
      env: { CLOUDFLARE_API_TOKEN: '', CF_API_TOKEN: '' }
    });
    assert.equal(cliRes.status, 0, `cloudflare-doctor CLI failed: ${cliRes.stderr}`);
    const report = JSON.parse(cliRes.stdout);
    assert.equal(report.wrangler.authenticated, false, 'Unauthenticated VM must report wrangler.authenticated: false');
    assert.equal(report.api_token.available_in_process, false);
    assert.equal(report.config.production_worker, 'trinity');
    assert.equal(report.config.d1_environment_isolation, true);
    assertNoSecretLeak(cliRes.stdout, 'cloudflare-doctor.mjs');
  });
});

// ===========================================================================
// TIER 3 — CROSS-FEATURE COMBINATIONS
// ===========================================================================
describe('Tier 3 — Cross-Feature Combinations', () => {
  test('T3.1: Live protocol parity between Trinity/src/mcp.js (Miniflare /mcp) and Trinity/scripts/trinity-codex-mcp.mjs (stdio) — 48 tools + key schemas', async () => {
    const worker = await getWorkerRuntime();
    const edgeResp = await worker.fetch('/mcp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${worker.mcpSecret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });
    assert.equal(edgeResp.status, 200, `Authenticated /mcp tools/list failed with HTTP ${edgeResp.status}`);
    const edgeRpc = await parseMcpRpcResponse(edgeResp, 1);
    assert.equal(edgeRpc.error, undefined, `Edge MCP tools/list error: ${JSON.stringify(edgeRpc.error)}`);
    const edgeTools = edgeRpc.result?.tools || [];

    const { listRes: stdioRpc } = await queryStdioMcpBridgeTools();
    const stdioTools = stdioRpc.result?.tools || [];

    assert.equal(edgeTools.length, 48, `Expected 48 tools from Trinity/src/mcp.js, got ${edgeTools.length}`);
    assert.equal(stdioTools.length, 48, `Expected 48 tools from trinity-codex-mcp.mjs, got ${stdioTools.length}`);

    const toSchemaMap = (tools) =>
      new Map(
        tools.map((t) => [t.name, Object.keys(t.inputSchema?.properties || {}).sort()])
      );

    const edgeMap = toSchemaMap(edgeTools);
    const stdioMap = toSchemaMap(stdioTools);

    const missingInStdio = [...edgeMap.keys()].filter((name) => !stdioMap.has(name));
    const extraInStdio = [...stdioMap.keys()].filter((name) => !edgeMap.has(name));
    assert.deepEqual(missingInStdio, [], `Tools in mcp.js missing from trinity-codex-mcp.mjs: ${missingInStdio.join(', ')}`);
    assert.deepEqual(extraInStdio, [], `Extra tools in trinity-codex-mcp.mjs absent from mcp.js: ${extraInStdio.join(', ')}`);

    // Key contract schemas from PROJECT.md § Interface Contracts
    const keySchemas = {
      dispatch_to_agent: ['context_key', 'prompt', 'target'],
      copilot_chat: ['agent', 'query', 'session_id'],
      azure_foundry_agent_invoke: ['agent', 'conversation_id', 'message'],
      pc_run_command: ['command', 'cwd', 'rationale']
    };
    for (const [toolName, expectedProps] of Object.entries(keySchemas)) {
      assert.deepEqual(edgeMap.get(toolName), expectedProps, `Edge mcp.js schema mismatch for ${toolName}`);
      assert.deepEqual(stdioMap.get(toolName), expectedProps, `Stdio bridge schema mismatch for ${toolName}`);
    }

    // Full 48-tool property-key parity
    const schemaMismatches = [];
    for (const [name, edgeProps] of edgeMap.entries()) {
      const stdioProps = stdioMap.get(name);
      if (JSON.stringify(edgeProps) !== JSON.stringify(stdioProps)) {
        schemaMismatches.push(`${name}: edge=[${edgeProps.join(',')}] vs stdio=[${stdioProps.join(',')}]`);
      }
    }
    assert.deepEqual(schemaMismatches, [], `Input schema drift across MCP bridge:\n${schemaMismatches.join('\n')}`);
  });

  test('T3.2: project-evolution.js <-> self-deploy.yml (expected_commit_sha) & ci.yml (Full Test Suite & Validation) contract parity', async () => {
    const evo = await import(
      pathToFileURL(path.join(TRINITY_DIR, 'src/project-evolution.js')).href
    );
    const selfDeployYml = readRepoFile('.github/workflows/self-deploy.yml');
    const ciYml = readRepoFile('.github/workflows/ci.yml');

    assert.match(selfDeployYml, /expected_commit_sha:/, 'self-deploy.yml must define expected_commit_sha input');
    assert.match(ciYml, /name:\s*Full Test Suite & Validation/, 'ci.yml must define "Full Test Suite & Validation" job');

    const origFetch = globalThis.fetch;
    const capturedRequests = [];
    try {
      // 1. Verify dispatchDeployment passes expected_commit_sha & deploy_production: false
      globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        capturedRequests.push({ url: u, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
        if (u.includes('/git/ref/heads/')) {
          return Response.json({ object: { sha: 'c'.repeat(40) } });
        }
        return new Response(null, { status: 204 });
      };

      const dispatchRes = await evo.dispatchDeployment({
        TRINITY_GITHUB_TOKEN: 'e2e-synthetic-gh-token',
        TRINITY_GITHUB_BRANCH: 'main'
      });
      assert.equal(dispatchRes.deployment_requested, false);
      const dispatchCall = capturedRequests.find((r) => r.url.includes('/actions/workflows/self-deploy.yml/dispatches'));
      assert.ok(dispatchCall, 'dispatchDeployment must POST to self-deploy.yml/dispatches');
      assert.equal(dispatchCall.body?.inputs?.deploy_production, false);
      assert.equal(
        Object.hasOwn(dispatchCall.body?.inputs || {}, 'expected_commit_sha'),
        true,
        'dispatchDeployment must include expected_commit_sha matching self-deploy.yml workflow_dispatch.inputs'
      );

      // 2. Verify mergeVerifiedImprovement accepts ci.yml "Full Test Suite & Validation" check run
      const mergeCalls = [];
      globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        mergeCalls.push({ url: u, method: init.method || 'GET' });
        if (u.includes('/pulls/77/files')) {
          return Response.json([{ filename: 'Dokumentacia/e2e-check.md' }]);
        }
        if (u.includes('/check-runs')) {
          return Response.json({
            total_count: 1,
            check_runs: [
              {
                name: 'Full Test Suite & Validation',
                app: { slug: 'github-actions' },
                status: 'completed',
                conclusion: 'success'
              }
            ]
          });
        }
        if (u.includes('/pulls/77/merge') && init.method === 'PUT') {
          return Response.json({ merged: true, sha: 'a'.repeat(40) });
        }
        return Response.json({}, { status: 404 });
      };

      const mergeRes = await evo.mergeVerifiedImprovement(
        {
          TRINITY_GITHUB_TOKEN: 'e2e-synthetic-gh-token',
          TRINITY_AUTO_MERGE: 'true'
        },
        {
          number: 77,
          mergeable: true,
          mergeable_state: 'clean',
          changed_files: 1,
          head: { sha: 'b'.repeat(40) }
        }
      );
      assert.equal(
        mergeRes.status,
        'merged',
        `mergeVerifiedImprovement must accept ci.yml check "Full Test Suite & Validation", got ${JSON.stringify(mergeRes)}`
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('T3.3: 6-workspace bootstrap parity across ci.yml <-> scripts/trinity-environment.sh <-> /home/antigravity/env-setup.sh', () => {
    const ciYml = readRepoFile('.github/workflows/ci.yml');
    const envSh = readRepoFile('scripts/trinity-environment.sh');
    const bootSh = fs.readFileSync(ENV_SETUP_SCRIPT, 'utf8');

    const sixWorkspaces = [
      { label: 'root', lockfile: 'package-lock.json', ciRe: /npm ci --ignore-scripts/, envShRe: /npm ci --no-audit --no-fund --ignore-scripts/, bootRe: /install_pkg "\."/ },
      { label: 'packages/contracts', lockfile: 'packages/contracts/package-lock.json', ciRe: /packages\/contracts/, envShRe: /packages\/contracts/, bootRe: /packages\/contracts/ },
      { label: 'packages/crypto-core', lockfile: 'packages/crypto-core/package-lock.json', ciRe: /packages\/crypto-core/, envShRe: /packages\/crypto-core/, bootRe: /packages\/crypto-core/ },
      { label: 'Jericho-Worker', lockfile: 'Jericho-Worker/package-lock.json', ciRe: /Jericho-Worker/, envShRe: /Jericho-Worker/, bootRe: /Jericho-Worker/ },
      { label: 'contracts/tetrakis', lockfile: 'contracts/tetrakis/package-lock.json', ciRe: /contracts\/tetrakis/, envShRe: /contracts\/tetrakis/, bootRe: /contracts\/tetrakis/ },
      { label: 'Trinity', lockfile: 'Trinity/package-lock.json', ciRe: /--prefix Trinity ci/, envShRe: /--prefix Trinity ci/, bootRe: /install_pkg "Trinity"/ }
    ];

    for (const ws of sixWorkspaces) {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, ws.lockfile)), `Missing lockfile on disk: ${ws.lockfile}`);
      assert.match(ciYml, ws.ciRe, `ci.yml missing workspace ${ws.label}`);
      assert.match(envSh, ws.envShRe, `scripts/trinity-environment.sh missing workspace ${ws.label}`);
      assert.match(bootSh, ws.bootRe, `/home/antigravity/env-setup.sh missing workspace ${ws.label}`);
    }
  });

  test('T3.4: .gitignore protects secret files and .agents/teamwork/ while preserving .env.example (verified via git check-ignore)', () => {
    const mustBeIgnored = [
      '.env',
      '.env.local',
      '.env.production',
      '.dev.vars',
      '.agents/teamwork/sample-handoff.md',
      'Trinity/.credentials/sample.dpapi',
      'sample-private.key',
      'gcp-service-account-prod.json'
    ];
    for (const candidate of mustBeIgnored) {
      const check = runCli('git', ['check-ignore', '-q', candidate]);
      assert.equal(check.status, 0, `Expected .gitignore to ignore sensitive/metadata path "${candidate}"`);
    }

    const envExampleCheck = runCli('git', ['check-ignore', '-q', '.env.example']);
    assert.equal(envExampleCheck.status, 1, '.env.example must NOT be ignored by .gitignore');
  });

  test('T3.5: Worker <-> ledger-middleware allows authenticated Bearer append/read and never trusts spoofed X-Trinity-Actor header', async () => {
    const worker = await getWorkerRuntime();
    const appendRes = await worker.fetch('/api/audit-ledger/append', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SYNTHETIC_OPS_KEY}`,
        'Content-Type': 'application/json',
        'X-Trinity-Actor': 'spoofed_attacker_actor'
      },
      body: JSON.stringify({
        operation: 'E2E_ACTOR_BINDING_CHECK',
        actor: 'spoofed_body_actor',
        payload: { source: 'e2e' }
      })
    });
    assert.ok(
      appendRes.status === 200 || appendRes.status === 201,
      `Authenticated POST /api/audit-ledger/append must succeed (200/201), got ${appendRes.status}`
    );
    const appendBody = await appendRes.json();
    assert.equal(appendBody.success, true);
    assert.equal(
      JSON.stringify(appendBody).includes('spoofed_attacker_actor'),
      false,
      'Spoofed X-Trinity-Actor header must not be persisted in ledger block'
    );
    assert.equal(
      JSON.stringify(appendBody).includes('spoofed_body_actor'),
      false,
      'Spoofed body.actor must not override verified authenticated identity'
    );

    const readRes = await worker.fetch('/api/audit-ledger', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SYNTHETIC_OPS_KEY}`,
        'X-Trinity-Actor': 'spoofed_attacker_actor'
      }
    });
    assert.equal(readRes.status, 200, `Authenticated GET /api/audit-ledger must return 200, got ${readRes.status}`);
    const readBody = await readRes.json();
    assert.equal(readBody.success, true);
    assert.ok(Array.isArray(readBody.blocks) && readBody.blocks.length >= 1, 'Ledger read must return persisted block');
    assert.equal(
      JSON.stringify(readBody).includes('spoofed_attacker_actor'),
      false,
      'Spoofed actor header must never appear in persisted audit ledger'
    );
  });
});

// ===========================================================================
// TIER 4 — REAL-WORLD APPLICATION SCENARIOS
// ===========================================================================
describe('Tier 4 — Real-World Application Scenarios', () => {
  test('T4.1: End-to-end Pre-Flight Release Readiness Pipeline executes cleanly with zero secret leaks', () => {
    const steps = [
      {
        name: 'secrets-store-doctor',
        args: ['Trinity/scripts/secrets-store-doctor.mjs'],
        validate: (out) => {
          const j = JSON.parse(out);
          assert.equal(j.ok, true);
          assert.equal(j.secret_values_accessed, false);
        }
      },
      {
        name: 'cloudflare-env-audit',
        args: ['Trinity/scripts/cloudflare-env-audit.mjs', '--strict'],
        validate: (out) => {
          const j = JSON.parse(out);
          assert.equal(j.isolated, true);
          assert.equal(j.production, 'trinity');
        }
      },
      {
        name: 'pre-deploy-check',
        args: ['scripts/pre-deploy-check.mjs'],
        validate: (out) => {
          const j = JSON.parse(out);
          assert.equal(j.ok, true);
          assert.equal(j.production_d1, 'trinity-v03');
        }
      },
      {
        name: 'sync-root-wrangler',
        args: ['scripts/sync-root-wrangler.mjs', '--check'],
        validate: (out) => assert.match(out, /matches canonical/i)
      },
      {
        name: 'sync-release-docs',
        args: ['scripts/sync-release-docs.mjs', '--check'],
        validate: () => {}
      },
      {
        name: 'import-to-antigravity',
        args: ['scripts/import-to-antigravity.mjs', '--dry-run', '--json'],
        validate: (out) => {
          const j = JSON.parse(out);
          assert.equal(j.mode, 'dry-run');
          assert.ok(Array.isArray(j.mcp?.imported));
        }
      },
      {
        name: 'cloudflare-doctor',
        args: ['scripts/cloudflare-doctor.mjs'],
        env: { CLOUDFLARE_API_TOKEN: '', CF_API_TOKEN: '' },
        validate: (out) => {
          const j = JSON.parse(out);
          assert.equal(j.config?.production_worker, 'trinity');
          assert.equal(j.config?.d1_environment_isolation, true);
          assert.equal(j.wrangler?.authenticated, false);
        }
      }
    ];

    for (const step of steps) {
      const res = runCli(process.execPath, step.args, { env: step.env });
      assert.equal(res.status, 0, `Pre-flight step "${step.name}" failed (exit ${res.status}): ${res.stderr}`);
      assertNoSecretLeak(res.stdout, `${step.name} stdout`);
      assertNoSecretLeak(res.stderr, `${step.name} stderr`);
      step.validate(res.stdout);
    }
  });

  test('T4.2: Live public read-only edge verification receipt against https://auru.space and https://auru.dev', async () => {
    const cliRes = runCli(process.execPath, ['scripts/verify-codex-mcp-access.mjs', '--public-only'], {
      timeout: 45_000,
      env: {
        CLOUDFLARE_ACCESS_CLIENT_ID: '',
        CLOUDFLARE_ACCESS_CLIENT_SECRET: '',
        CF_ACCESS_CLIENT_ID: '',
        CF_ACCESS_CLIENT_SECRET: '',
        TRINITY_MCP_TOKEN: '',
        TRINITY_MCP_API_KEY: ''
      }
    });
    assert.equal(
      cliRes.status,
      0,
      `verify-codex-mcp-access.mjs --public-only failed (exit ${cliRes.status}):\nstdout:\n${cliRes.stdout}\nstderr:\n${cliRes.stderr}`
    );
    assert.match(cliRes.stdout, /https:\/\/auru\.space/, 'Live public receipt must include https://auru.space');
    assert.match(cliRes.stdout, /https:\/\/auru\.dev/, 'Live public receipt must include https://auru.dev');
    assertNoSecretLeak(cliRes.stdout, 'verify-codex-mcp-access --public-only stdout');
    assertNoSecretLeak(cliRes.stderr, 'verify-codex-mcp-access --public-only stderr');

    // Independent live HTTP receipt across both unified production domains
    for (const origin of ['https://auru.space', 'https://auru.dev']) {
      const healthResp = await fetch(`${origin}/health`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000)
      });
      assert.equal(healthResp.status, 200, `${origin}/health expected HTTP 200, got ${healthResp.status}`);
      const healthJson = await healthResp.json();
      assert.equal(healthJson.ok, true, `${origin}/health must return ok: true`);
      assert.equal(healthJson.environment, 'production', `${origin}/health must report environment: production`);

      const readyResp = await fetch(`${origin}/ready`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000)
      });
      assert.equal(readyResp.status, 200, `${origin}/ready expected HTTP 200, got ${readyResp.status}`);
      const readyJson = await readyResp.json();
      assert.equal(readyJson.ready, true, `${origin}/ready must return ready: true`);

      const unauthMcp = await fetch(`${origin}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000)
      });
      assert.equal(unauthMcp.status, 401, `${origin}/mcp without auth must fail closed with HTTP 401, got ${unauthMcp.status}`);
    }
  });

  test('T4.3: End-to-end Attacker vs Authenticated Operator Worker lifecycle against compiled Trinity/dist', async () => {
    const worker = await getWorkerRuntime();

    // 1. Anonymous attacker surface: public status redacted, privileged routes blocked 401
    const anonStatus = await worker.fetch('/api/status');
    assert.equal(anonStatus.status, 200);
    const anonStatusBody = await anonStatus.text();
    assert.equal(/@gmail\.com|@outlook\.com|windows_users/i.test(anonStatusBody), false);

    for (const [method, endpoint] of [
      ['POST', '/api/tools/execute'],
      ['GET', '/api/audit-ledger'],
      ['POST', '/api/audit-ledger/append'],
      ['POST', '/api/azure/agent'],
      ['POST', '/mcp']
    ]) {
      const denied = await worker.fetch(endpoint, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body: method === 'POST' ? JSON.stringify({}) : undefined
      });
      assert.equal(denied.status, 401, `Anonymous ${method} ${endpoint} must be blocked with 401`);
    }

    // 2. Authenticated operator surface: health, manifest, MCP initialize, tools/list (48), diagnostic_ping
    const manifest = await (await worker.fetch('/api/manifest')).json();
    const agentCount = Array.isArray(manifest.agents)
      ? manifest.agents.length
      : (manifest.agents ?? manifest.agents_count ?? manifest.agent_count);
    assert.equal(agentCount, 46);

    const mcpHeaders = {
      Authorization: `Bearer ${worker.mcpSecret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    };

    const initResp = await worker.fetch('/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'e2e-operator', version: '1.0.0' }
        }
      })
    });
    assert.equal(initResp.status, 200);
    const initRpc = await parseMcpRpcResponse(initResp, 10);
    assert.equal(initRpc.result?.serverInfo?.name, 'trinity');

    const listResp = await worker.fetch('/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/list', params: {} })
    });
    assert.equal(listResp.status, 200);
    const listRpc = await parseMcpRpcResponse(listResp, 11);
    assert.equal(listRpc.result?.tools?.length, 48);

    const pingResp = await worker.fetch('/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: { name: 'diagnostic_ping', arguments: { message: 'e2e-lifecycle-ping' } }
      })
    });
    assert.equal(pingResp.status, 200);
    const pingRpc = await parseMcpRpcResponse(pingResp, 12);
    assert.equal(pingRpc.error, undefined);
    const pingPayload = JSON.parse(pingRpc.result.content[0].text);
    assert.equal(pingPayload.status, 'healthy');
    assert.equal(pingPayload.echo, 'e2e-lifecycle-ping');
  });
});
