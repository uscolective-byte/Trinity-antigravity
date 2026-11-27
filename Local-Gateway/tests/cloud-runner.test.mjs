import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { executeCloudProposal } from '../src/cloud-runner.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const approved = { status: 'approved', expiresAt: new Date(Date.now() + 60_000).toISOString() };

test('cloud runner executes an approved fixed command', async () => {
  const receipt = await executeCloudProposal(root, {
    ...approved,
    action: 'run',
    payload: { project: 'Local-Gateway', task: 'node-version', args: ['--help'] },
  });
  assert.equal(receipt.success, true);
  assert.equal(receipt.stdout.trim(), process.version);
});

test('cloud runner rejects arbitrary scripts and unapproved work', async () => {
  await assert.rejects(executeCloudProposal(root, {
    ...approved,
    action: 'run',
    payload: { project: 'Trinity', task: 'script' },
  }), /unavailable/);
  await assert.rejects(executeCloudProposal(root, {
    ...approved,
    status: 'proposed',
    action: 'run',
    payload: { project: 'Local-Gateway', task: 'node-version' },
  }), /schválený/);
});
