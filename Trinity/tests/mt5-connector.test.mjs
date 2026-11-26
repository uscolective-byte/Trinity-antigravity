import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  validateMt5BridgeUrl,
  getMt5Config,
  saveMt5Config,
  fetchMt5AccountSnapshot,
  getMt5History,
  prepareMt5TradeOrder
} from '../src/mt5-connector.js';
import { getConnectorsRegistry, syncConnector } from '../src/banking-connectors.js';
import { getWalletTerminalOverview } from '../src/wallet-terminals.js';
import { runTool } from '../src/tools.js';

const TEST_VAULT_KEY = Buffer.alloc(32, 7).toString('base64url');

function createMt5MockEnv(extraEnv = {}) {
  const mt5Rows = new Map();
  const secrets = new Map();
  const events = [];

  const DB = {
    prepare(sql) {
      return {
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO ops_wallet_mt5')) {
            const [owner_id, mode, broker, server, login, account_id, region, bridge_url, currency, account_type, allow_trade_execution] = this._args;
            const prev = mt5Rows.get(owner_id) || {};
            mt5Rows.set(owner_id, {
              ...prev,
              owner_id, mode, broker, server, login, account_id, region, bridge_url, currency, account_type, allow_trade_execution,
              updated_at: new Date().toISOString()
            });
            return { success: true };
          }
          if (sql.includes('UPDATE ops_wallet_mt5')) {
            const [last_verified_at, last_snapshot_json, currency, broker, server, owner_id] = this._args;
            const prev = mt5Rows.get(owner_id);
            if (prev) {
              prev.last_verified_at = last_verified_at;
              prev.last_snapshot_json = last_snapshot_json;
              prev.currency = currency;
              if (broker) prev.broker = broker;
              if (server) prev.server = server;
            }
            return { success: true };
          }
          if (sql.includes('INSERT INTO ops_events')) {
            events.push({ sql, args: this._args });
            return { success: true };
          }
          return { success: true };
        },
        async first() {
          if (sql.includes('FROM ops_wallet_mt5 WHERE owner_id=?')) {
            return mt5Rows.get(this._args[0]) || null;
          }
          if (sql.includes('INSERT INTO ops_secret_vault')) {
            const [id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint] = this._args;
            const row = { id, owner_id, provider, name, secret_ciphertext, secret_iv, secret_hint, status: 'stored', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            secrets.set(`${owner_id}:${provider}`, row);
            return row;
          }
          if (sql.includes('FROM ops_secret_vault') && sql.includes('provider=?')) {
            const provider = this._args[0];
            for (const row of secrets.values()) {
              if (row.provider === provider && row.status !== 'revoked') return row;
            }
            return null;
          }
          if (sql.includes('ops_plugins')) {
            return { id: 'trading', installed: 1, enabled: 1 };
          }
          return null;
        },
        async all() {
          if (sql.includes('ops_plugins')) {
            return { results: [{ id: 'trading', installed: 1, enabled: 1 }] };
          }
          return { results: [] };
        }
      };
    }
  };

  return {
    env: { DB, TRINITY_VAULT_KEY: TEST_VAULT_KEY, ...extraEnv },
    mt5Rows,
    secrets,
    events
  };
}

test('MT5 Connector: validateMt5BridgeUrl allows public HTTPS and rejects insecure/private/SSRF URLs', () => {
  assert.equal(validateMt5BridgeUrl('https://mt5.auru.space/bridge/'), 'https://mt5.auru.space/bridge');
  assert.equal(validateMt5BridgeUrl('http://mt5.auru.space/bridge'), null);
  assert.equal(validateMt5BridgeUrl('https://localhost:8443/mt5'), null);
  assert.equal(validateMt5BridgeUrl('https://127.0.0.1/mt5'), null);
  assert.equal(validateMt5BridgeUrl('https://169.254.169.254/latest'), null);
  assert.equal(validateMt5BridgeUrl('https://10.0.0.5/mt5'), null);
  assert.equal(validateMt5BridgeUrl('https://192.168.1.10/mt5'), null);
  assert.equal(validateMt5BridgeUrl('https://172.16.0.2/mt5'), null);
  assert.equal(validateMt5BridgeUrl('https://user:pass@mt5.auru.space/bridge'), null);
  assert.equal(validateMt5BridgeUrl('https://mt5.auru.space/bridge#frag'), null);
});

test('MT5 Connector: saveMt5Config encrypts token into Secret Vault and never returns plaintext secret', async () => {
  const { env, secrets } = createMt5MockEnv();
  const saved = await saveMt5Config(env, 'basterix', {
    mode: 'metaapi',
    broker: 'IC Markets',
    server: 'ICMarketsEU-MT5',
    login: '51234567',
    account_id: 'acc-uuid-1234-5678-90ab',
    region: 'london',
    currency: 'EUR',
    account_type: 'demo',
    api_token: 'super-secret-metaapi-token-999999'
  });

  assert.equal(saved.configured, true);
  assert.equal(saved.has_token, true);
  assert.equal(saved.token_stored_in_vault, true);
  assert.equal(saved.broker, 'IC Markets');
  assert.equal(saved.login_masked, '51••••67');
  assert.equal(JSON.stringify(saved).includes('super-secret-metaapi-token-999999'), false);
  assert.ok(secrets.has('basterix:metatrader5'));

  // Partial update preserves previously saved broker, login, account_id
  const updated = await saveMt5Config(env, 'basterix', {
    allow_trade_execution: true
  });
  assert.equal(updated.broker, 'IC Markets');
  assert.equal(updated.account_id, 'acc-uuid-1234-5678-90ab');
  assert.equal(updated.allow_trade_execution, true);

  // Validation guards
  await assert.rejects(
    saveMt5Config(createMt5MockEnv().env, 'basterix', { mode: 'metaapi', broker: 'FTMO' }),
    (err) => err.status === 400
  );
  await assert.rejects(
    saveMt5Config(createMt5MockEnv().env, 'basterix', { mode: 'bridge', bridge_url: 'http://127.0.0.1:9000' }),
    (err) => err.status === 400
  );
});

test('MT5 Connector: fetchMt5AccountSnapshot fails honestly when unconfigured or missing token, and verifies live MetaApi response', async () => {
  const unconfigured = await fetchMt5AccountSnapshot(createMt5MockEnv().env, 'basterix');
  assert.equal(unconfigured.ok, false);
  assert.equal(unconfigured.verified, false);
  assert.equal(unconfigured.status, 'needs_configuration');

  const { env } = createMt5MockEnv();
  await saveMt5Config(env, 'basterix', {
    mode: 'metaapi',
    broker: 'FTMO',
    server: 'FTMO-Demo',
    login: '10099887',
    account_id: 'ftmo-acc-123456',
    region: 'london',
    currency: 'EUR',
    account_type: 'demo'
  });

  // Missing token -> honest failure
  const noTok = await fetchMt5AccountSnapshot(env, 'basterix');
  assert.equal(noTok.ok, false);
  assert.equal(noTok.status, 'missing_credentials');

  // With token + live MetaApi mock response -> live_verified snapshot
  env.MT5_API_TOKEN = 'test-metaapi-token-12345678';
  const captured = [];
  const mockFetch = async (url, init) => {
    captured.push({ url: String(url), authToken: init?.headers?.['auth-token'] });
    if (String(url).endsWith('/account-information')) {
      return Response.json({
        platform: 'mt5',
        broker: 'FTMO',
        server: 'FTMO-Demo',
        login: 10099887,
        currency: 'EUR',
        leverage: 100,
        balance: 10000.5,
        equity: 10245.75,
        margin: 450.25,
        freeMargin: 9795.5,
        marginLevel: 2275.57
      });
    }
    if (String(url).endsWith('/positions')) {
      return Response.json([
        { id: 'pos-1', symbol: 'XAUUSD', type: 'POSITION_TYPE_BUY', volume: 0.2, openPrice: 2640.0, currentPrice: 2652.25, profit: 245.25, swap: 0, commission: -1.5 }
      ]);
    }
    if (String(url).endsWith('/orders')) {
      return Response.json([]);
    }
    return new Response('not found', { status: 404 });
  };

  const live = await fetchMt5AccountSnapshot(env, 'basterix', { fetchImpl: mockFetch });
  assert.equal(live.ok, true);
  assert.equal(live.verified, true);
  assert.equal(live.status, 'live_verified');
  assert.equal(live.snapshot.account.balance, 10000.5);
  assert.equal(live.snapshot.account.equity, 10245.75);
  assert.equal(live.snapshot.account.unrealized_pnl, 245.25);
  assert.equal(live.snapshot.positions_count, 1);
  assert.equal(live.snapshot.positions[0].symbol, 'XAUUSD');
  assert.ok(captured.some((c) => c.url.includes('london.agiliumtrade.ai') && c.authToken === 'test-metaapi-token-12345678'));

  // History endpoint works with verified response
  const hist = await getMt5History(env, 'basterix', {
    days: 7,
    fetchImpl: async () => Response.json([{ id: 'deal-1', symbol: 'EURUSD', profit: 42.5 }])
  });
  assert.equal(hist.ok, true);
  assert.equal(hist.deals_count, 1);

  // Provider HTTP 401 fails honestly
  const failRes = await fetchMt5AccountSnapshot(env, 'basterix', {
    fetchImpl: async () => new Response('Unauthorized', { status: 401 })
  });
  assert.equal(failRes.ok, false);
  assert.equal(failRes.verified, false);
  assert.equal(failRes.status, 'provider_error');
  assert.equal(failRes.http_status, 401);
});

test('MT5 Connector: prepareMt5TradeOrder enforces two-step owner safety (allow_trade_execution + confirm_live_execution)', async () => {
  const { env } = createMt5MockEnv({ MT5_API_TOKEN: 'test-bridge-token-12345678' });
  await saveMt5Config(env, 'basterix', {
    mode: 'bridge',
    broker: 'Pepperstone',
    bridge_url: 'https://mt5-bridge.auru.space',
    account_type: 'demo',
    allow_trade_execution: false
  });

  let fetchCalls = 0;
  const trackingFetch = async () => {
    fetchCalls += 1;
    return Response.json({ orderId: 'ORD-999' });
  };

  // Step 1: allow_trade_execution is false -> proposal only, zero outbound calls
  const prop1 = await prepareMt5TradeOrder(env, 'basterix', {
    symbol: 'EURUSD',
    action: 'ORDER_TYPE_BUY',
    volume: 0.1,
    confirm_live_execution: true
  }, { fetchImpl: trackingFetch });
  assert.equal(prop1.executed, false);
  assert.equal(prop1.status, 'proposal_only');
  assert.equal(fetchCalls, 0);

  // Step 2: allow_trade_execution=true, but confirm_live_execution=false -> still proposal only
  await saveMt5Config(env, 'basterix', { allow_trade_execution: true });
  const prop2 = await prepareMt5TradeOrder(env, 'basterix', {
    symbol: 'EURUSD',
    action: 'ORDER_TYPE_BUY',
    volume: 0.1,
    confirm_live_execution: false
  }, { fetchImpl: trackingFetch });
  assert.equal(prop2.executed, false);
  assert.equal(prop2.status, 'proposal_only');
  assert.equal(fetchCalls, 0);

  // Step 3: Both explicitly enabled -> executes with broker receipt
  const exec = await prepareMt5TradeOrder(env, 'basterix', {
    symbol: 'EURUSD',
    action: 'ORDER_TYPE_BUY',
    volume: 0.1,
    confirm_live_execution: true
  }, { fetchImpl: trackingFetch });
  assert.equal(exec.ok, true);
  assert.equal(exec.executed, true);
  assert.equal(exec.receipt_id, 'ORD-999');
  assert.equal(fetchCalls, 1);
});

test('MT5 Integration: banking-connectors, wallet-terminals overview, tools.js (string ownerId), and Wallet UI wiring', async () => {
  const { env } = createMt5MockEnv({ MT5_API_TOKEN: 'test-metaapi-token-87654321' });
  await saveMt5Config(env, 'basterix', {
    mode: 'metaapi',
    broker: 'IC Markets',
    account_id: 'ic-acc-9999',
    region: 'new-york',
    account_type: 'demo'
  });

  // 1. Banking connectors registry includes metatrader5 as 8th connector
  const reg = await getConnectorsRegistry(env, 'basterix');
  const mt5Conn = reg.connectors.find((c) => c.id === 'metatrader5');
  assert.ok(mt5Conn, 'metatrader5 connector must exist in registry');
  assert.equal(mt5Conn.can_read_balance, true);

  // 2. Wallet overview exposes mt5 and counts it in configured_terminals_count
  const overview = await getWalletTerminalOverview(env, 'basterix');
  assert.equal(overview.mt5.configured, true);
  assert.equal(overview.terminals.mt5.broker, 'IC Markets');
  assert.ok(overview.wallet.configured_terminals_count >= 1);

  // 3. tools.js mt5_status & wallet_terminals_status pass string ownerId (regression for object actor bug)
  const agent = { id: 'finance', tools: ['mt5_status', 'wallet_terminals_status'] };
  const toolRes = await runTool(env, agent, 'mt5_status', {}, { ownerMode: true, ownerId: 'basterix' });
  assert.equal(toolRes.configured, true);
  assert.equal(toolRes.broker, 'IC Markets');

  // 4. UI files contain MT5 pane, fixed res.channels lookup, and XSS escaping
  const chatHtml = await readFile(join(process.cwd(), 'public', 'assistant', 'chat.html'), 'utf8');
  const chatJs = await readFile(join(process.cwd(), 'public', 'assistant', 'chat.js.txt'), 'utf8');
  assert.match(chatHtml, /id="wallet-pane-mt5"/);
  assert.match(chatHtml, /id="wallet-mt5-form"/);
  assert.match(chatHtml, /id="payout-recipient-name"/);
  assert.match(chatHtml, /id="wcfg-ton"/);
  assert.match(chatHtml, /id="wallet-crypto-created-box"/);
  assert.match(chatJs, /const channels = res\.channels \|\| res\.terminals/);
  assert.match(chatJs, /\/wallet\/mt5\/config/);
  assert.match(chatJs, /\/wallet\/mt5\/sync/);
  assert.match(chatJs, /\/wallet\/terminal\/confirm/);
  assert.match(chatJs, /\/wallet\/terminal\/verify/);
});
