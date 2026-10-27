import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getConnectorsRegistry,
  syncConnector,
  normalizeTonAddress,
  maskIdentifier,
  CONNECTOR_STATUSES
} from '../src/banking-connectors.js';

test('Banking Connectors: normalizeTonAddress validates TON format correctly', () => {
  // Valid User-Friendly TON addresses (48 characters starting with EQ or UQ)
  const validUQ = 'UQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D';
  const validEQ = 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D';
  assert.equal(normalizeTonAddress(validUQ), validUQ);
  assert.equal(normalizeTonAddress(validEQ), validEQ);

  // Invalid addresses
  assert.equal(normalizeTonAddress(''), null);
  assert.equal(normalizeTonAddress('0x67397A1D122c14061706c83B0017689D7289B57a'), null); // EVM is not TON
  assert.equal(normalizeTonAddress('invalid_ton_address_too_short'), null);
});

test('Banking Connectors: maskIdentifier masks sensitive information safely', () => {
  assert.equal(maskIdentifier('LT613250098859511281'), 'LT61...1281');
  assert.equal(maskIdentifier('0x67397A1D122c14061706c83B0017689D7289B57a'), '0x67...B57a');
  assert.equal(maskIdentifier('UQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D'), 'UQBK...mr0D');
  assert.equal(maskIdentifier('short'), 'short');
  assert.equal(maskIdentifier(null), null);
});

test('Banking Connectors: getConnectorsRegistry returns all 5 connectors with verified statuses', async () => {
  const env = {};
  const registry = await getConnectorsRegistry(env, 'admin');

  assert.equal(registry.mode, 'sovereign_multiwallet');
  assert.equal(registry.connectors.length, 5);

  const ids = registry.connectors.map(c => c.id);
  assert.deepEqual(ids, ['revolut_personal', 'paypal', 'telegram_wallet', 'crypto_evm', 'sepa_instant']);

  // Verify each connector has a valid status conforming to CONNECTOR_STATUSES
  for (const c of registry.connectors) {
    assert.ok(CONNECTOR_STATUSES.includes(c.status), `Invalid status '${c.status}' for ${c.id}`);
    assert.ok(typeof c.status_reason === 'string' && c.status_reason.length > 0);
    assert.equal(typeof c.can_receive, 'boolean');
    assert.equal(typeof c.requires_business, 'boolean');
  }

  // Revolut Personal must never claim live API connection without PSD2 consent
  const rev = registry.connectors.find(c => c.id === 'revolut_personal');
  assert.equal(rev.status, 'needs_provider_setup');
  assert.equal(rev.can_read_balance, false);
  assert.equal(rev.verified_balance, null);

  // Sovereign EVM crypto is verified live on-chain
  const crypto = registry.connectors.find(c => c.id === 'crypto_evm');
  assert.equal(crypto.status, 'live_verified');
  assert.equal(crypto.currency, 'USDC');
});

test('Banking Connectors: syncConnector returns status and rejects unknown connector', async () => {
  const env = {};
  const res = await syncConnector(env, 'admin', 'crypto_evm');
  assert.equal(res.connector_id, 'crypto_evm');
  assert.equal(res.status, 'live_verified');

  await assert.rejects(
    async () => syncConnector(env, 'admin', 'nonexistent_wallet'),
    /Konektor 'nonexistent_wallet' neexistuje/
  );
});
