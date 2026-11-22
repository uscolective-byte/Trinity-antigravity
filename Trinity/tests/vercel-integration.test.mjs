import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { manageVercel, listAllIntegrations } from '../src/external-integrations.js';
import { runTool, requiresVerifiedAdminForIntegrationTool, ACCOUNT_CONNECTOR_TOOLS } from '../src/tools.js';

test('manageVercel reports unconfigured status cleanly when no token exists', async () => {
  const res = await manageVercel({}, 'agent:trinity', 'status');
  assert.equal(res.success, false);
  assert.equal(res.connected, false);
  assert.equal(res.verified, false);
  assert.match(res.message, /Trezore/);
});

test('manageVercel verifies user, lists projects/deployments/domains/env (without secret values) and executes mutations', async () => {
  const originalFetch = globalThis.fetch;
  const recorded = [];

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    recorded.push({ url: u, method: opts.method || 'GET', auth: opts.headers?.Authorization });
    if (u.includes('/v2/user')) {
      return Response.json({ user: { id: 'usr_1', username: 'basterix', email: 'owner@auru.space', name: 'Ivan Sabo' } });
    }
    if (u.includes('/v9/projects/prj_1/domains')) {
      return Response.json({ domains: [{ name: 'trinity.vercel.app', verified: true }] });
    }
    if (u.includes('/v10/projects/prj_1/domains') && opts.method === 'POST') {
      return Response.json({ name: 'app.auru.space', verified: false, verification: [{ type: 'TXT', domain: '_vercel.auru.space' }] });
    }
    if (u.includes('/v9/projects/prj_1/env')) {
      return Response.json({ envs: [{ id: 'env_1', key: 'PUBLIC_API_URL', value: 'TOP_SECRET_MUST_NOT_LEAK', type: 'encrypted', target: ['production'] }] });
    }
    if (u.includes('/v9/projects')) {
      return Response.json({ projects: [{ id: 'prj_1', name: 'trinity-sovereign-os', framework: null, link: { org: 'uscolective-byte', repo: 'Trinity-antigravity' } }] });
    }
    if (u.includes('/v6/deployments')) {
      return Response.json({ deployments: [{ uid: 'dpl_1', name: 'trinity-sovereign-os', url: 'trinity-sovereign-os.vercel.app', state: 'READY', target: 'production' }] });
    }
    if (u.includes('/v13/deployments/dpl_1')) {
      return Response.json({ id: 'dpl_1', name: 'trinity-sovereign-os', url: 'trinity-sovereign-os.vercel.app', readyState: 'READY', target: 'production' });
    }
    if (u.includes('/v13/deployments') && opts.method === 'POST') {
      return Response.json({ id: 'dpl_2', name: 'trinity-sovereign-os', url: 'trinity-sovereign-os-2.vercel.app', readyState: 'QUEUED', target: 'production' });
    }
    if (u.includes('/v12/deployments/dpl_2/cancel') && opts.method === 'PATCH') {
      return Response.json({ id: 'dpl_2', readyState: 'CANCELED' });
    }
    return Response.json({ error: { message: 'unexpected ' + u } }, { status: 400 });
  };

  try {
    const env = { VERCEL_TOKEN: 'test-vercel-token', VERCEL_TEAM_ID: 'team_abc' };

    const status = await manageVercel(env, 'agent:trinity', 'status');
    assert.equal(status.success, true);
    assert.equal(status.verified, true);
    assert.equal(status.user.username, 'basterix');
    assert.ok(recorded[0].url.includes('teamId=team_abc'));

    const projects = await manageVercel(env, 'agent:trinity', 'list_projects');
    assert.equal(projects.success, true);
    assert.equal(projects.projects[0].repo, 'uscolective-byte/Trinity-antigravity');

    const deployments = await manageVercel(env, 'agent:trinity', 'list_deployments', { projectId: 'prj_1' });
    assert.equal(deployments.success, true);
    assert.equal(deployments.deployments[0].url, 'https://trinity-sovereign-os.vercel.app');

    const detail = await manageVercel(env, 'agent:trinity', 'get_deployment', { deploymentId: 'dpl_1' });
    assert.equal(detail.success, true);
    assert.equal(detail.deployment.ready_state, 'READY');

    const domains = await manageVercel(env, 'agent:trinity', 'list_domains', { projectId: 'prj_1' });
    assert.equal(domains.success, true);
    assert.equal(domains.domains[0].name, 'trinity.vercel.app');

    const envs = await manageVercel(env, 'agent:trinity', 'list_env', { projectId: 'prj_1' });
    assert.equal(envs.success, true);
    assert.equal(envs.envs[0].key, 'PUBLIC_API_URL');
    assert.equal('value' in envs.envs[0], false, 'env values must never be exposed');

    const added = await manageVercel(env, 'agent:trinity', 'add_domain', { projectId: 'prj_1', domain: 'app.auru.space' });
    assert.equal(added.success, true);
    assert.equal(added.domain.name, 'app.auru.space');

    const redeployed = await manageVercel(env, 'agent:trinity', 'redeploy', { deploymentId: 'dpl_1', name: 'trinity-sovereign-os' });
    assert.equal(redeployed.success, true);
    assert.equal(redeployed.deployment.id, 'dpl_2');

    const cancelled = await manageVercel(env, 'agent:trinity', 'cancel_deployment', { deploymentId: 'dpl_2' });
    assert.equal(cancelled.success, true);
    assert.equal(cancelled.cancelled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('vercel_manage is registered with admin mutation protection and exposed in listAllIntegrations + Vault UI + vercel.json', async () => {
  assert.equal(ACCOUNT_CONNECTOR_TOOLS.has('vercel_manage'), true);
  assert.equal(requiresVerifiedAdminForIntegrationTool('vercel_manage', { action: 'status' }), false);
  assert.equal(requiresVerifiedAdminForIntegrationTool('vercel_manage', { action: 'list_projects' }), false);
  assert.equal(requiresVerifiedAdminForIntegrationTool('vercel_manage', { action: 'add_domain' }), true);
  assert.equal(requiresVerifiedAdminForIntegrationTool('vercel_manage', { action: 'redeploy' }), true);
  assert.equal(requiresVerifiedAdminForIntegrationTool('vercel_manage', { action: 'cancel_deployment' }), true);

  const integrations = await listAllIntegrations({ VERCEL_TOKEN: 'configured-token' });
  const vercelItem = integrations.find(i => i.id === 'vercel');
  assert.ok(vercelItem);
  assert.equal(vercelItem.status, 'configured');

  const agent = { id: 'orchestrator', tools: ['vercel_manage'] };
  await assert.rejects(
    runTool({}, agent, 'vercel_manage', { action: 'status' }, { userRole: 'user' }),
    /overeného správcu/
  );
  const res = await runTool({}, agent, 'vercel_manage', { action: 'status' }, { ownerMode: true, userEmail: 'owner@auru.space' });
  assert.equal(res.connected, false);
  assert.equal(res._evidence.effect, 'read');

  const html = fs.readFileSync(new URL('../public/assistant/chat.html', import.meta.url), 'utf8');
  assert.match(html, /<option value="vercel">/);

  const vercelJson = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercelJson.outputDirectory, 'Trinity/public');
  assert.ok(vercelJson.rewrites.some(r => r.source === '/api/:path*' && r.destination === 'https://auru.space/api/:path*'));
  assert.ok(vercelJson.rewrites.some(r => r.source === '/health' && r.destination === 'https://auru.space/health'));
});
