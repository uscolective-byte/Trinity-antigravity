import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dispatchAction, actions} from '../src/local-action-dispatcher.mjs';

test('local-action-dispatcher: system_status returns OS info and memory', async () => {
  const result = await dispatchAction('system_status');
  assert.equal(result.success, true);
  assert.match(result.output, /Počítač beží/);
  assert.match(result.output, /Pamäť:/);
});

test('local-action-dispatcher: unknown action returns error', async () => {
  const result = await dispatchAction('non_existent_action');
  assert.equal(result.success, false);
  assert.match(result.output, /Neznámy typ akcie/);
});

test('local-action-dispatcher: create_file requires filePath', async () => {
  const result = await dispatchAction('create_file', {});
  assert.equal(result.success, false);
  assert.match(result.output, /Chýba cesta/);
});
