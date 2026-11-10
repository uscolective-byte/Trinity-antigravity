/**
 * Trinity Omni-Core v11.3 - L4_SOVEREIGN_LEDGER
 * TAP Sovereign Signer (WebCrypto & Cloudflare Worker compatible)
 */

export class TapSovereignSigner {
  /**
   * Podpíše payload pomocou privátneho kľúča
   * @param {string|CryptoKey} privateKey
   * @param {string} data
   * @returns {Promise<string>} Hexadecimálny podpis
   */
  static async signPayload(privateKey, data) {
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(String(privateKey || 'SOVEREIGN_RING0_ROOT_KEY'));
    
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
      return Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback hash
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${privateKey}:${data}`));
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }

  /**
   * Overí podpis voči payloadu
   */
  static async verifyPayload(privateKey, data, signature) {
    const expected = await this.signPayload(privateKey, data);
    return expected.toLowerCase() === String(signature).toLowerCase();
  }
}
