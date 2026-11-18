/**
 * Trinity Phone Bridge: authenticated command envelope.
 * Shared by the Worker and native/PWA clients. No device execution is implied.
 * Authentication of the owner, device pairing, permission approval and durable
 * nonce storage MUST be implemented at the gateway, not bypassed here.
 */
import { validateCommand } from './protocol.mjs';

const encoder = new TextEncoder();

function assertSecret(secret) {
  if (typeof secret !== 'string' || encoder.encode(secret).length < 32) {
    throw new Error('Device HMAC key must contain at least 32 UTF-8 bytes');
  }
}

async function importHmacKey(secret, usage) {
  assertSecret(secret);
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Invalid HMAC signature');
  return Uint8Array.from(hex.match(/../g), part => parseInt(part, 16));
}
function canonicalBytes(body) {
  return encoder.encode(JSON.stringify({
    version: body.version,
    deviceId: body.deviceId,
    nonce: body.nonce,
    timestamp: body.timestamp,
    command: body.command
  }));
}

export async function signCommand(command, { secret, timestamp = Date.now(), nonce = crypto.randomUUID() } = {}) {
  const validated = validateCommand(command);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 30000) {
    throw new Error('Invalid signing timestamp');
  }
  if (typeof nonce !== 'string' || !/^[a-z0-9-]{16,64}$/i.test(nonce)) throw new Error('Invalid nonce');
  const body = { version: 1, deviceId: validated.deviceId, nonce, timestamp, command: validated };
  const key = await importHmacKey(secret, 'sign');
  const signature = bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, canonicalBytes(body))));
  return { ...body, signature };
}

/**
 * Verify before executing. consumeNonce MUST be a durable atomic operation:
 * return true only on the first use of (deviceId, nonce), false on duplicates.
 * In-memory sets are suitable for tests only, not for distributed production.
 */
export async function verifyCommand(envelope, {
  secret, expectedDeviceId, consumeNonce, now = Date.now()
} = {}) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Invalid envelope');
  const { version, deviceId, nonce, timestamp, command, signature } = envelope;
  if (version !== 1 || typeof deviceId !== 'string' || deviceId !== expectedDeviceId ||
      typeof nonce !== 'string' || !/^[a-z0-9-]{16,64}$/i.test(nonce) ||
      !Number.isSafeInteger(timestamp) || !Number.isSafeInteger(now) ||
      Math.abs(now - timestamp) > 30000) throw new Error('Invalid envelope identity or timestamp');
  if (typeof consumeNonce !== 'function') throw new Error('Durable nonce store required');
  const validated = validateCommand(command);
  if (validated.deviceId !== deviceId || validated.expiresAt <= now) throw new Error('Device/TTL mismatch');
  const key = await importHmacKey(secret, 'verify');
  const sigBytes = hexToBytes(signature);
  const authenticated = await crypto.subtle.verify('HMAC', key, sigBytes, canonicalBytes(envelope));
  if (!authenticated) throw new Error('Invalid command signature');
  const firstUse = await consumeNonce(deviceId, nonce, validated.expiresAt);
  if (firstUse !== true) throw new Error('Replay detected');
  return validated;
}

/** Device report is not independent proof of the physical effect. */
export function reportedExecution(command, outcome) {
  const validated = validateCommand(command);
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) throw new Error('Invalid outcome');
  if (outcome.ok !== true && outcome.ok !== false) throw new Error('Outcome requires explicit ok boolean');
  return Object.freeze({
    commandId: validated.id,
    deviceId: validated.deviceId,
    action: validated.action,
    deviceReportedStatus: outcome.ok ? 'executed' : 'failed',
    verified: false,
    verificationStatus: 'device_self_report_only',
    observedAt: new Date().toISOString(),
    ...(outcome.error ? { error: String(outcome.error).slice(0, 300) } : {})
  });
}
