import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/self-deploy.yml', import.meta.url), 'utf8');
const start = workflow.indexOf('\n  deploy-production:\n');
assert.ok(start !== -1, 'Production job must exist');
const deploy = workflow.slice(start);

test('deployment requires manual approval, not push', () => {
  assert.ok(workflow.includes('default: false'), 'Manual deployment must default to false');
  assert.ok(deploy.includes("if: ${{ github.event_name == 'workflow_dispatch' && inputs.deploy_production == true }}"));
  assert.ok(!deploy.includes("github.event_name == 'push'"), 'Push cannot deploy production');
  assert.ok(deploy.includes('name: production'));
});
test('verified owner and exact SHA precede access to production credentials', () => {
  const gate = deploy.indexOf('Enforce authenticated owner approval for this exact commit');
  const checkout = deploy.indexOf('uses: actions/checkout@v4');
  const credentials = deploy.indexOf('Check deployment credentials');
  assert.ok(gate >= 0 && gate < checkout && checkout < credentials);
  assert.ok(deploy.includes('"$GITHUB_ACTOR" != "uscolective-byte"'));
  assert.ok(deploy.includes('"$GITHUB_REF" != "refs/heads/main"'));
  assert.ok(deploy.includes('"$EXPECTED_COMMIT_SHA" != "$GITHUB_SHA"'));
  assert.ok(deploy.includes('^[0-9a-f]{40}$'));
});
test('migration gate is read-only and credentials failures are fatal', () => {
  assert.ok(deploy.includes('compatible-migrations.mjs --remote --check'));
  assert.ok(!deploy.includes('compatible-migrations.mjs --remote --apply'));
  assert.ok(deploy.includes('plan.pending.length'));
  assert.ok(deploy.includes('Cloudflare production credentials missing; refusing'));
  assert.ok(deploy.includes('exit 1'));
});
test('deployment receipt follows verification of auru.space', () => {
  const space = deploy.indexOf('verify-deployment.mjs https://auru.space');
  const receipt = deploy.indexOf('Emit verified DEPLOYMENT_RECEIPT.json artifact');
  assert.ok(space >= 0 && receipt > space);
  assert.ok(!deploy.includes('Retrying trinity production deploy'));
});

const vercelWorkflow = readFileSync(new URL('../.github/workflows/vercel-deploy.yml', import.meta.url), 'utf8');
const vercelStart = vercelWorkflow.indexOf('\n  deploy-production:\n');
assert.ok(vercelStart !== -1, 'Vercel production job must exist');
const vercelDeploy = vercelWorkflow.slice(vercelStart);

test('Vercel deployment must be manual and guarded by owner and exact SHA', () => {
  assert.ok(vercelWorkflow.includes('default: false'), 'Vercel deploy input must default to false');
  assert.ok(vercelDeploy.includes("if: ${{ github.event_name == 'workflow_dispatch' && inputs.deploy_production == true }}"));
  assert.ok(!vercelDeploy.includes("github.event_name == 'push'"));
  assert.ok(vercelDeploy.includes('"$GITHUB_ACTOR" != "uscolective-byte"'));
  assert.ok(vercelDeploy.includes('"$GITHUB_REF" != "refs/heads/main"'));
  assert.ok(vercelDeploy.includes('"$EXPECTED_COMMIT_SHA" != "$GITHUB_SHA"'));
  assert.ok(vercelDeploy.includes('name: production'));
});
test('Vercel missing credentials cause failure before production deploy', () => {
  const gate = vercelDeploy.indexOf('Require canonical owner approval and exact main commit');
  const check = vercelDeploy.indexOf('Require deployment credentials');
  const deployStep = vercelDeploy.indexOf('Deploy to Vercel Production');
  assert.ok(gate >= 0 && gate < check && check < deployStep);
  assert.ok(vercelDeploy.includes('Vercel credentials are incomplete; refusing'));
  assert.ok(vercelDeploy.includes('exit 1'));
});
