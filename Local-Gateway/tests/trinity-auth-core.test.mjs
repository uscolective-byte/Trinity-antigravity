import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_REGISTRY,
  inspectWindowsSession,
  verifyTrinityIdentity,
  executePrivileged
} from '../src/trinity-auth-core.mjs';

test('Local-Gateway Auth Core: automaticky overí Windows reláciu saboi + Google účty + telefónne čísla Basterixa', async () => {
  const winSession = inspectWindowsSession({ username: 'saboi', domain: 'BASTERIX-PC', sid: 'S-1-5-21-BASTERIX-1001' });
  assert.equal(winSession.authenticated, true);
  assert.equal(winSession.role, 'BASTERIX_ROOT');
  assert.ok(winSession.sessionToken);

  for (const email of ROOT_REGISTRY.google_accounts) {
    const v = verifyTrinityIdentity({ email });
    assert.equal(v.isRoot, true);
    assert.equal(v.channel, 'GOOGLE_ACCOUNT');
  }

  for (const phone of ['0949009722', '+421 949 009 722', '0949515777', '+421 949 515 777']) {
    const v = verifyTrinityIdentity({ phone });
    assert.equal(v.isRoot, true);
    assert.equal(v.channel, 'TELECOM_CHANNEL');
  }

  const ok = await executePrivileged(
    { email: 'cadjavadvocecka013@gmail.com' },
    { action: 'OPEN_APP', target: 'whatsapp' },
    () => 'EXECUTED_IMMEDIATELY'
  );
  assert.equal(ok, 'EXECUTED_IMMEDIATELY');

  await assert.rejects(
    () => executePrivileged({ email: 'intruder@example.com', checkLocalWindows: false }, { action: 'EXECUTE_CMD' }, () => 'NO'),
    /ACCESS DENIED/
  );
});
