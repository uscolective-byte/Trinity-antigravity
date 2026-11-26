/**
 * @module TRINITY_OMNI_CORE
 * @subsystem EXTERNAL_CONNECTORS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Banking and multi-wallet connectors registry (Trinity/src/banking-connectors.js) in TRINITY OMNI-CORE.
 */
/**
 * Banking & Multi-Wallet Connectors Registry for Trinity
 * Adheres strictly to Hardcore Truth Policy 2.1.
 * Supports personal accounts, Open Banking, PayPal, Telegram Wallet, and on-chain crypto.
 */
import { HttpError } from './security.js';
import { resolveProviderSecret } from './secret-vault.js';
import { normalizeIban, normalizeBic, normalizeEvmAddress, readUsdcBalance, CRYPTO_CHAINS } from './wallet-terminals.js';
import { getMt5Config, fetchMt5AccountSnapshot } from './mt5-connector.js';

export const CONNECTOR_STATUSES = [
  'unsupported',
  'needs_provider_setup',
  'needs_user_consent',
  'sandbox_connected',
  'live_verified',
  'expired',
  'error'
];

/**
 * Normalizes TON blockchain address (User-friendly format EQ... / UQ... or raw 0:...)
 */
export function normalizeTonAddress(raw) {
  const s = String(raw || '').trim();
  if (/^[EU]Q[a-zA-Z0-9_-]{46}$/.test(s) || /^[EU]Q[a-zA-Z0-9+/]{46}={0,2}$/.test(s) || /^-?[0-1]:[0-9a-fA-F]{64}$/.test(s)) {
    return s;
  }
  return null;
}

/**
 * Mask sensitive identifiers (IBAN, addresses) for safe presentation
 */
export function maskIdentifier(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

/**
 * Returns full status of all registered banking and wallet connectors for the authenticated owner.
 */
export async function getConnectorsRegistry(env, ownerId = 'admin') {
  let terminalRow = null;
  if (env?.DB?.prepare) {
    try {
      terminalRow = await env.DB.prepare('SELECT * FROM ops_wallet_terminals WHERE owner_id=?').bind(ownerId).first();
      if (!terminalRow && ownerId !== 'admin') {
        terminalRow = await env.DB.prepare('SELECT * FROM ops_wallet_terminals WHERE owner_id=?').bind('admin').first();
      }
    } catch {}
  }

  // Payment destinations must come from explicit owner configuration. No personal
  // or crypto address is inferred from a default value.
  const iban = terminalRow?.iban ? normalizeIban(terminalRow.iban) : null;
  const bic = terminalRow?.bic ? normalizeBic(terminalRow.bic) : null;
  const accountName = terminalRow?.account_name || null;
  const revolutHandle = terminalRow?.revolut_handle || null;
  const paypalEmail = terminalRow?.paypal_email || null;
  const cryptoAddress = terminalRow?.crypto_address ? normalizeEvmAddress(terminalRow.crypto_address) : null;
  const cryptoNetwork = CRYPTO_CHAINS[terminalRow?.crypto_network] ? terminalRow.crypto_network : 'polygon';
  const tonAddress = terminalRow?.ton_address ? normalizeTonAddress(terminalRow.ton_address) : null;
  const viberPhone = terminalRow?.viber_wallet_phone || null;
  const paysafeAccount = terminalRow?.paysafe_account || null;

  // 1. Revolut Personal Connector
  const revolutPersonal = {
    id: 'revolut_personal',
    name: 'Revolut Personal (Revolut Bank UAB)',
    category: 'bank_account',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      iban: iban ? `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}` : null,
      bic,
      recipient_name: accountName,
      payment_link: revolutHandle || null
    },
    status: 'needs_provider_setup',
    status_reason: revolutHandle
      ? 'Revolut link is configured. Trinity has not verified profile ownership or payment receipt.'
      : 'Revolut link is not configured. Personal account Open Banking connection is inactive.',
    can_receive: Boolean(revolutHandle),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: 'Configure GoCardless (Nordigen) Open Banking API for automated personal Revolut transaction reads.'
  };

  // 2. PayPal Checkout & Personal Connector
  const hasPaypalSecret = Boolean(env?.PAYPAL_CLIENT_SECRET || env?.PAYPAL_CLIENT_ID);
  const paypalMode = (env?.PAYPAL_MODE || 'live').toLowerCase();
  const paypalEmailAddress = paypalEmail && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(paypalEmail)
    ? paypalEmail
    : null;
  const paypalHandle = paypalEmail && /^[A-Za-z0-9]{3,20}$/.test(paypalEmail)
    ? paypalEmail
    : null;
  const paypal = {
    id: 'paypal',
    name: 'PayPal (Personal / Orders v2)',
    category: 'payment_gateway',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      email: paypalEmailAddress ? `${paypalEmailAddress.slice(0, 3)}***@${paypalEmailAddress.split('@')[1]}` : null,
      paypal_me: paypalHandle ? `https://paypal.me/${paypalHandle}` : null
    },
    status: 'needs_provider_setup',
    status_reason: hasPaypalSecret
      ? `PayPal credentials are configured in ${paypalMode} mode, but their validity and account linkage were not verified by this registry.`
      : 'Neither a PayPal account nor a payment link is verified.',
    can_receive: Boolean(paypalEmailAddress || paypalHandle),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: paypalEmailAddress || paypalHandle
      ? 'Verify the PayPal account and checkout flow before accepting customer payments.'
      : 'Configure a verified PayPal account.'
  };

  // 3. Telegram Wallet Connector
  const telegram = {
    id: 'telegram_wallet',
    name: 'Telegram Wallet (@wallet / TON)',
    category: 'telegram_wallet',
    account_type: 'personal',
    currency: 'USDT / TON',
    receiving_endpoint: {
      ton_address: tonAddress ? maskIdentifier(tonAddress) : null,
      telegram_service: 'Telegram @wallet'
    },
    status: tonAddress ? 'needs_user_consent' : 'needs_provider_setup',
    status_reason: tonAddress
      ? 'TON address is configured. Trinity has not verified address ownership or balance; bot tokens have no wallet access.'
      : 'Enter your personal TON address from Telegram (@wallet -> Deposit -> USDT/TON) so Trinity can generate QR codes and track incoming deposits.',
    can_receive: Boolean(tonAddress),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null, // TON / USDT balance
    last_sync_at: null,
    next_action: tonAddress ? 'Ready to receive crypto payments.' : 'Open Telegram @wallet and copy your TON address.'
  };

  // 4. Owner-configured EVM receive address. A public RPC balance read does not
  // prove that the owner controls the address.
  let onchainBalance = null;
  const chain = CRYPTO_CHAINS[cryptoNetwork] || CRYPTO_CHAINS.polygon;
  if (cryptoAddress) {
    try {
      onchainBalance = await readUsdcBalance(chain, cryptoAddress);
    } catch {}
  }
  const cryptoEvm = {
    id: 'crypto_evm',
    name: `EVM Address (${chain.label})`,
    category: 'onchain_crypto',
    account_type: cryptoAddress ? 'owner_configured_address' : 'unconfigured',
    currency: 'USDC',
    receiving_endpoint: {
      address: cryptoAddress,
      network: cryptoNetwork,
      chain_id: chain.id,
      token_contract: chain.usdc
    },
    status: !cryptoAddress ? 'needs_provider_setup' : (onchainBalance?.ok ? 'needs_user_consent' : 'error'),
    status_reason: !cryptoAddress
      ? 'Crypto receiving address is not configured.'
      : (onchainBalance?.ok
        ? `Public RPC read USDC balance on ${chain.label}; address ownership and payment receipt are not verified by this check.`
        : `Failed to verify the configured address via ${chain.label} RPC.`),
    can_receive: Boolean(cryptoAddress),
    can_read_balance: Boolean(onchainBalance?.ok),
    can_payout: false,
    requires_business: false,
    verified_balance: onchainBalance?.ok ? {
      amount: onchainBalance.usdc,
      currency: 'USDC',
      as_of: new Date().toISOString(),
      verified_by: `${chain.label} USDC contract query`
    } : null,
    last_sync_at: onchainBalance?.ok ? onchainBalance.fetched_at : null,
    next_action: cryptoAddress
      ? 'Verify address ownership with a wallet signature before accepting customer payments.'
      : 'Connect your own EVM wallet or configure a receiving address.'
  };

  // 5. SEPA Instant & Bank QR
  const sepaInstant = {
    id: 'sepa_instant',
    name: 'SEPA Instant & EPC QR',
    category: 'bank_transfer',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      iban: iban ? `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}` : null,
      bic,
      recipient_name: accountName
    },
    status: iban ? 'needs_user_consent' : 'needs_provider_setup',
    status_reason: iban
      ? 'IBAN format and checksum are valid. Trinity has not verified account ownership or payment receipt.'
      : 'IBAN is not configured.',
    can_receive: Boolean(iban && accountName),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: iban && accountName
      ? 'Verify IBAN and recipient name before sending a payment request.'
      : 'Configure IBAN and recipient name.'
  };

  // 6. Viber Pay & Wallet
  const viberPay = {
    id: 'viber_pay',
    name: 'Viber Pay & Viber Wallet',
    category: 'mobile_wallet',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      phone: viberPhone ? maskIdentifier(viberPhone) : null,
      service: 'Viber Pay (Rakuten Viber)'
    },
    status: viberPhone ? 'needs_user_consent' : 'needs_provider_setup',
    status_reason: viberPhone
      ? 'Viber Pay phone number is configured. Trinity has not verified balance; transfers are executed in the Viber app.'
      : 'Viber Pay phone number is not configured.',
    can_receive: Boolean(viberPhone),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: viberPhone ? 'Ready to receive payments via Viber Pay.' : 'Configure Viber Pay phone number.'
  };

  // 7. Paysafe (Paysafecard / myPaysafe & Skrill)
  const paysafe = {
    id: 'paysafe',
    name: 'Paysafe (Paysafecard / myPaysafe)',
    category: 'digital_wallet_voucher',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      account: paysafeAccount ? maskIdentifier(paysafeAccount) : null,
      service: 'myPaysafe / Paysafecard'
    },
    status: paysafeAccount ? 'needs_user_consent' : 'needs_provider_setup',
    status_reason: paysafeAccount
      ? 'Paysafe / myPaysafe account is configured. 16-digit PIN vouchers require verification at settlement.'
      : 'Neither myPaysafe nor a Paysafe merchant account is configured.',
    can_receive: Boolean(paysafeAccount),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: paysafeAccount ? 'Ready to accept Paysafecard vouchers and myPaysafe payments.' : 'Configure myPaysafe identifier or Paysafe account.'
  };

  // 8. MetaTrader 5 (MT5 Trading Account via MetaApi Cloud or HTTPS Bridge)
  const mt5Cfg = await getMt5Config(env, ownerId).catch(() => ({ configured: false, connected: false, has_token: false }));
  const mt5Account = mt5Cfg?.snapshot?.account || null;
  const mt5Verified = Boolean(mt5Cfg?.configured && mt5Cfg?.has_token && mt5Cfg?.snapshot?.verified === true && mt5Account);
  const metatrader5 = {
    id: 'metatrader5',
    name: 'MetaTrader 5 (MT5 Trading Account)',
    category: 'trading_platform',
    account_type: mt5Cfg?.account_type || 'demo',
    currency: mt5Account?.currency || mt5Cfg?.currency || 'EUR',
    receiving_endpoint: {
      mode: mt5Cfg?.mode || 'metaapi',
      broker: mt5Account?.broker || mt5Cfg?.broker || null,
      server: mt5Account?.server || mt5Cfg?.server || null,
      login: mt5Cfg?.login_masked || null,
      account_id: mt5Cfg?.account_id_masked || null
    },
    status: !mt5Cfg?.configured
      ? 'needs_provider_setup'
      : (!mt5Cfg?.has_token ? 'needs_provider_setup' : (mt5Verified ? 'live_verified' : 'needs_user_consent')),
    status_reason: !mt5Cfg?.configured
      ? 'MetaTrader 5 účet zatiaľ nie je nakonfigurovaný (zadaj MetaApi Account ID alebo HTTPS MT5 Bridge URL).'
      : (!mt5Cfg?.has_token
        ? 'MT5 profil je uložený, ale chýba šifrovaný MT5 API token (Secret Vault: metatrader5 alebo MT5_API_TOKEN).'
        : (mt5Verified
          ? `Overené pripojenie na MT5 (${mt5Cfg.snapshot.source}) · Balance: ${mt5Account.balance} ${mt5Account.currency}, Equity: ${mt5Account.equity} ${mt5Account.currency}.`
          : 'MT5 je nakonfigurovaný a má token. Spusti synchronizáciu pre načítanie overeného zostatku a pozícií.')),
    can_receive: false,
    can_read_balance: Boolean(mt5Cfg?.configured && mt5Cfg?.has_token),
    can_payout: false,
    can_trade: Boolean(mt5Cfg?.allow_trade_execution),
    requires_business: false,
    verified_balance: mt5Verified ? {
      amount: mt5Account.balance,
      equity: mt5Account.equity,
      free_margin: mt5Account.free_margin,
      currency: mt5Account.currency,
      as_of: mt5Cfg.last_verified_at,
      verified_by: mt5Cfg.snapshot.source
    } : null,
    last_sync_at: mt5Cfg?.last_verified_at || null,
    next_action: !mt5Cfg?.configured
      ? 'Nakonfiguruj MetaTrader 5 v záložke MT5 v peňaženke.'
      : (!mt5Cfg?.has_token ? 'Pridaj MT5 API token do Trezora tajomstiev.' : 'Spusti MT5 sync pre obnovenie zostatku a otvorených pozícií.')
  };

  return {
    owner_id: ownerId,
    mode: 'sovereign_multiwallet',
    updated_at: new Date().toISOString(),
    truth_policy: 'All connector statuses and balances are strictly verified. Cross-currency totals without an evidenced FX rate are forbidden. Zero is never substituted for an unknown balance.',
    connectors: [
      revolutPersonal,
      paypal,
      telegram,
      cryptoEvm,
      sepaInstant,
      viberPay,
      paysafe,
      metatrader5
    ]
  };
}

/**
 * Synchronize a specific connector
 */
export async function syncConnector(env, ownerId = 'admin', connectorId) {
  if (connectorId === 'metatrader5' || connectorId === 'mt5') {
    const syncRes = await fetchMt5AccountSnapshot(env, ownerId);
    return {
      connector_id: 'metatrader5',
      ok: syncRes.ok,
      status: syncRes.status,
      status_reason: syncRes.ok
        ? `MT5 synchronizované (${syncRes.snapshot.source}).`
        : syncRes.error,
      verified_balance: syncRes.ok ? {
        amount: syncRes.snapshot.account.balance,
        equity: syncRes.snapshot.account.equity,
        free_margin: syncRes.snapshot.account.free_margin,
        currency: syncRes.snapshot.account.currency,
        as_of: syncRes.synced_at,
        verified_by: syncRes.snapshot.source
      } : null,
      snapshot: syncRes.snapshot || null,
      synced_at: syncRes.synced_at || new Date().toISOString()
    };
  }
  const registry = await getConnectorsRegistry(env, ownerId);
  const connector = registry.connectors.find(c => c.id === connectorId);
  if (!connector) throw new HttpError(404, `Connector '${connectorId}' not found (Konektor '${connectorId}' neexistuje).`);

  return {
    connector_id: connectorId,
    status: connector.status,
    status_reason: connector.status_reason,
    verified_balance: connector.verified_balance,
    synced_at: new Date().toISOString()
  };
}
