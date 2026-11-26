import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveWalletTerminalConfig,
  executeWalletPayout,
  cancelWalletPayout
} from '../src/wallet-terminals.js';
import { proposeTransfer, confirmTransfer } from '../src/finance-gateway.js';
import { transactWallet } from '../src/wallet.js';
import {
  verifyPaysafeVoucherFormat,
  createPaysafeChargeSession
} from '../src/paysafe-connector.js';
import {
  configureCommerceAccounts,
  upsertCommerceProduct,
  handleCommercePublic
} from '../src/revolut.js';

function createTerminalDb() {
  const terminals = new Map();
  const payouts = new Map();

  return {
    terminals,
    payouts,
    DB: {
      prepare(sql) {
        return {
          _args: [],
          bind(...args) {
            this._args = args;
            return this;
          },
          async run() {
            if (sql.includes('INSERT INTO ops_wallet_terminals')) {
              const [
                owner_id, iban, bic, account_name, revolut_handle,
                paypal_email, crypto_address, crypto_network, default_terminal,
                ton_address, viber_wallet_phone, paysafe_account
              ] = this._args;
              terminals.set(owner_id, {
                owner_id, iban, bic, account_name, revolut_handle,
                paypal_email, crypto_address, crypto_network, default_terminal,
                ton_address, viber_wallet_phone, paysafe_account
              });
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes('INSERT INTO ops_terminal_payouts_v2')) {
              const [id, owner_id, amount_cents, destination_type, target, recipient_name, note, reference] = this._args;
              payouts.set(id, {
                id, owner_id, amount_cents, currency: 'EUR', destination_type,
                target, recipient_name, note, reference, status: 'prepared'
              });
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes("DELETE FROM ops_terminal_payouts_v2 WHERE id=? AND owner_id=? AND status='prepared'")) {
              const [id, owner_id] = this._args;
              const row = payouts.get(id);
              if (row && row.owner_id === owner_id && row.status === 'prepared') {
                payouts.delete(id);
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }
            return { success: true, meta: { changes: 1 } };
          },
          async first() {
            if (sql.includes('FROM ops_wallet_terminals WHERE owner_id=?')) {
              return terminals.get(this._args[0]) || null;
            }
            if (sql.includes('SELECT id, status FROM ops_terminal_payouts_v2')) {
              const [idOrRef, , ownerId] = this._args;
              for (const p of payouts.values()) {
                if (p.owner_id === ownerId && (p.id === idOrRef || p.reference === idOrRef)) {
                  return { id: p.id, status: p.status };
                }
              }
              return null;
            }
            return null;
          },
          async all() {
            if (sql.includes('FROM ops_terminal_payouts_v2')) {
              return { results: [...payouts.values()] };
            }
            return { results: [] };
          }
        };
      }
    }
  };
}

test('Wallet Terminals: partial saveWalletTerminalConfig merges with existing channels without wiping data', async () => {
  const { DB, terminals } = createTerminalDb();
  const env = { DB };

  await saveWalletTerminalConfig(env, 'basterix', {
    iban: 'SK3112000000198742637541',
    account_name: 'Ivan Sabo',
    revolut_handle: '@isabo91',
    ton_address: 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D',
    viber_wallet_phone: '+421901123456',
    paysafe_account: 'basterix@auru.space'
  });

  // Update only paypal_email — all previously stored channels must remain intact
  const updated = await saveWalletTerminalConfig(env, 'basterix', {
    paypal_email: 'saboivan2008@gmail.com'
  });

  const saved = terminals.get('basterix');
  assert.equal(saved.iban, 'SK3112000000198742637541');
  assert.equal(saved.account_name, 'Ivan Sabo');
  assert.equal(saved.revolut_handle, 'isabo91');
  assert.equal(saved.ton_address, 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D');
  assert.equal(saved.viber_wallet_phone, '+421901123456');
  assert.equal(saved.paysafe_account, 'basterix@auru.space');
  assert.equal(saved.paypal_email, 'saboivan2008@gmail.com');
  assert.equal(updated.terminals.sepa.configured, true);
  assert.equal(updated.terminals.paypal.configured, true);
});

test('Wallet Terminals: executeWalletPayout handles telegram_wallet, viber, paysafe, paypal, revolut, and bank_iban cleanly', async () => {
  const { DB } = createTerminalDb();
  const env = { DB };

  const ton = await executeWalletPayout(env, 'basterix', {
    amount_eur: 45,
    destination_type: 'telegram_wallet',
    target: 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D'
  });
  assert.equal(ton.status, 'prepared');
  assert.equal(ton.executed, false);
  assert.equal(ton.instruction.type, 'ton_transfer');
  assert.match(ton.instruction.uri, /^ton:\/\/transfer\//);
  assert.ok(ton.instruction.qr_svg.includes('<svg'));

  const viber = await executeWalletPayout(env, 'basterix', {
    amount_eur: 20,
    destination_type: 'viber',
    target: '+421901123456'
  });
  assert.equal(viber.instruction.type, 'viber_pay');
  assert.match(viber.instruction.url, /^viber:\/\/contact\?number=/);

  const paysafe = await executeWalletPayout(env, 'basterix', {
    amount_eur: 30,
    destination_type: 'paysafe',
    target: 'basterix@auru.space'
  });
  assert.equal(paysafe.instruction.type, 'manual');
  assert.equal(paysafe.instruction.url, 'https://my.paysafecard.com/');

  const paypal = await executeWalletPayout(env, 'basterix', {
    amount_eur: 50,
    destination_type: 'paypal',
    target: '@basterix'
  });
  assert.equal(paypal.instruction.type, 'link');
  assert.match(paypal.instruction.url, /paypal\.me\/basterix\/50\.00EUR/);

  const revolut = await executeWalletPayout(env, 'basterix', {
    amount_eur: 60,
    destination_type: 'revolut',
    target: '@isabo91'
  });
  assert.equal(revolut.instruction.type, 'link');
  assert.equal(revolut.instruction.url, 'https://revolut.me/isabo91');

  const sepa = await executeWalletPayout(env, 'basterix', {
    amount_eur: 100,
    destination_type: 'bank_iban',
    target: 'SK3112000000198742637541',
    recipient_name: 'Ivan Sabo'
  });
  assert.equal(sepa.instruction.type, 'sepa_epc_qr');
  assert.ok(sepa.instruction.epc_payload.includes('SK3112000000198742637541'));
});

test('Wallet Terminals: cancelWalletPayout enforces 404 on missing and 409 on reported_sent payouts', async () => {
  const { DB, payouts } = createTerminalDb();
  const env = { DB };

  // Missing payout -> 404
  await assert.rejects(
    cancelWalletPayout(env, 'basterix', 'PAYOUT-NOPE0000'),
    (err) => err.status === 404
  );

  // Prepared payout -> deleted cleanly
  const prepared = await executeWalletPayout(env, 'basterix', {
    amount_eur: 15,
    destination_type: 'revolut',
    target: '@isabo91'
  });
  const cancelled = await cancelWalletPayout(env, 'basterix', prepared.payout_id);
  assert.equal(cancelled.deleted, true);

  // Already confirmed/reported_sent payout -> 409 Conflict
  payouts.set('PAYOUT-SENT0001', {
    id: 'PAYOUT-SENT0001',
    owner_id: 'basterix',
    reference: 'TRINITY-SENT0001',
    status: 'reported_sent'
  });
  await assert.rejects(
    cancelWalletPayout(env, 'basterix', 'PAYOUT-SENT0001'),
    (err) => err.status === 409
  );
  assert.ok(payouts.has('PAYOUT-SENT0001'));
});

test('Finance Gateway: confirmTransfer blocks missing, empty, or wrong confirmation_token (zero auth bypass)', async () => {
  const proposals = new Map();
  const env = {
    DB: {
      prepare(sql) {
        return {
          _args: [],
          bind(...args) { this._args = args; return this; },
          async run() {
            if (sql.includes('INSERT INTO ops_finance_proposals')) {
              const [id, owner_id, amount_cents, recipient, provider, note, requires_push, confirmation_code, signature_hash, expires_at] = this._args;
              proposals.set(id, { id, owner_id, amount_cents, currency: 'EUR', recipient, provider, note, status: 'pending', requires_push_confirmation: requires_push, confirmation_code, signature_hash, expires_at });
            }
            return { success: true };
          },
          async first() {
            if (sql.includes('SELECT SUM(amount_cents)')) return { total: 0 };
            if (sql.includes('SELECT * FROM ops_finance_proposals WHERE id=?')) return proposals.get(this._args[0]) || null;
            return null;
          },
          async all() { return { results: [] }; }
        };
      }
    }
  };

  const proposal = await proposeTransfer(env, 'basterix', {
    amount_eur: 20,
    recipient: '@basterix',
    provider: 'revolut'
  });
  assert.match(String(proposal.confirmation_code), /^\d{6}$/);

  // Missing confirmation_token must fail schema validation
  await assert.rejects(
    confirmTransfer(env, 'basterix', { proposal_id: proposal.proposal_id })
  );

  // Empty confirmation_token must fail
  await assert.rejects(
    confirmTransfer(env, 'basterix', { proposal_id: proposal.proposal_id, confirmation_token: '' })
  );

  // Wrong confirmation_token must fail with 403
  const wrongToken = proposal.confirmation_code === '000000' ? '999999' : '000000';
  await assert.rejects(
    confirmTransfer(env, 'basterix', { proposal_id: proposal.proposal_id, confirmation_token: wrongToken }),
    (err) => err.status === 403
  );
});

test('Sandbox Wallet: transactWallet enforces atomic balance check preventing concurrent overdraft', async () => {
  let balanceCents = 1000; // 10.00 EUR
  let simulateConcurrentDrain = false;
  const env = {
    DB: {
      prepare(sql) {
        return {
          _args: [],
          bind(...args) { this._args = args; return this; },
          async first() {
            if (sql.includes('SELECT * FROM wallet_accounts WHERE owner_id=?')) {
              return { id: 'w-1', owner_id: 'basterix', name: 'Sandbox', currency: 'EUR', balance_cents: balanceCents };
            }
            if (sql.includes('UPDATE wallet_accounts SET balance_cents=balance_cents-?')) {
              const [amount, , guardAmount] = this._args;
              if (simulateConcurrentDrain) {
                // Another concurrent transaction drained funds between SELECT and UPDATE
                return null;
              }
              if (balanceCents < guardAmount) return null;
              balanceCents -= amount;
              return { balance_cents: balanceCents };
            }
            if (sql.includes('UPDATE wallet_accounts SET balance_cents=balance_cents+?')) {
              balanceCents += this._args[0];
              return { balance_cents: balanceCents };
            }
            return null;
          },
          async all() { return { results: [] }; },
          async run() { return { success: true }; }
        };
      },
      async batch() { return []; }
    }
  };

  // Normal withdrawal within balance succeeds
  const res = await transactWallet(env, 'basterix', { type: 'withdrawal', amount: 4 });
  assert.equal(res.balance, 6);

  // Concurrent drain between read and atomic conditional UPDATE is rejected with 409
  simulateConcurrentDrain = true;
  await assert.rejects(
    transactWallet(env, 'basterix', { type: 'withdrawal', amount: 5 }),
    (err) => err.status === 409
  );
});

test('Paysafe Connector: never returns plaintext PIN and rejects non-positive amounts', async () => {
  const checked = verifyPaysafeVoucherFormat('0123-4567-8901-2345', 25);
  assert.equal(checked.valid, true);
  assert.equal(checked.redeemed, false);
  assert.equal(checked.status, 'format_valid_unredeemed');
  assert.equal(checked.masked_pin, '0123-****-****-2345');
  assert.equal('formatted_pin' in checked, false, 'Plaintext formatted_pin must never be returned');
  assert.equal(JSON.stringify(checked).includes('0123456789012345'), false);
  assert.equal(JSON.stringify(checked).includes('0123-4567-8901-2345'), false);

  const zeroRes = await createPaysafeChargeSession({}, { amount_eur: 0, purpose: 'Zero' });
  assert.equal(zeroRes.ok, false);
  assert.equal(zeroRes.status, 'invalid_amount');

  const negRes = await createPaysafeChargeSession({}, { amount_eur: -10, purpose: 'Negative' });
  assert.equal(negRes.ok, false);
  assert.equal(negRes.status, 'invalid_amount');

  const session = await createPaysafeChargeSession({}, { amount_eur: 15, purpose: 'Test' });
  assert.equal(session.ok, true);
  assert.equal(session.paid, false);
});

test('Revolut/PayPal Checkout HTML: safely escapes JS injection payloads and verifies completed===true before success', async () => {
  const kv = new Map();
  const env = {
    PAYPAL_CLIENT_ID: 'sb-test-client-id',
    Mastermind: {
      async get(k) { return kv.get(k) ?? null; },
      async put(k, v) { kv.set(k, v); }
    }
  };

  await configureCommerceAccounts(env, 'owner', {
    business_name: 'Trinity Studio',
    revolut_url: 'https://revolut.me/trinitystudio',
    paypal_url: 'https://paypal.me/trinitystudio',
    default_currency: 'EUR',
    note: 'Overená platba'
  });

  await upsertCommerceProduct(env, 'owner', {
    provider: 'paypal',
    product: {
      id: 'xss-test',
      name: `Audit '</script><script>alert(1)</script>`,
      description: 'Security check',
      amount_cents: 2500,
      currency: 'EUR',
      payment_url: 'https://paypal.me/trinitystudio/25',
      active: true,
      expires_at: null
    }
  });

  const resp = await handleCommercePublic(new Request('https://auru.space/pay/checkout/xss-test'), env);
  assert.equal(resp.status, 200);
  const html = await resp.text();

  // Raw unescaped closing script tag must never appear inside inline JS
  assert.equal(html.includes("'</script><script>alert(1)</script>"), false);
  assert.match(html, /\\u003c\/script>/);
  // onApprove must verify res.ok && details.completed === true (rejects when !== true)
  assert.match(html, /!res\.ok\s*\|\|\s*details\.completed\s*!==\s*true/);
});
