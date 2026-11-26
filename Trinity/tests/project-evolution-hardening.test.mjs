import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  REQUIRED_CI_CHECK_NAME,
  resolveGitHubToken,
  dispatchDeployment,
  mergeVerifiedImprovement
} from '../src/project-evolution.js';
import {
  createSelfImprovementProposal,
  approveSelfImprovementProposal,
  applySelfImprovementProposal,
  reconcileSelfImprovements
} from '../src/self-improvement.js';
import {runEvolutionCycle} from '../src/evolution.js';

function createSqliteEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE self_improvement_proposals(
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      kind TEXT,
      plugin_id TEXT,
      status TEXT,
      created_by TEXT,
      approved_by TEXT,
      result_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE ops_events(job_id TEXT, action TEXT, details TEXT);
    CREATE TABLE ops_control(id INTEGER PRIMARY KEY, emergency_stop INTEGER DEFAULT 0, reason TEXT, updated_by TEXT, updated_at TEXT);
    INSERT INTO ops_control(id, emergency_stop) VALUES(1, 0);
    CREATE TABLE ops_jobs(id TEXT PRIMARY KEY, session_id TEXT, task TEXT, status TEXT, error TEXT, provider TEXT, language TEXT, updated_at TEXT);
    CREATE TABLE ops_memory(key TEXT PRIMARY KEY, value TEXT, source TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  const DB = {
    prepare(sql) {
      let values = [];
      const stmt = sqlite.prepare(sql);
      return {
        bind(...params) { values = params; return this; },
        async first() { return stmt.get(...values) || null; },
        async all() { return {results: stmt.all(...values)}; },
        async run() { return stmt.run(...values); }
      };
    }
  };
  return {DB, sqlite, ...extra};
}

test('REQUIRED_CI_CHECK_NAME matches .github/workflows/ci.yml job name and self-deploy.yml declares expected_commit_sha', () => {
  const ciYml = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const deployYml = fs.readFileSync(new URL('../../.github/workflows/self-deploy.yml', import.meta.url), 'utf8');

  assert.equal(REQUIRED_CI_CHECK_NAME, 'Full Test Suite & Validation');
  assert.match(ciYml, /name:\s*Full Test Suite & Validation/);
  assert.match(deployYml, /expected_commit_sha:/);
  assert.match(deployYml, /deploy_production:/);
});

test('dispatchDeployment resolves main HEAD SHA or accepts explicit 40-char expected_commit_sha and rejects invalid SHA', async () => {
  const originalFetch = globalThis.fetch;
  const headSha = '1234567890abcdef1234567890abcdef12345678';
  const explicitSha = 'abcdef1234567890abcdef1234567890abcdef12';

  try {
    const dispatches = [];
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/git/ref/heads/main')) {
        return Response.json({object: {sha: headSha}});
      }
      if (String(url).endsWith('/actions/workflows/self-deploy.yml/dispatches')) {
        dispatches.push(JSON.parse(options.body));
        return new Response(null, {status: 204});
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    // 1. Auto-fetched HEAD SHA
    const autoRes = await dispatchDeployment({TRINITY_GITHUB_TOKEN: 'fixture-token'});
    assert.equal(autoRes.status, 'verification_queued');
    assert.equal(autoRes.deployment_requested, false);
    assert.equal(autoRes.deployed, false);
    assert.equal(autoRes.expected_commit_sha, headSha);
    assert.deepEqual(dispatches[0], {
      ref: 'main',
      inputs: {deploy_production: false, expected_commit_sha: headSha}
    });

    // 2. Explicit 40-char SHA (skips /git/ref fetch)
    const explicitRes = await dispatchDeployment({TRINITY_GITHUB_TOKEN: 'fixture-token'}, {expectedCommitSha: explicitSha.toUpperCase()});
    assert.equal(explicitRes.expected_commit_sha, explicitSha);
    assert.deepEqual(dispatches[1], {
      ref: 'main',
      inputs: {deploy_production: false, expected_commit_sha: explicitSha}
    });

    // 3. Invalid SHA fails closed with 400
    await assert.rejects(
      () => dispatchDeployment({TRINITY_GITHUB_TOKEN: 'fixture-token'}, {expectedCommitSha: 'not-a-sha'}),
      err => err.status === 400 && /40-character hexadecimal/i.test(err.message)
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mergeVerifiedImprovement requires Full Test Suite & Validation and rejects obsolete check name', async () => {
  const originalFetch = globalThis.fetch;
  const pr = {number: 42, changed_files: 1, mergeable: true, mergeable_state: 'clean', head: {sha: 'a'.repeat(40)}};
  const env = {TRINITY_GITHUB_TOKEN: 'fixture-token', TRINITY_AUTO_MERGE: 'true'};

  try {
    let checkName = 'Cloudflare build, tests, dependency and AI policy';
    let mergeCalls = 0;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/files?')) return Response.json([{filename: 'Trinity/public/app.css'}]);
      if (String(url).includes('/check-runs?')) {
        return Response.json({
          total_count: 1,
          check_runs: [{name: checkName, app: {slug: 'github-actions'}, status: 'completed', conclusion: 'success'}]
        });
      }
      if (String(url).endsWith('/merge') && options.method === 'PUT') {
        mergeCalls++;
        return Response.json({merged: true, sha: 'b'.repeat(40)});
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    // Obsolete check name must NOT satisfy merge gate
    const staleRes = await mergeVerifiedImprovement(env, pr);
    assert.equal(staleRes.status, 'waiting_for_checks');
    assert.equal(mergeCalls, 0);

    // Real ci.yml check name passes merge gate
    checkName = 'Full Test Suite & Validation';
    const okRes = await mergeVerifiedImprovement(env, pr);
    assert.equal(okRes.status, 'merged');
    assert.equal(okRes.merge_sha, 'b'.repeat(40));
    assert.equal(mergeCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveGitHubToken resolves tokens consistently in priority order across evolution, self-improvement, and project-evolution', async () => {
  assert.equal(resolveGitHubToken({}), null);
  assert.equal(resolveGitHubToken({TRINITY_GITHUB_TOKEN: '  ', GITHUB_TOKEN: 'gh-2'}), 'gh-2');
  assert.equal(resolveGitHubToken({TRINITY_GITHUB_TOKEN: 'trinity-1', GITHUB_TOKEN: 'gh-2'}), 'trinity-1');
  assert.equal(resolveGitHubToken({trinitygithube_key: 'legacy-3'}), 'legacy-3');
  assert.equal(resolveGitHubToken({GITHUBE_API_KEY: 'api-4'}), 'api-4');
  assert.equal(resolveGitHubToken({GTH: 'gth-5'}), 'gth-5');
  assert.equal(resolveGitHubToken({GITHUBE_FINE_TOKEN: 'fine-6'}), 'fine-6');

  // Verify self-improvement + evolution honor fallback key (e.g. GITHUBE_API_KEY) consistently
  const env = createSqliteEnv({
    GITHUBE_API_KEY: 'fallback-token',
    TRINITY_AUTO_IMPROVE: 'true',
    AI: {
      async run() {
        return {
          response: JSON.stringify({
            summary: 'Fix error handling in sample.',
            changes: [{path: 'Trinity/src/sample.js', before: 'return 1;', after: 'return 2;'}]
          })
        };
      }
    }
  });
  const originalFetch = globalThis.fetch;
  try {
    env.sqlite.prepare("INSERT INTO ops_jobs(id, session_id, task, status, error, provider, language, updated_at) VALUES('job-1','s1','Fix sample','failed','Boom','workers-ai','sk',datetime('now'))").run();
    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer fallback-token');
      if (String(url).includes('/pulls?')) return Response.json([]);
      if (String(url).includes('/git/ref/heads/')) return Response.json({object: {sha: 'a'.repeat(40)}});
      if (String(url).includes('/git/trees/')) return Response.json({sha: 'b'.repeat(40), tree: [{path: 'Trinity/src/sample.js', type: 'blob', sha: 'c'.repeat(40), size: 32}], truncated: false});
      if (String(url).includes('/contents/')) return Response.json({sha: 'c'.repeat(40), encoding: 'base64', size: 32, content: Buffer.from('export const x = () => { return 1; };').toString('base64')});
      throw new Error(`Unexpected URL: ${url}`);
    };
    const cycle = await runEvolutionCycle(env);
    assert.equal(cycle.status, 'evolution_cycle_completed');
    assert.equal(cycle.analyzed_count, 1);
    const proposal = env.sqlite.prepare('SELECT * FROM self_improvement_proposals').get();
    assert.ok(proposal, 'Evolution cycle must create proposal using unified fallback token');
    assert.equal(JSON.parse(proposal.result_json).status, 'patch_ready');
    assert.equal(JSON.parse(proposal.result_json).branch, `trinity/evolution-${proposal.id}`);
  } finally {
    globalThis.fetch = originalFetch;
    env.sqlite.close();
  }
});

test('reconcileSelfImprovements transitions patch_ready -> pull_request_created -> merged cleanly without dead-ending', async () => {
  const env = createSqliteEnv({
    TRINITY_GITHUB_TOKEN: 'fixture-token',
    TRINITY_AUTO_MERGE: 'true',
    AI: {
      async run() {
        return {
          response: JSON.stringify({
            summary: 'Update public style sheet.',
            changes: [{path: 'Trinity/public/style.css', before: 'color: red;', after: 'color: blue;'}]
          })
        };
      }
    }
  });
  const originalFetch = globalThis.fetch;

  try {
    let prStage = 'none';
    const headSha = 'd'.repeat(40);
    const mergeSha = 'e'.repeat(40);

    globalThis.fetch = async (url, options) => {
      if (String(url).includes('/pulls?')) {
        if (prStage === 'none') return Response.json([]);
        return Response.json([{
          number: 99,
          html_url: 'https://github.com/uscolective-byte/Trinity-antigravity/pull/99',
          head: {sha: headSha},
          merged_at: null
        }]);
      }
      if (String(url).includes('/git/ref/heads/')) return Response.json({object: {sha: 'a'.repeat(40)}});
      if (String(url).includes('/git/trees/')) {
        return Response.json({sha: 'b'.repeat(40), tree: [{path: 'Trinity/public/style.css', type: 'blob', sha: 'c'.repeat(40), size: 20}], truncated: false});
      }
      if (String(url).includes('/contents/')) {
        return Response.json({sha: 'c'.repeat(40), encoding: 'base64', size: 20, content: Buffer.from('body { color: red; }').toString('base64')});
      }
      if (String(url).endsWith('/pulls/99')) {
        return Response.json({
          number: 99,
          html_url: 'https://github.com/uscolective-byte/Trinity-antigravity/pull/99',
          changed_files: 1,
          mergeable: true,
          mergeable_state: 'clean',
          head: {sha: headSha},
          merged_at: null
        });
      }
      if (String(url).includes('/pulls/99/files')) {
        return Response.json([{filename: 'Trinity/public/style.css'}]);
      }
      if (String(url).includes(`/commits/${headSha}/check-runs`)) {
        return Response.json({
          total_count: 1,
          check_runs: [{
            name: 'Full Test Suite & Validation',
            app: {slug: 'github-actions'},
            status: 'completed',
            conclusion: prStage === 'ci_passed' ? 'success' : 'in_progress'
          }]
        });
      }
      if (String(url).endsWith('/pulls/99/merge') && options.method === 'PUT') {
        return Response.json({merged: true, sha: mergeSha});
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const proposal = await createSelfImprovementProposal(env, {
      title: 'Update public style',
      description: 'Adjust body color in Trinity/public/style.css cleanly.',
      kind: 'code_improvement'
    }, 'owner');
    await approveSelfImprovementProposal(env, proposal.id, 'owner');
    const applied = await applySelfImprovementProposal(env, proposal.id, 'owner');
    assert.equal(applied.result_json.status, 'patch_ready');
    assert.equal(applied.result_json.branch, `trinity/evolution-${proposal.id}`);

    // 1. Before any PR exists, reconcile keeps patch_ready untouched
    const rec0 = await reconcileSelfImprovements(env);
    assert.deepEqual(rec0, []);

    // 2. Once PR #99 is opened (CI not yet green), reconcile links patch_ready -> pull_request_created
    prStage = 'pr_open';
    const rec1 = await reconcileSelfImprovements(env);
    assert.equal(rec1.length, 1);
    assert.equal(rec1[0].status, 'pull_request_created');
    assert.equal(rec1[0].pull_request, 99);
    const midRow = env.sqlite.prepare('SELECT status, result_json FROM self_improvement_proposals WHERE id=?').get(proposal.id);
    assert.equal(midRow.status, 'approved');
    assert.equal(JSON.parse(midRow.result_json).status, 'pull_request_created');

    // 3. Once CI passes with 'Full Test Suite & Validation', reconcile merges and marks applied (deployed: false)
    prStage = 'ci_passed';
    const rec2 = await reconcileSelfImprovements(env);
    assert.equal(rec2.length, 1);
    assert.equal(rec2[0].status, 'merged');
    assert.equal(rec2[0].merge_sha, mergeSha);
    assert.equal(rec2[0].deployed, false);
    const finalRow = env.sqlite.prepare('SELECT status, result_json FROM self_improvement_proposals WHERE id=?').get(proposal.id);
    assert.equal(finalRow.status, 'applied');
    assert.equal(JSON.parse(finalRow.result_json).status, 'merged');
  } finally {
    globalThis.fetch = originalFetch;
    env.sqlite.close();
  }
});
