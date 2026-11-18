/**
 * TAP HMAC signer. Authenticates integrity only, not the truth of the payload.
 * No hard-coded signing key or unsigned fallback is permitted.
 */
export class TapSovereignSigner {
  static async importKey(privateKey, usages) {
    if (typeof privateKey !== 'string' || privateKey.length === 0) {
      throw new Error('TAP_SIGNING_KEY_REQUIRED');
    }
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(privateKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      usages
    );
  }

  static async signPayload(privateKey, data) {
    const key = await this.importKey(privateKey, ['sign']);
    const signature = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(String(data))
    );
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static async verifyPayload(privateKey, data, signature) {
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const key = await this.importKey(privateKey, ['verify']);
    const bytes = Uint8Array.from(signature.match(/../g), hex => parseInt(hex, 16));
    return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(String(data)));
  }
}
