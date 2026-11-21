import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  normalizeViberPhone,
  viberIntegrationStatus,
  executeViberWallet,
  processViberUpdate,
  handleViberWebhook
} from '../src/viber-bridge.js';
import {
  normalizePaysafePin,
  formatPaysafePin,
  maskPaysafePin,
  normalizePaysafeAccount,
  paysafeIntegrationStatus,
  createPaysafeChargeSession,
  verifyPaysafeVoucherFormat
} from '../src/paysafe-connector.js';
import {
  terminalConfigSchema,
  terminalChargeSchema,
  getWalletTerminalOverview
} from '../src/wallet-terminals.js';
import { listAllIntegrations } from '../src/external-integrations.js';

test('Viber Bridge: normalizeViberPhone validates international phone formats', () => {
  assert.equal(normalizeViberPhone('+421901123456'), '+421901123456');
  assert.equal(normalizeViberPhone('+421 901 123 456'), '+421901123456');
  assert.equal(normalizeViberPhone('421901123456'), '+421901123456');
  assert.equal(normalizeViberPhone('invalid'), null);
  assert.equal(normalizeViberPhone(''), null);
  assert.equal(normalizeViberPhone(null), null);
});

test('Viber Bridge: viberIntegrationStatus reports service capabilities', () => {
  const status1 = viberIntegrationStatus({});
  assert.equal(status1.configured, false);
  assert.equal(status1.viber_pay_supported, true);
  assert.equal(status1.webhook_endpoint, '/api/v1/webhooks/viber');

  const status2 = viberIntegrationStatus({ VIBER_AUTH_TOKEN: 'valid_viber_auth_token_12345' });
  assert.equal(status2.configured, true);
});

test('Viber Bridge: executeViberWallet aggregates Viber Pay, Telegram @wallet, Paysafe, and Tetrakis', async () => {
  const mockEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            viber_wallet_phone: '+421901123456',
            ton_address: 'EQB_TON_WALLET_TEST_12345678901234567890',
            crypto_address: '0x7e1781e4',
            paysafe_account: 'basterix@auru.space'
          })
        })
      })
    }
  };

  const text = await executeViberWallet(mockEnv, 'admin');
  assert.match(text, /VIBER PAY PEŇAŽENKA/);
  assert.match(text, /\+421901123456/);
  assert.match(text, /viber:\/\/contact\?number=/);
  assert.match(text, /Telegram @wallet \(TON\)/);
  assert.match(text, /Paysafe \/ myPaysafe: basterix@auru\.space/);
  assert.match(text, /Tetrakis \(\$TTK\): 1 000 000 000 TTK/);
});

test('Viber Bridge: processViberUpdate handles webhook, conversation_started and /wallet command', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ viber_wallet_phone: '+421901123456' })
        })
      })
    }
  };

  // 1. Webhook ping
  const whRes = await processViberUpdate(env, { event: 'webhook' });
  assert.equal(whRes.status, 0);
  assert.equal(whRes.message, 'ok');

  // 2. Conversation started
  const convRes = await processViberUpdate(env, {
    event: 'conversation_started',
    user: { id: 'viber_user_1', name: 'Ivan' }
  });
  assert.equal(convRes.status, 0);
  assert.match(convRes.response.text, /Vítaj Ivan v suverénnom rozhraní/);
  assert.ok(convRes.response.keyboard.Buttons.some(b => b.ActionBody === '/wallet'));

  // 3. /wallet message
  const msgRes = await processViberUpdate(env, {
    event: 'message',
    sender: { id: 'viber_user_1', name: 'Ivan' },
    message: { type: 'text', text: '/wallet' }
  });
  assert.equal(msgRes.status, 0);
  assert.equal(msgRes.action, 'reply_processed');
  assert.match(msgRes.text, /VIBER PAY/);
});

test('Paysafe Connector: validates 16-digit voucher PINs and formats securely', () => {
  const raw1 = '0123456789012345';
  const raw2 = '0123-4567-8901-2345';
  const raw3 = '0123 4567 8901 2345';
  assert.equal(normalizePaysafePin(raw1), '0123456789012345');
  assert.equal(normalizePaysafePin(raw2), '0123456789012345');
  assert.equal(normalizePaysafePin(raw3), '0123456789012345');
  assert.equal(normalizePaysafePin('1234'), null); // too short
  assert.equal(normalizePaysafePin('01234567890123456789'), null); // too long

  assert.equal(formatPaysafePin(raw1), '0123-4567-8901-2345');
  assert.equal(maskPaysafePin(raw1), '0123-****-****-2345');

  const checkValid = verifyPaysafeVoucherFormat(raw2, 50.0);
  assert.equal(checkValid.valid, true);
  assert.equal(checkValid.masked_pin, '0123-****-****-2345');
  assert.equal(checkValid.expected_amount_eur, 50.0);

  const checkInvalid = verifyPaysafeVoucherFormat('abc', 10);
  assert.equal(checkInvalid.valid, false);
});

test('Paysafe Connector: createPaysafeChargeSession prepares checkout for myPaysafe', async () => {
  const session = await createPaysafeChargeSession({}, {
    amount_eur: 25.5,
    purpose: 'Licencia Trinity Core',
    variable_symbol: '12345678'
  });

  assert.equal(session.ok, true);
  assert.equal(session.provider, 'paysafe');
  assert.equal(session.amount_eur, 25.5);
  assert.equal(session.currency, 'EUR');
  assert.equal(session.variable_symbol, '12345678');
  assert.ok(session.instructions.length >= 3);
});

test('Wallet Terminals: supports viber_wallet_phone and paysafe_account in config and overview', async () => {
  const parsed = terminalConfigSchema.parse({
    iban: 'SK3112000000198742637541',
    account_name: 'Ivan Sabo',
    ton_address: 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D',
    viber_wallet_phone: '+421901123456',
    paysafe_account: 'basterix@auru.space',
    default_terminal: 'viber'
  });

  assert.equal(parsed.viber_wallet_phone, '+421901123456');
  assert.equal(parsed.paysafe_account, 'basterix@auru.space');
  assert.equal(parsed.default_terminal, 'viber');

  const chargeParsed = terminalChargeSchema.parse({
    amount_eur: 15.0,
    purpose: 'Platba cez Viber',
    terminal_type: 'viber'
  });
  assert.equal(chargeParsed.terminal_type, 'viber');

  const mockEnv = {
    DB: {
      prepare: () => ({
        run: async () => ({}),
        first: async () => ({
          viber_wallet_phone: '+421901123456',
          paysafe_account: 'basterix@auru.space',
          ton_address: 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D'
        }),
        all: async () => ({ results: [] }),
        bind: () => ({
          first: async () => ({
            viber_wallet_phone: '+421901123456',
            paysafe_account: 'basterix@auru.space',
            ton_address: 'EQBKgXCNLPexWhodcTXj4nsZ2510BSQTw510Ju6AXuzJmr0D'
          }),
          all: async () => ({ results: [] })
        })
      })
    }
  };

  const overview = await getWalletTerminalOverview(mockEnv, 'admin');
  assert.ok(overview.terminals.viber_pay);
  assert.equal(overview.terminals.viber_pay.configured, true);
  assert.equal(overview.terminals.viber_pay.phone, '+421901123456');

  assert.ok(overview.terminals.paysafe);
  assert.equal(overview.terminals.paysafe.configured, true);
  assert.equal(overview.terminals.paysafe.account, 'basterix@auru.space');

  assert.ok(overview.terminals.telegram_wallet);
  assert.equal(overview.terminals.telegram_wallet.configured, true);
});

test('Direct Connect Hub (connect.html) and integrations registry contain Viber and Paysafe', async () => {
  const htmlPath = join(process.cwd(), 'public', 'connect.html');
  const html = await readFile(htmlPath, 'utf8');

  assert.match(html, /Viber Pay & Viber Bot/);
  assert.match(html, /viber:\/\/chat/);
  assert.match(html, /\/api\/v1\/webhooks\/viber/);
  assert.match(html, /Paysafe & Paysafecard Wallet/);
  assert.match(html, /myPaysafe Portál/);
  assert.match(html, /\/api\/v1\/webhooks\/paysafe/);

  const integrations = await listAllIntegrations({
    VIBER_AUTH_TOKEN: 'token_viber',
    PAYSAFE_API_KEY: 'key_ps',
    PAYSAFE_ACCOUNT_NUMBER: 'acc_ps',
    TELEGRAM_BOT_TOKEN: 'token_tg'
  });
  const byId = Object.fromEntries(integrations.map(i => [i.id, i]));

  assert.ok(byId.viber, 'viber must be in integrations registry');
  assert.equal(byId.viber.name, 'Viber Messaging & Viber Pay');
  assert.equal(byId.viber.status, 'configured');

  assert.ok(byId.paysafe, 'paysafe must be in integrations registry');
  assert.equal(byId.paysafe.name, 'Paysafe & Paysafecard Financial Gateway');
  assert.equal(byId.paysafe.status, 'configured');

  assert.ok(byId.telegram, 'telegram must be in integrations registry');
});
