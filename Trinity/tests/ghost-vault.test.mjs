import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import GhostCrypto from '../public/ghost-crypto.js';
import { DatabaseSync } from 'node:sqlite';
import { handleGhostVaultApi, privatePeerId } from '../src/ghost-vault.js';
import { hash } from '../src/security.js';

describe('Trinity private messenger', () => {

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

  test('GhostCrypto: Bezpečnostné čísla a Emoji odtlačok sú zhodné pre obe strany', async () => {
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

});

test('Private relay isolates a verified pair and applies read receipts only for the recipient', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE ops_sessions (token_hash TEXT,expires_at INTEGER,email TEXT);");
  const env = {
    DB: {
      prepare(sql) {
        const query = sqlite.prepare(sql);
        const prepared = params => ({
          first: async () => query.get(...params),
          all: async () => ({results:query.all(...params)}),
          run: async () => query.run(...params),
        });
        return {...prepared([]),bind:(...params)=>prepared(params)};
      },
    },
  };
  async function actor(email, digit) {
    const token = digit.repeat(64);
    sqlite.prepare('INSERT INTO ops_sessions VALUES (?,?,?)').run(await hash(token),Date.now()+60000,email);
    return {token,id:await privatePeerId(email),identity:await GhostCrypto.generateIdentity()};
  }
  const alice = await actor('alex@example.com','a');
  const bob = await actor('alex@example.org','b');
  const eve = await actor('eve@example.org','e');
  assert.notEqual(alice.id,bob.id);
  const call = (path,actor,data) => handleGhostVaultApi(new Request('https://auru.dev/api/ghost/' + path,{
    method:data===undefined?'GET':'POST',
    headers:{'Content-Type':'application/json',...(actor?{Cookie:'trinity_session='+actor.token}:{})},
    body:data===undefined?undefined:JSON.stringify(data),
  }),env);
  const publicKey = identity => {
    const {kty,crv,x,y} = identity.pubJwk;
    return {kty,crv,x,y};
  };
  const aKey = publicKey(alice.identity);
  const bKey = publicKey(bob.identity);
  assert.equal((await call('contacts')).status,401);
  assert.deepEqual(await (await call('me',alice)).json(),{peer_id:alice.id});
  assert.deepEqual(await (await call('contacts',alice)).json(),{contacts:[]});
  assert.equal((await call('profile',alice,{alias:'Alice',public_key:aKey})).status,200);
  assert.equal((await call('profile',bob,{alias:'Bob',public_key:bKey})).status,200);
  const listed = await (await call('contacts',alice)).json();
  assert.deepEqual(listed.contacts.map(contact=>contact.alias),['Bob']);
  assert.equal('email' in listed.contacts[0],false);
  assert.equal((await call('profile',bob,{alias:'Bob',public_key:aKey})).status,409);
  const shared = await GhostCrypto.deriveSharedKey(alice.identity.privateKey,await GhostCrypto.importPeerPublicKey(bKey));
  const content = 'Dohodnuté';
  const payload = {...await GhostCrypto.encrypt(shared,content),recipient_id:bob.id,recipient_key:bKey,sender_key:aKey,burn_on_read:true,ttl_seconds:60};
  assert.equal((await call('envelope',alice,{...payload,sender_id:bob.id})).status,400);
  assert.equal((await call('envelope',eve,payload)).status,409);
  const send = await call('envelope',alice,payload);
  assert.equal(send.status,201);
  const {id} = await send.json();
  await call('read',eve,{envelope_id:id});
  await call('read',alice,{envelope_id:id});
  assert.deepEqual(await (await call('inbox?peer='+alice.id,eve)).json(),{envelopes:[]});
  const {envelopes} = await (await call('inbox?peer='+alice.id,bob)).json();
  assert.equal(envelopes.length,1);
  assert.equal(envelopes[0].id,id);
  const peerShared = await GhostCrypto.deriveSharedKey(bob.identity.privateKey,await GhostCrypto.importPeerPublicKey(aKey));
  assert.equal(await GhostCrypto.decrypt(peerShared,envelopes[0].ciphertext,envelopes[0].iv),content);
  assert.equal((await call('read',bob,{envelope_id:id})).status,200);
  assert.deepEqual(await (await call('inbox?peer='+bob.id,alice)).json(),{envelopes:[]});
  const replacement = publicKey(eve.identity);
  assert.equal((await call('profile',bob,{alias:'Bob',public_key:replacement,replace:true})).status,200);
  assert.equal((await call('envelope',alice,payload)).status,409);
});
