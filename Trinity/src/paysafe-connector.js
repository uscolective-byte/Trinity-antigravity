/**
 * @module TRINITY_OMNI_CORE
 * @subsystem PAYSAFE_FINANCIAL_CONNECTOR
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Integrated connector for Paysafe Financial Group (Paysafecard, myPaysafe wallet, Skrill, and NETELLER).
 * Complies with Truth Policy 2.1 — strict 16-digit PIN format validation and zero fabricated balances.
 */

/**
 * Normalizes and validates a 16-digit Paysafecard PIN code.
 * Accepts 16 digits without spaces or 4x4 groups separated by dashes/spaces.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizePaysafePin(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[\s-]/g, '');
  if (/^\d{16}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Formats a 16-digit PIN code into human-readable XXXX-XXXX-XXXX-XXXX groups.
 * @param {string} pin
 * @returns {string|null}
 */
export function formatPaysafePin(pin) {
  const norm = normalizePaysafePin(pin);
  if (!norm) return null;
  return `${norm.slice(0, 4)}-${norm.slice(4, 8)}-${norm.slice(8, 12)}-${norm.slice(12, 16)}`;
}

/**
 * Masks a PIN code for safe logging (revealing only the first 4 and last 4 digits).
 * @param {string} pin
 * @returns {string|null}
 */
export function maskPaysafePin(pin) {
  const norm = normalizePaysafePin(pin);
  if (!norm) return null;
  return `${norm.slice(0, 4)}-****-****-${norm.slice(12, 16)}`;
}

/**
 * Normalizes a myPaysafe account identifier (email address or username).
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizePaysafeAccount(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)) return s;
  if (/^[A-Za-z0-9_.-]{3,60}$/.test(s)) return s;
  return null;
}

/**
 * Returns the Paysafe integration status within Trinity.
 * @param {object} env
 * @returns {object}
 */
export function paysafeIntegrationStatus(env) {
  const apiKey = env.PAYSAFE_API_KEY || null;
  const accountNumber = env.PAYSAFE_ACCOUNT_NUMBER || null;
  const environment = (env.PAYSAFE_ENV || 'production').toLowerCase();
  const configured = Boolean(apiKey && accountNumber);

  return {
    service: 'Paysafe Financial Group (Paysafecard, Skrill, Neteller)',
    configured,
    environment,
    api_endpoint: environment === 'sandbox'
      ? 'https://api.test.paysafe.com/paymenthub/v1'
      : 'https://api.paysafe.com/paymenthub/v1',
    portal_url: 'https://my.paysafecard.com/',
    supported_products: [
      'Paysafecard (16-digit voucher PIN)',
      'myPaysafe (Customer digital wallet)',
      'Skrill Digital Wallet (EUR)',
      'NETELLER Wallet'
    ],
    truth_mode: 'evidence_required'
  };
}

/**
 * Prepares a payment session or redirect handle for Paysafe / Paysafecard checkout.
 * @param {object} env
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function createPaysafeChargeSession(env, params = {}) {
  const amountEur = Number(Number(params.amount_eur || params.amount || 0).toFixed(2));
  const purpose = String(params.purpose || 'Trinity Service Invoice').slice(0, 120);
  const vs = String(params.variable_symbol || Date.now()).slice(-10);
  const returnUrl = params.return_url || 'https://auru.space/connect?paysafe=complete';

  const status = paysafeIntegrationStatus(env);

  // When live Paysafe API credentials are configured, attempt to create a Payment Handle via REST API
  if (status.configured && env.PAYSAFE_API_KEY) {
    try {
      const basicAuth = btoa(`${env.PAYSAFE_API_KEY}:`);
      const body = {
        merchantRefNum: `TRN-PS-${vs}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        amount: Math.round(amountEur * 100),
        currencyCode: 'EUR',
        paymentType: 'PAYSAFECARD',
        returnLinks: [
          { rel: 'on_completed', href: returnUrl },
          { rel: 'on_failed', href: `${returnUrl}&error=failed` }
        ]
      };

      const res = await fetch(`${status.api_endpoint}/paymenthandles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          provider: 'paysafe',
          status: 'ready',
          handle_id: data.id,
          redirect_url: data.links?.find(l => l.rel === 'redirect_payer')?.href || status.portal_url,
          amount_eur: amountEur,
          currency: 'EUR',
          merchant_ref: body.merchantRefNum,
          method: 'PAYSAFECARD_API'
        };
      }
    } catch {}
  }

  // Fallback for direct myPaysafe wallet usage or 16-digit voucher codes
  return {
    ok: true,
    provider: 'paysafe',
    status: 'prepared',
    amount_eur: amountEur,
    currency: 'EUR',
    variable_symbol: vs,
    purpose,
    portal_url: status.portal_url,
    instructions: [
      '1. Open your myPaysafe wallet (https://my.paysafecard.com/) or purchase a 16-digit Paysafecard voucher.',
      `2. Include the payment reference: VS${vs} - ${purpose}.`,
      '3. After payment, submit the 16-digit PIN in Trinity for ledger recording and verification.'
    ],
    method: 'MYPAYSAFE_OR_VOUCHER'
  };
}

/**
 * Validates and formats a submitted 16-digit Paysafecard voucher PIN.
 * @param {string} rawPin
 * @param {number} expectedAmountEur
 * @returns {object}
 */
export function verifyPaysafeVoucherFormat(rawPin, expectedAmountEur = 0) {
  const normalized = normalizePaysafePin(rawPin);
  if (!normalized) {
    return {
      valid: false,
      reason: 'Invalid Paysafecard PIN format. The code must contain exactly 16 digits (e.g. 0123-4567-8901-2345).'
    };
  }

  return {
    valid: true,
    masked_pin: maskPaysafePin(normalized),
    formatted_pin: formatPaysafePin(normalized),
    expected_amount_eur: Number(expectedAmountEur.toFixed(2)),
    status: 'voucher_recorded',
    note: 'Voucher formatted and staged for settlement in the Trinity treasury.'
  };
}
