import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import GhostCrypto from '../public/ghost-crypto.js';
import { handleGhostVaultApi, ensureGhostVaultTables, computePresenceStatus } from '../src/ghost-vault.js';

describe('Trinity Ghost Vault & E2EE Sovereign Whisper', () => {

  // ── 1. Klientská kryptografia (Web Crypto API) ──
  test('GhostCrypto: Alice a Bob si vymenia kľúče a úspešne dešifrujú správu', async () => {
    // Alice a Bob si vygenerujú vlastné identity
    const alice = await GhostCrypto.generateIdentity();
    const bob = await GhostCrypto.generateIdentity();

    assert.ok(alice.publicKey);
    assert.ok(alice.privateKey);
    assert.ok(alice.pubJwk.x && alice.pubJwk.y);

    // Alice importuje Bobov verejný kľúč a odvodí zdieľaný kľúč
    const bobPubForAlice = await GhostCrypto.importPeerPublicKey(bob.pubJwk);
    const aliceSharedKey = await GhostCrypto.deriveSharedKey(alice.privateKey, bobPubForAlice);

    // Bob importuje Alicin verejný kľúč a odvodí zdieľaný kľúč
    const alicePubForBob = await GhostCrypto.importPeerPublicKey(alice.pubJwk);
    const bobSharedKey = await GhostCrypto.deriveSharedKey(bob.privateKey, alicePubForBob);

    // Alice zašifruje tajnú správu
    const secretMessage = 'Top secret: Táto správa sa po prečítaní navždy zničí.';
    const envelope = await GhostCrypto.encrypt(aliceSharedKey, secretMessage);

    assert.ok(envelope.ciphertext);
    assert.ok(envelope.iv);
    assert.notEqual(envelope.ciphertext, secretMessage);

    // Bob dešifruje správu pomocou svojho zdieľaného kľúča
    const decrypted = await GhostCrypto.decrypt(bobSharedKey, envelope.ciphertext, envelope.iv);
    assert.equal(decrypted, secretMessage);
  });

  test('GhostCrypto: Útočník Eve (tretia strana) nedokáže správu dešifrovať', async () => {
    const alice = await GhostCrypto.generateIdentity();
    const bob = await GhostCrypto.generateIdentity();
    const eve = await GhostCrypto.generateIdentity();

    const bobPubForAlice = await GhostCrypto.importPeerPublicKey(bob.pubJwk);
    const aliceSharedKey = await GhostCrypto.deriveSharedKey(alice.privateKey, bobPubForAlice);

    const secret = 'Citlivé finančné a heslom chránené informácie';
    const envelope = await GhostCrypto.encrypt(aliceSharedKey, secret);

    // Eve sa pokúsi odvodiť kľúč s Aliciným verejným kľúčom (nemá však Bobov privátny kľúč)
    const alicePubForEve = await GhostCrypto.importPeerPublicKey(alice.pubJwk);
    const eveSharedKey = await GhostCrypto.deriveSharedKey(eve.privateKey, alicePubForEve);

    // Dešifrovanie musí zlyhať (auth tag mismatch v AES-GCM)
    await assert.rejects(async () => {
      await GhostCrypto.decrypt(eveSharedKey, envelope.ciphertext, envelope.iv);
    });
  });

  test('GhostCrypto: Bezpečnostné čísla a Emoji odtlačok sú zhodné pre obe strany (Signal štandard)', async () => {
    const alice = await GhostCrypto.generateIdentity();
    const bob = await GhostCrypto.generateIdentity();

    const aliceFingerprint = await GhostCrypto.computeSafetyFingerprint(alice.pubJwk, bob.pubJwk);
    const bobFingerprint = await GhostCrypto.computeSafetyFingerprint(bob.pubJwk, alice.pubJwk);

    // Bezpečnostné čísla (6 blokov po 5 číslic) sa musia zhodovať
    assert.equal(aliceFingerprint.safetyNumbers, bobFingerprint.safetyNumbers);
    assert.match(aliceFingerprint.safetyNumbers, /^\d{5} \d{5} \d{5} \d{5} \d{5} \d{5}$/);

    // Emoji odtlačok sa musí zhodovať
    assert.equal(aliceFingerprint.emoji, bobFingerprint.emoji);
    assert.equal(aliceFingerprint.rawHashHex, bobFingerprint.rawHashHex);
  });

  // ── 2. Server-Side Blind Relay & Sebadeštrukcia ──
  test('Server Blind Relay: odoslanie, prečítanie a okamžité zničenie (Burn-on-Read)', async () => {
    // In-memory mock DB pre testovanie Worker API
    const mockStorage = {
      sessions: new Map(),
      envelopes: new Map()
    };

    const mockDb = {
      prepare(sql) {
        let boundArgs = [];
        const stmt = {
          bind(...args) {
            boundArgs = args;
            return stmt;
          },
          async run() {
            if (sql.includes('INSERT INTO ops_ghost_envelopes')) {
              const [id, room_id, sender_id, recipient_id, ciphertext, iv, ephemeral_pubkey, burn_on_read, burn_timer_seconds, created_at, expires_at] = boundArgs;
              mockStorage.envelopes.set(id, {
                id, room_id, sender_id, recipient_id, ciphertext, iv, ephemeral_pubkey, burn_on_read, burn_timer_seconds, created_at, expires_at
              });
            } else if (sql.includes('INSERT OR REPLACE INTO ops_ghost_sessions')) {
              const [room_id, peer_id, public_key, nickname, created_at, expires_at] = boundArgs;
              mockStorage.sessions.set(`${room_id}:${peer_id}`, {
                room_id, peer_id, public_key, nickname, created_at, expires_at
              });
            } else if (sql.includes('DELETE FROM ops_ghost_envelopes WHERE id = ?')) {
              mockStorage.envelopes.delete(boundArgs[0]);
            } else if (sql.includes('DELETE FROM ops_ghost_envelopes WHERE room_id = ?')) {
              for (const [id, env] of mockStorage.envelopes.entries()) {
                if (env.room_id === boundArgs[0]) mockStorage.envelopes.delete(id);
              }
            } else if (sql.includes('DELETE FROM ops_ghost_sessions WHERE room_id = ?')) {
              for (const [key, sess] of mockStorage.sessions.entries()) {
                if (sess.room_id === boundArgs[0]) mockStorage.sessions.delete(key);
              }
            }
            return { success: true };
          },
          async first() {
            if (sql.includes('SELECT id, burn_on_read, burn_timer_seconds FROM ops_ghost_envelopes WHERE id = ?')) {
              return mockStorage.envelopes.get(boundArgs[0]) || null;
            }
            if (sql.includes('SELECT COUNT(*) as count FROM ops_ghost_envelopes')) {
              return { count: mockStorage.envelopes.size };
            }
            if (sql.includes('SELECT COUNT(*) as count FROM ops_ghost_sessions')) {
              return { count: mockStorage.sessions.size };
            }
            return null;
          },
          async all() {
            if (sql.includes('FROM ops_ghost_envelopes')) {
              return { results: Array.from(mockStorage.envelopes.values()) };
            }
            if (sql.includes('FROM ops_ghost_sessions')) {
              return { results: Array.from(mockStorage.sessions.values()) };
            }
            return { results: [] };
          }
        };
        return stmt;
      }
    };

    const mockEnv = { DB: mockDb };

    // 1. Overenie statusu
    const statusReq = new Request('https://auru.space/api/ghost/status');
    const statusRes = await handleGhostVaultApi(statusReq, mockEnv);
    assert.equal(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.ok, true);
    assert.equal(statusJson.security.zero_knowledge, true);
    assert.equal(statusJson.security.server_plaintext_access, false);

    // 2. Alice zaregistruje verejný kľúč v miestnosti
    const sessionReq = new Request('https://auru.space/api/ghost/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: 'secret-room-alpha',
        peer_id: 'alice',
        public_key: JSON.stringify({ crv: 'P-256', kty: 'EC', x: 'mock-x', y: 'mock-y' }),
        nickname: 'Alice'
      })
    });
    const sessionRes = await handleGhostVaultApi(sessionReq, mockEnv);
    assert.equal(sessionRes.status, 200);

    // 3. Alice odošle zašifrovanú obálku (Blind Relay)
    const sendReq = new Request('https://auru.space/api/ghost/envelope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: 'secret-room-alpha',
        sender_id: 'alice',
        recipient_id: 'bob',
        ciphertext: 'AQIDBAUG...',
        iv: '123456789012',
        ephemeral_pubkey: 'mock-ephemeral-key',
        burn_on_read: true,
        burn_timer_seconds: 15,
        ttl_seconds: 300
      })
    });
    const sendRes = await handleGhostVaultApi(sendReq, mockEnv);
    assert.equal(sendRes.status, 201);
    const sendJson = await sendRes.json();
    assert.ok(sendJson.envelope_id);
    assert.equal(sendJson.burn_on_read, true);

    // 4. Bob si načíta inbox
    const inboxReq = new Request('https://auru.space/api/ghost/inbox?room_id=secret-room-alpha');
    const inboxRes = await handleGhostVaultApi(inboxReq, mockEnv);
    assert.equal(inboxRes.status, 200);
    const inboxJson = await inboxRes.json();
    assert.equal(inboxJson.count, 1);
    assert.equal(inboxJson.envelopes[0].ciphertext, 'AQIDBAUG...');

    // 5. Bob potvrdí prečítanie (Burn-on-Read aktivácia)
    const readReq = new Request('https://auru.space/api/ghost/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envelope_id: sendJson.envelope_id })
    });
    const readRes = await handleGhostVaultApi(readReq, mockEnv);
    assert.equal(readRes.status, 200);
    const readJson = await readRes.json();
    assert.equal(readJson.destroyed, true);

    // 6. Overenie: Obálka je fyzicky a nenávratne vymazaná z databázy
    assert.equal(mockStorage.envelopes.has(sendJson.envelope_id), false);
    assert.equal(mockStorage.envelopes.size, 0);

    // 7. Panic Vaporize: Okamžité núdzové zničenie celej miestnosti
    mockStorage.envelopes.set('leftover_env', { room_id: 'secret-room-alpha' });
    const vaporizeReq = new Request('https://auru.space/api/ghost/vaporize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: 'secret-room-alpha' })
    });
    const vaporizeRes = await handleGhostVaultApi(vaporizeReq, mockEnv);
    assert.equal(vaporizeRes.status, 200);
    const vaporizeJson = await vaporizeRes.json();
    assert.equal(vaporizeJson.vaporized, true);
    assert.equal(mockStorage.envelopes.size, 0);
    assert.equal(mockStorage.sessions.size, 0);

    // 8. Vyhľadávanie v adresári kontaktov a registrovaných profilov
    const contactsReq = new Request('https://auru.space/api/ghost/contacts?q=basterix');
    const contactsRes = await handleGhostVaultApi(contactsReq, mockEnv);
    assert.equal(contactsRes.status, 200);
    const contactsJson = await contactsRes.json();
    assert.ok(contactsJson.ok);
    assert.ok(contactsJson.contacts.some(c => c.peer_id === 'basterix'));

    // 9. Overenie generovania QR kódu pozvánky
    const qrReq = new Request('https://auru.space/api/ghost/invite-qr?data=https://auru.dev/#encrypted_shits?peer=alice');
    const qrRes = await handleGhostVaultApi(qrReq, mockEnv);
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
    const svgText = await qrRes.text();
    assert.ok(svgText.includes('<svg'));
    assert.ok(svgText.includes('role="img"'));

    // 10. Overenie dynamického Presence Heartbeatu a stavov online
    const hbReq = new Request('https://auru.space/api/ghost/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peer_id: 'alice',
        alias: 'Alice Test',
        avatar_color: '#3b82f6'
      })
    });
    const hbRes = await handleGhostVaultApi(hbReq, mockEnv);
    assert.equal(hbRes.status, 200);
    const hbJson = await hbRes.json();
    assert.equal(hbJson.ok, true);
    assert.equal(hbJson.peer_id, 'alice');
    assert.equal(hbJson.status, 'online');
    assert.ok(typeof hbJson.last_seen === 'number');

    // 11. Overenie funkcie computePresenceStatus
    const testNow = 1700000000000;
    assert.equal(computePresenceStatus(testNow - 30_000, testNow), 'online'); // 30s pred = online
    assert.equal(computePresenceStatus(testNow - 110_000, testNow), 'online'); // 110s pred = online
    assert.equal(computePresenceStatus(testNow - 300_000, testNow), 'away'); // 5m pred = away
    assert.equal(computePresenceStatus(testNow - 890_000, testNow), 'away'); // 14.8m pred = away
    assert.equal(computePresenceStatus(testNow - 1200_000, testNow), 'offline'); // 20m pred = offline
    assert.equal(computePresenceStatus(0, testNow), 'offline'); // 0 = offline
    assert.equal(computePresenceStatus(null, testNow), 'offline'); // null = offline
  });
});
