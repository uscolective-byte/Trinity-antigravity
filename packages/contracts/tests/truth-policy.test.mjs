import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TruthAssertionEngine, TruthPolicyViolation } from '../src/truth-policy.js';
import { TapSovereignSigner } from '../src/tap-signer.js';

test('TruthAssertionEngine: signs execution report but never calls it verified reality', async () => {
  const result = {
    toolName: 'ps_list_dir',
    exitCode: 0,
    stdout: 'Directory listing: Trinity/src, Trinity/migrations',
    stderr: '',
    rawOutput: { files: ['src', 'migrations'] }
  };

  const assertion = await TruthAssertionEngine.assertExecution(result, {
    TAP_PRIVATE_KEY: 'test_sovereign_key'
  });

  assert.equal(assertion.status, 'EXECUTION_REPORT_SIGNED');
  assert.equal(assertion.verified, false);
  assert.equal(assertion.verificationStatus, 'requires_independent_evidence');
  assert.equal(typeof assertion.executionHash, 'string');
  assert.equal(assertion.executionHash.length, 64);
  assert.equal(typeof assertion.signature, 'string');
});

test('TruthAssertionEngine: rejects non-zero exit code with TruthPolicyViolation', async () => {
  const result = {
    toolName: 'ps_execute',
    exitCode: 1,
    stdout: '',
    stderr: 'Permission denied',
    rawOutput: null
  };

  await assert.rejects(
    async () => TruthAssertionEngine.assertExecution(result),
    (err) => {
      assert(err instanceof TruthPolicyViolation);
      assert.equal(err.code, 'NON_ZERO_EXIT_CODE');
      return true;
    }
  );
});

test('TruthAssertionEngine: rejects placeholders such as TODO or mock_response', async () => {
  const placeholders = [
    '// TODO: add database logic',
    '/* sem vložte kód */',
    '<placeholder>',
    'mock_response_data',
    'feature is not implemented yet'
  ];

  for (const ph of placeholders) {
    const result = {
      toolName: 'code_generator',
      exitCode: 0,
      stdout: ph,
      stderr: '',
      rawOutput: ph
    };

    await assert.rejects(
      async () => TruthAssertionEngine.assertExecution(result),
      (err) => {
        assert(err instanceof TruthPolicyViolation);
        assert.equal(err.code, 'PLACEHOLDER_DETECTED');
        return true;
      }
    );
  }
});

test('TapSovereignSigner: signs and verifies payload deterministically', async () => {
  const key = 'secret_key_123';
  const data = 'reality_hash_abcd1234';
  const sig1 = await TapSovereignSigner.signPayload(key, data);
  const sig2 = await TapSovereignSigner.signPayload(key, data);
  assert.equal(sig1, sig2);
  const isValid = await TapSovereignSigner.verifyPayload(key, data, sig1);
  assert.equal(isValid, true);
});

test('TruthAssertionEngine: rejects a successful exit without explicit signing key', async () => {
  await assert.rejects(
    TruthAssertionEngine.assertExecution({ toolName: 'write_file', exitCode: 0, stdout: 'ok' }),
    err => err instanceof TruthPolicyViolation && err.code === 'TAP_SIGNING_KEY_REQUIRED'
  );
});

test('TapSovereignSigner: refuses missing secret and tampered evidence', async () => {
  await assert.rejects(TapSovereignSigner.signPayload(undefined, 'data'), /TAP_SIGNING_KEY_REQUIRED/);
  const signature = await TapSovereignSigner.signPayload('explicit-test-secret', 'first');
  assert.equal(await TapSovereignSigner.verifyPayload('explicit-test-secret', 'second', signature), false);
  assert.equal(await TapSovereignSigner.verifyPayload('explicit-test-secret', 'first', 'invalid'), false);
});
