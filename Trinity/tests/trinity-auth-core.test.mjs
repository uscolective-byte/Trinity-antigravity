import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_REGISTRY,
  SOVEREIGN_LEGAL_CHARTER_20,
  VALID_WINDOWS_SID_REGEX,
  inspectWindowsSession,
  verifyTrinityIdentity,
  executePrivileged,
  validateSovereignCharterCompliance
} from '../src/trinity-auth-core.js';
import { SovereignLedgerV3 } from '../src/sovereign-core-v3.js';

const REAL_SID_SAMPLE = 'S-1-5-21-3544301928-1829384756-2938475610-1001';

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
  assert.ok(VALID_WINDOWS_SID_REGEX.test(REAL_SID_SAMPLE));
});

test('P0 NEGATIVE TEST (Finding 1): Samotný textový email, telefón alebo windowsUser bez kryptografického dôkazu je ZABLOKOVANÝ (Fail-Closed)', async () => {
  // 1. Podvrhnutý čistý textový email Basterixa bez verifiedGoogleToken === true
  const spoofedEmail = verifyTrinityIdentity({ email: 'saboivan2008@gmail.com' });
  assert.equal(spoofedEmail.isRoot, false);
  assert.equal(spoofedEmail.role, 'GUEST_USER');
  assert.equal(spoofedEmail.channel, 'SPOOFED_UNVERIFIED_GOOGLE_INPUT');
  assert.equal(spoofedEmail.reason, 'UNVERIFIED_GOOGLE_OAUTH_TOKEN');

  // 2. Podvrhnuté čisté telefónne číslo Basterixa bez verifiedWebhookSignature === true
  const spoofedPhone = verifyTrinityIdentity({ phone: '0949009722' });
  assert.equal(spoofedPhone.isRoot, false);
  assert.equal(spoofedPhone.role, 'GUEST_USER');
  assert.equal(spoofedPhone.channel, 'SPOOFED_UNVERIFIED_TELECOM_INPUT');
  assert.equal(spoofedPhone.reason, 'UNVERIFIED_TELECOM_WEBHOOK_SIGNATURE');

  // 3. Podvrhnutý čistý windowsUser bez osTokenVerified + skutočného SID
  const spoofedWin = verifyTrinityIdentity({ windowsUser: 'saboi' });
  assert.equal(spoofedWin.isRoot, false);
  assert.equal(spoofedWin.role, 'GUEST_USER');
  assert.equal(spoofedWin.channel, 'SPOOFED_UNVERIFIED_WINDOWS_INPUT');
  assert.equal(spoofedWin.reason, 'UNVERIFIED_WINDOWS_TOKEN_OR_SID');

  // 4. executePrivileged musí vyhodiť 403 ACCESS DENIED pre neoverený email Basterixa
  const ledger = new SovereignLedgerV3({});
  await assert.rejects(
    async () => {
      await executePrivileged(
        { email: 'saboivan2008@gmail.com' },
        { action: 'MODIFY_CODE', target: 'index.js' },
        () => 'SHOULD_NEVER_EXECUTE',
        { ledger }
      );
    },
    /ACCESS DENIED.*UNVERIFIED_GOOGLE_OAUTH_TOKEN/
  );
});

test('P0 NEGATIVE TEST (Finding 2): Syntetický SID alebo podvrhnutý USERNAME v prostredí je ZABLOKOVANÝ', () => {
  // Syntetický SID v štýle S-1-5-21-BASTERIX-SABOI musí byť odmietnutý
  const syntheticSidSession = inspectWindowsSession({
    username: 'saboi',
    domain: 'BASTERIX',
    sid: 'S-1-5-21-BASTERIX-SABOI',
    osTokenVerified: true
  });
  assert.equal(syntheticSidSession.authenticated, false);
  assert.equal(syntheticSidSession.role, 'GUEST_USER');
  assert.equal(syntheticSidSession.reason, 'INVALID_OR_SYNTHETIC_WINDOWS_SID');

  // Skutočný formát SID, ale bez osTokenVerified === true musí byť odmietnutý
  const unverifiedOsSession = inspectWindowsSession({
    username: 'saboi',
    domain: 'BASTERIX',
    sid: REAL_SID_SAMPLE,
    osTokenVerified: false
  });
  assert.equal(unverifiedOsSession.authenticated, false);
  assert.equal(unverifiedOsSession.reason, 'UNVERIFIED_WINDOWS_OS_TOKEN');
});

test('Overenie všetkých 3 Google účtov Basterixa s verifiedGoogleToken === true -> BASTERIX_ROOT', async () => {
  for (const email of [
    'saboivan2008@gmail.com',
    'uscolective@gmail.com',
    'cadjavadvocecka013@gmail.com',
    '  CADJAVADVOCECKA013@GMAIL.COM  '
  ]) {
    const auth = verifyTrinityIdentity({ email, verifiedGoogleToken: true });
    assert.equal(auth.isRoot, true);
    assert.equal(auth.role, 'BASTERIX_ROOT');
    assert.equal(auth.operator, 'Basterix');
    assert.equal(auth.channel, 'GOOGLE_ACCOUNT');
    assert.equal(auth.immediateExecution, true);
    assert.equal(auth.askNoQuestions, true);

    const res = await executePrivileged(
      { email, verifiedGoogleToken: true },
      { action: 'MODIFY_CODE', target: 'index.js' },
      () => 'OK_EXECUTED'
    );
    assert.equal(res, 'OK_EXECUTED');
  }
});

test('Overenie oboch telefónnych čísiel Basterixa s verifiedWebhookSignature === true -> BASTERIX_ROOT', async () => {
  for (const phone of [
    '0949009722',
    '+421 949 009 722',
    '0949-515-777',
    '+421949515777'
  ]) {
    const auth = verifyTrinityIdentity({ phone, verifiedWebhookSignature: true });
    assert.equal(auth.isRoot, true, `Failed for phone: ${phone}`);
    assert.equal(auth.role, 'BASTERIX_ROOT');
    assert.equal(auth.operator, 'Basterix');
    assert.equal(auth.channel, 'TELECOM_CHANNEL');
    assert.equal(auth.immediateExecution, true);

    const res = await executePrivileged(
      { phone, verifiedWebhookSignature: true },
      { action: 'EXECUTE_REMOTE_CMD', target: 'whatsapp' },
      () => 'WHATSAPP_OK'
    );
    assert.equal(res, 'WHATSAPP_OK');
  }
});

test('Overenie lokálneho Windows účtu saboi a basterix so skutočným SID a osTokenVerified: true -> BASTERIX_ROOT', async () => {
  const winSession = inspectWindowsSession({
    username: 'saboi',
    domain: 'DESKTOP-PC',
    sid: REAL_SID_SAMPLE,
    osTokenVerified: true
  });
  assert.equal(winSession.authenticated, true);
  assert.equal(winSession.role, 'BASTERIX_ROOT');

  const auth = verifyTrinityIdentity({
    windowsSession: {
      username: 'saboi',
      domain: 'DESKTOP-PC',
      sid: REAL_SID_SAMPLE,
      osTokenVerified: true
    }
  });
  assert.equal(auth.isRoot, true);
  assert.equal(auth.channel, 'WINDOWS_SESSION');

  const explicitWin = verifyTrinityIdentity({
    windowsUser: 'basterix',
    sid: REAL_SID_SAMPLE,
    verifiedWindowsToken: true
  });
  assert.equal(explicitWin.isRoot, true);
  assert.equal(explicitWin.channel, 'WINDOWS_LOCAL_EXPLICIT');
});

test('Cudzí používateľ (neznámy email, cudzie číslo, cudzí Windows účet) -> okamžitý HARD-LOCK a zápis do Sovereign Ledgeru', async () => {
  const ledger = new SovereignLedgerV3({});

  await assert.rejects(
    async () => {
      await executePrivileged(
        { email: 'hacker@test.com', verifiedGoogleToken: true, checkLocalWindows: false },
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
        { phone: '+421 905 123 456', verifiedWebhookSignature: true, checkLocalWindows: false },
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
