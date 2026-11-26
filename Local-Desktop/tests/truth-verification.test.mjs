import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWithTruthVerification, extractSafeProcessName } from '../modules/truth-verification.mjs';

test('truth-verification fails closed (exitCode = 1) when runner omits or returns non-numeric exitCode', async () => {
  for (const rawResult of [{}, { stdout: 'ok' }, { exitCode: null }, { exitCode: '0' }, { exitCode: NaN }, null]) {
    const res = await executeWithTruthVerification('shell_exec', {}, async () => rawResult);
    assert.equal(res.exitCode, 1, `Expected fail-closed exitCode 1 for ${JSON.stringify(rawResult)}`);
    assert.match(res.stderr, /Missing numeric exitCode/i);
  }
});

test('truth-verification blocks PowerShell command injection payloads in appPath without invoking runPowerShellFn', async () => {
  const maliciousPayloads = [
    'notepad"; calc.exe; #',
    'notepad.exe; whoami',
    '$(Start-Process calc)',
    'C:\\Windows\\foo;bar\\notepad.exe',
    'notepad`whoami',
    'notepad | Out-File pwn.txt',
    'notepad\nwhoami',
    '../../../etc/passwd'
  ];

  for (const appPath of maliciousPayloads) {
    let psCalled = false;
    const res = await executeWithTruthVerification(
      'desktop_window_manager',
      { appPath },
      async () => ({ exitCode: 0, stdout: 'launched' }),
      async () => {
        psCalled = true;
        return { stdout: '1' };
      }
    );
    assert.equal(psCalled, false, `PowerShell must NOT be called for malicious appPath: ${appPath}`);
    assert.equal(res.exitCode, 102);
    assert.match(res.error, /SECURITY_BLOCKED/);
  }
});

test('truth-verification safely extracts basename and verifies real OS process presence', async () => {
  assert.equal(extractSafeProcessName('C:\\Windows\\System32\\notepad.exe'), 'notepad');
  assert.equal(extractSafeProcessName('Code.exe'), 'Code');
  assert.equal(extractSafeProcessName('my-app_2.0'), 'my-app_2.0');
  assert.equal(extractSafeProcessName('bad name with spaces.exe'), null);

  let seenCommand = '';
  const okRes = await executeWithTruthVerification(
    'desktop_window_manager',
    { appPath: 'C:\\Windows\\System32\\notepad.exe' },
    async () => ({ exitCode: 0, stdout: 'launched' }),
    async (cmd) => {
      seenCommand = cmd;
      return { stdout: '1' };
    }
  );
  assert.equal(okRes.exitCode, 0);
  assert.match(seenCommand, /Get-Process -Name "notepad"/);

  const missingRes = await executeWithTruthVerification(
    'desktop_window_manager',
    { appPath: 'notepad.exe' },
    async () => ({ exitCode: 0, stdout: 'launched' }),
    async () => ({ stdout: '0' })
  );
  assert.equal(missingRes.exitCode, 101);
  assert.match(missingRes.error, /REALITY_CHECK_FAILED/);
});
