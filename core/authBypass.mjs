import crypto from 'node:crypto';

/**
 * Legacy compatibility layer. There is deliberately no authentication bypass.
 * Administrative access is only possible with an explicitly configured key.
 */
export class TrinityAuthBypass {
  constructor({ masterKey = process.env.ADMIN_API_KEY } = {}) {
    this.masterKey = typeof masterKey === 'string' && masterKey.trim() ? masterKey : null;
    this.bypassActive = false;
  }

  verifyAuth(reqHeaders = {}) {
    if (!this.masterKey) {
      return { authorized: false, error: 'ADMIN_API_KEY is not configured.' };
    }
    const headers = reqHeaders instanceof Headers
      ? Object.fromEntries(reqHeaders.entries())
      : Object.fromEntries(Object.entries(reqHeaders || {}).map(([key, value]) => [key.toLowerCase(), value]));
    const authHeader = typeof headers.authorization === 'string' ? headers.authorization : '';
    const bearer = /^Bearer\s+(\S+)$/i.exec(authHeader);
    const apiKey = typeof headers['x-api-key'] === 'string' ? headers['x-api-key'] : bearer?.[1] || '';
    if (!apiKey) return { authorized: false, error: 'Missing API key.' };
    const received = Buffer.from(apiKey, 'utf8');
    const expected = Buffer.from(this.masterKey, 'utf8');
    const authorized = received.length === expected.length && crypto.timingSafeEqual(received, expected);
    return authorized
      ? { authorized: true, mode: 'ADMIN_KEY_MATCH' }
      : { authorized: false, error: 'Invalid API key.' };
  }

  /**
   * This is a local integrity hash, not a signed or independently verified
   * confirmation of external execution.
   */
  generateReceipt(agentName, payload, result) {
    const timestamp = new Date().toISOString();
    const raw = JSON.stringify({ agentName, timestamp, payload, result });
    return {
      receiptId: 'rcpt_' + crypto.randomUUID(),
      agent: agentName,
      timestamp,
      receiptHash: crypto.createHash('sha256').update(raw).digest('hex'),
      verified: false,
      verificationStatus: 'unverified',
      note: 'Integrity hash only; external execution not independently verified.'
    };
  }
}

export const authBypass = new TrinityAuthBypass();
