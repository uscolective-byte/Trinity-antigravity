import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_REGISTRY,
  SOVEREIGN_LEGAL_CHARTER_20,
  inspectWindowsSession,
  verifyTrinityIdentity,
  executePrivileged,
  validateSovereignCharterCompliance
} from '../src/trinity-auth-core.js';
import { SovereignLedgerV3 } from '../src/sovereign-core-v3.js';

test('ROOT_REGISTRY obsahuje všetky overené identity Basterixa (Google, Windows, Telefón)', () => {
  assert.equal(ROOT_REGISTRY.architect_alias, 'Basterix');
  assert.deepEqual(ROOT_REGISTRY.windows_users, ['saboi', 'basterix']);
  assert.deepEqual(ROOT_REGISTRY.google_accounts, [
    'saboivan2008@gmail.com',
    'uscolective@gmail.com',
    'cadjavadvocecka013@gmail.com'
  ]);
  assert.deepEqual(ROOT_REGISTRY.phone_numbers, [
    '+421949009722',
    '0949009722',
    '+421949515777',
    '0949515777'
  ]);
});

test('Overenie všetkých 3 Google účtov Basterixa -> BASTERIX_ROOT (okamžitá exekúcia)', async () => {
  for (const email of [
    'saboivan2008@gmail.com',
    'uscolective@gmail.com',
    'cadjavadvocecka013@gmail.com',
    '  CADJAVADVOCECKA013@GMAIL.COM  '
  ]) {
    const auth = verifyTrinityIdentity({ email });
    assert.equal(auth.isRoot, true);
    assert.equal(auth.role, 'BASTERIX_ROOT');
    assert.equal(auth.operator, 'Basterix');
    assert.equal(auth.channel, 'GOOGLE_ACCOUNT');
    assert.equal(auth.immediateExecution, true);
    assert.equal(auth.askNoQuestions, true);

    const res = await executePrivileged({ email }, { action: 'MODIFY_CODE', target: 'index.js' }, () => 'OK_EXECUTED');
    assert.equal(res, 'OK_EXECUTED');
  }
});

test('Overenie oboch telefónnych čísiel Basterixa (0949009722, 0949515777 aj +421 formát) -> BASTERIX_ROOT', async () => {
  for (const phone of [
    '0949009722',
    '+421 949 009 722',
    '0949-515-777',
    '+421949515777'
  ]) {
    const auth = verifyTrinityIdentity({ phone });
    assert.equal(auth.isRoot, true, `Failed for phone: ${phone}`);
    assert.equal(auth.role, 'BASTERIX_ROOT');
    assert.equal(auth.operator, 'Basterix');
    assert.equal(auth.channel, 'TELECOM_CHANNEL');
    assert.equal(auth.immediateExecution, true);

    const res = await executePrivileged({ phone }, { action: 'EXECUTE_REMOTE_CMD', target: 'whatsapp' }, () => 'WHATSAPP_OK');
    assert.equal(res, 'WHATSAPP_OK');
  }
});

test('Overenie lokálneho Windows účtu saboi a basterix so SID -> BASTERIX_ROOT', async () => {
  const winSession = inspectWindowsSession({ username: 'saboi', domain: 'DESKTOP-PC', sid: 'S-1-5-21-1001' });
  assert.equal(winSession.authenticated, true);
  assert.equal(winSession.role, 'BASTERIX_ROOT');

  const auth = verifyTrinityIdentity({ windowsSession: { username: 'saboi', domain: 'DESKTOP-PC', sid: 'S-1-5-21-1001' } });
  assert.equal(auth.isRoot, true);
  assert.equal(auth.channel, 'WINDOWS_SESSION');

  const explicitWin = verifyTrinityIdentity({ windowsUser: 'basterix' });
  assert.equal(explicitWin.isRoot, true);
  assert.equal(explicitWin.channel, 'WINDOWS_LOCAL_EXPLICIT');
});

test('Cudzí používateľ (neznámy email, cudzie číslo, cudzí Windows účet) -> okamžitý HARD-LOCK a zápis do Sovereign Ledgeru', async () => {
  const ledger = new SovereignLedgerV3({});

  await assert.rejects(
    async () => {
      await executePrivileged(
        { email: 'hacker@test.com', checkLocalWindows: false },
        { action: 'MODIFY_FILE', target: 'system-bridge.js' },
        () => 'SHOULD_NOT_RUN',
        { ledger }
      );
    },
    /ACCESS DENIED: Identita 'hacker@test\.com'/
  );

  await assert.rejects(
    async () => {
      await executePrivileged(
        { phone: '+421 905 123 456', checkLocalWindows: false },
        { action: 'EXECUTE_REMOTE_CMD', target: 'del *' },
        () => 'SHOULD_NOT_RUN',
        { ledger }
      );
    },
    /ACCESS DENIED: Identita '\+421905123456'/
  );

  const chainCheck = await ledger.verifyIntegrity();
  assert.equal(chainCheck.verified, true);
  assert.equal(chainCheck.chain_length, 2);
});

test('SOVEREIGN_LEGAL_CHARTER_20 obsahuje všetkých 20 právnych doložiek a prechádza validáciou', async () => {
  assert.equal(SOVEREIGN_LEGAL_CHARTER_20.length, 20);
  const check = await validateSovereignCharterCompliance({
    thirdPartyTelemetryEnabled: false,
    simulatedExecutionAllowed: false,
    proprietaryEncryptionHiddenFromOwner: false,
    soleOwner: 'Basterix'
  });
  assert.equal(check.compliant, true);
  assert.equal(check.clauses_count, 20);
  assert.equal(check.sole_owner, 'Basterix');
});
