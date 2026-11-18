import test from 'node:test';
import assert from 'node:assert/strict';
import { signCommand, verifyCommand, reportedExecution } from './secure-envelope.mjs';

const secret = 'trinity-test-secret-with-more-than-thirty-two-bytes';
const valid = () => ({
  id: crypto.randomUUID(), deviceId: 'android_phone001',
  action: 'device.info', payload: {}, expiresAt: Date.now() + 25000
});
const store = () => {
  const seen = new Set();
  return async (device, nonce) => {
    const id = device + ':' + nonce;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  };
};

test('valid signature, device and fresh nonce are accepted exactly once', async () => {
  const command = valid(), consumeNonce = store();
  const signed = await signCommand(command, { secret });
  const first = await verifyCommand(signed, {
    secret, expectedDeviceId: command.deviceId, consumeNonce
  });
  assert.equal(first.id, command.id);
  await assert.rejects(verifyCommand(signed, {
    secret, expectedDeviceId: command.deviceId, consumeNonce
  }), /Replay/);
});

test('tampered command or wrong key cannot execute', async () => {
  const cmd = valid(), signed = await signCommand(cmd, { secret });
  await assert.rejects(verifyCommand({
    ...signed, command: { ...signed.command, action: 'notification.show' }
  }, { secret, expectedDeviceId: cmd.deviceId, consumeNonce: store() }), /Invalid command signature/);
  await assert.rejects(verifyCommand(signed, {
    secret: 'other-very-long-device-key-xxxxxxxxxxxxxxxxxxxx',
    expectedDeviceId: cmd.deviceId, consumeNonce: store()
  }), /Invalid command signature/);
});

test('rejects cross-device requests and absent nonce storage', async () => {
  const cmd = valid(), signed = await signCommand(cmd, { secret });
  await assert.rejects(verifyCommand(signed, {
    secret, expectedDeviceId: 'iphone_different', consumeNonce: store()
  }), /identity/);
  await assert.rejects(verifyCommand(signed, {
    secret, expectedDeviceId: cmd.deviceId
  }), /Durable nonce store/);
});

test('timestamp older than 30 seconds is rejected', async () => {
  const cmd = valid(), signed = await signCommand(cmd, { secret });
  await assert.rejects(verifyCommand(signed, {
    secret, expectedDeviceId: cmd.deviceId, consumeNonce: store(),
    now: signed.timestamp + 31000
  }), /timestamp/);
});

test('device report is explicitly unverified even when device claims success', () => {
  const result = reportedExecution(valid(), { ok: true });
  assert.equal(result.deviceReportedStatus, 'executed');
  assert.equal(result.verified, false);
  assert.equal(result.verificationStatus, 'device_self_report_only');
});
