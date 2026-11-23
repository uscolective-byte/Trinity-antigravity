#!/usr/bin/env node
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTH_SECURITY
 * @description HMAC-SHA256 hash generator for authorized Trinity identities.
 * IDENTITY_HMAC_KEY is read exclusively from process.env and MUST NEVER be committed to the repository.
 */
import { createHmac } from 'node:crypto';

const key = process.env.IDENTITY_HMAC_KEY;
if (!key || key.length < 16) {
  console.error('ERROR: Environment variable IDENTITY_HMAC_KEY must be set and at least 16 characters long.');
  console.error('Usage:');
  console.error('  $env:IDENTITY_HMAC_KEY = "<strong_secret_key>"');
  console.error('  node scripts/hash-identity.mjs "+421949009722" "saboivan2008@gmail.com" "saboi"');
  process.exit(1);
}

export function normalizeIdentity(value) {
  let cleaned = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  // Normalize Slovak mobile phone numbers to canonical +421... format
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '+421' + cleaned.slice(1);
  } else if (cleaned.startsWith('4219') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export function computeHmac(value, hmacKey) {
  const norm = normalizeIdentity(value);
  return createHmac('sha256', hmacKey).update(norm).digest('hex');
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.log('Provide identities as command-line arguments.');
  process.exit(0);
}

console.log('--- TRINITY IDENTITY HMAC-SHA256 GENERATOR ---');
const hashes = [];
for (const v of inputs) {
  const normalized = normalizeIdentity(v);
  const hash = computeHmac(normalized, key);
  hashes.push(hash);
  console.log(`${hash} <- ${v}${normalized !== v ? ` (canonical: ${normalized})` : ''}`);
}

console.log('\n--- VALUE FOR WRANGLER SECRET ROOT_ID_HASHES ---');
console.log(hashes.join(','));
