/**
 * ════════════════════════════════════════════════════════════════════════════════
 * TRINITY GHOST CRYPTO · CLIENT-SIDE ZERO-KNOWLEDGE E2EE ENGINE
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Všetka kryptografia prebieha výhradne v prehliadači používateľa (Web Crypto API).
 * Súkromné kľúče NIKDY neopustia zariadenie.
 * 
 * Kľúčové vlastnosti:
 * - ECDH (NIST P-256) pre výmenu kľúčov medzi účastníkmi
 * - 256-bit AES-GCM pre šifrovanie správ s 96-bitovým náhodným IV
 * - Bezpečnostné čísla (Safety Numbers) na detekciu MITM (ako Signal)
 * - Anti-forenzné prepisovanie pamäte (In-memory wiping / shredding)
 */

const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) 
  || (typeof window !== 'undefined' && window.crypto?.subtle)
  || null;

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return (typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64'));
}

function base64ToBuffer(b64) {
  const binary = (typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'));
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const GhostCrypto = {
  /**
   * Vygeneruje nový lokálny efemérny pár kľúčov ECDH P-256.
   */
  async generateIdentity() {
    if (!subtle) throw new Error('Web Crypto API nie je dostupné.');
    const keyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const pubJwk = await subtle.exportKey('jwk', keyPair.publicKey);
    const pubRaw = await subtle.exportKey('raw', keyPair.publicKey);
    const pubBase64 = bufferToBase64(pubRaw);

    return {
      keyPair,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      pubJwk,
      pubBase64
    };
  },

  /**
   * Importuje verejný kľúč partnera (buď JWK objekt/string alebo Base64 raw reťazec).
   */
  async importPeerPublicKey(keyData) {
    if (!subtle) throw new Error('Web Crypto API nie je dostupné.');
    let parsed = keyData;
    if (typeof keyData === 'string') {
      try {
        parsed = JSON.parse(keyData);
      } catch {
        // Pokus o raw base64 import
        const rawBuffer = base64ToBuffer(keyData);
        return await subtle.importKey(
          'raw',
          rawBuffer,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          []
        );
      }
    }

    return await subtle.importKey(
      'jwk',
      parsed,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
  },

  /**
   * Odvodí symetrický 256-bitový AES-GCM kľúč pomocou ECDH výmeny kľúčov.
   * Tento kľúč je neextrahovateľný (extractable: false) pre maximálnu bezpečnosť pamäte.
   */
  async deriveSharedKey(myPrivateKey, peerPublicKey) {
    if (!subtle) throw new Error('Web Crypto API nie je dostupné.');
    return await subtle.deriveKey(
      { name: 'ECDH', public: peerPublicKey },
      myPrivateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Zašifruje ľubovoľný reťazec alebo objekt pomocou AES-256-GCM.
   * Vracia ciphertext a IV zakódované v Base64.
   */
  async encrypt(sharedKey, plaintext) {
    if (!subtle) throw new Error('Web Crypto API nie je dostupné.');
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const textToEncrypt = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
    const encoded = new TextEncoder().encode(textToEncrypt);

    const cipherBuffer = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    );

    return {
      ciphertext: bufferToBase64(cipherBuffer),
      iv: bufferToBase64(iv)
    };
  },

  /**
   * Dešifruje AES-256-GCM obálku.
   * Vracia dešifrovaný text.
   */
  async decrypt(sharedKey, ciphertextBase64, ivBase64) {
    if (!subtle) throw new Error('Web Crypto API nie je dostupné.');
    const ivBuffer = base64ToBuffer(ivBase64);
    const cipherBuffer = base64ToBuffer(ciphertextBase64);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      sharedKey,
      cipherBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  },

  /**
   * Vypočíta bezpečnostné čísla (Safety Numbers) a emoji odtlačok pre overenie neprítomnosti MITM útočníka.
   * Rovnako ako v Signale: SHA-256 zo zotriedených verejných kľúčov oboch strán.
   */
  async computeSafetyFingerprint(myPubJwk, peerPubJwk) {
    if (!subtle) throw new Error('Web Crypto API nie je dostupné.');
    const keyA = `${myPubJwk.x}:${myPubJwk.y}`;
    const keyB = `${peerPubJwk.x}:${peerPubJwk.y}`;
    const combined = [keyA, keyB].sort().join('|');

    const hashBuffer = await subtle.digest('SHA-256', new TextEncoder().encode(combined));
    const hashBytes = new Uint8Array(hashBuffer);

    // 6 blokov po 5 číslic
    const digits = [];
    for (let i = 0; i < 6; i++) {
      const val = ((hashBytes[i * 4] << 24) | (hashBytes[i * 4 + 1] << 16) | (hashBytes[i * 4 + 2] << 8) | hashBytes[i * 4 + 3]) >>> 0;
      const chunk = String(val % 100000).padStart(5, '0');
      digits.push(chunk);
    }
    const safetyNumbers = digits.join(' ');

    // Emoji odtlačok (4 emoji z palety 32 ikon)
    const emojiPalette = ['🛡️', '⚡', '🔒', '💎', '🔥', '🛰️', '🪐', '⚓', '🔑', '🚀', '🔮', '🌊', '🌋', '🧭', '🧬', '⚛️', '🦅', '🐺', '🦁', '🐉', '🍀', '🌟', '❄️', '🎯', '👁️', '🎲', '🪙', '🏆', '🎩', '🎻', '🎷', '🎸'];
    const emoji = [
      emojiPalette[hashBytes[28] % emojiPalette.length],
      emojiPalette[hashBytes[29] % emojiPalette.length],
      emojiPalette[hashBytes[30] % emojiPalette.length],
      emojiPalette[hashBytes[31] % emojiPalette.length]
    ].join(' ');

    return {
      safetyNumbers,
      emoji,
      rawHashHex: Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    };
  },

  /**
   * Bezpečné zničenie (shredding) citlivých objektov a reťazcov v pamäti.
   */
  shred(target) {
    if (!target) return;
    if (target instanceof Uint8Array) {
      target.fill(0);
    } else if (typeof target === 'object') {
      for (const k of Object.keys(target)) {
        try {
          if (target[k] instanceof Uint8Array) target[k].fill(0);
          target[k] = null;
        } catch {}
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.GhostCrypto = GhostCrypto;
}

export default GhostCrypto;
