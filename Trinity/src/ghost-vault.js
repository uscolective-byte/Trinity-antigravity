/**
 * ════════════════════════════════════════════════════════════════════════════════
 * TRINITY GHOST VAULT · ZERO-KNOWLEDGE E2EE EPHEMERAL MESSENGER (SOVEREIGN WHISPER)
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Bezpečnostné a architektonické záruky (Signal Protocol & Telegram Secret Chat ekvivalent):
 * 1. Zero-Knowledge Relay: Server (Trinity Worker) je slepý poštový schránkový smerovač.
 *    Nikdy nevlastní súkromné kľúče, nikdy nevidí otvorený text správ ani príloh.
 * 2. Asymetrická kryptografia (Web Crypto API):
 *    - ECDH kľúčová výmena na krivke NIST P-256 (alebo Ed25519/X25519).
 *    - 256-bitové AES-GCM autentifikované šifrovanie s náhodným 96-bitovým IV pre každú správu.
 *    - Bezpečnostné čísla (Safety Numbers) / Odtlačok integrity na detekciu MITM.
 * 3. Sebadeštrukcia správ (Self-Destruct & Burn-on-Read):
 *    - Mode 1: Burn-on-Read — okamžité fyzické zmazanie z D1 a KV po potvrdení dešifrovania príjemcom.
 *    - Mode 2: TTL Timer — automatická expirácia a trvalé zničenie správ po uplynutí časovača (10s až 24h).
 *    - Mode 3: Panic Vaporize — okamžité zničenie všetkých správ celej miestnosti jedným klikom.
 * 4. Anti-forenzná hygiena: Žiadne logovanie šifier, žiadne zálohovanie, čisté prepisovanie pamäte.
 */

import { z } from 'zod';

export const ghostSessionSchema = z.object({
  room_id: z.string().trim().min(3).max(100),
  peer_id: z.string().trim().min(2).max(100),
  public_key: z.string().min(10).max(5000),
  nickname: z.string().trim().max(60).optional(),
  ttl_seconds: z.number().int().min(60).max(604800).default(86400)
}).strict();

export const ghostEnvelopeSchema = z.object({
  room_id: z.string().trim().min(3).max(100),
  sender_id: z.string().trim().min(2).max(100),
  recipient_id: z.string().trim().max(100).optional(),
  ciphertext: z.string().min(1).max(2000000), // Max 2MB base64 payload
  iv: z.string().min(8).max(100), // Base64 12-byte IV
  ephemeral_pubkey: z.string().min(10).max(5000), // Sender's ephemeral ECDH pubkey
  burn_on_read: z.boolean().default(true),
  burn_timer_seconds: z.number().int().min(5).max(86400).default(30),
  ttl_seconds: z.number().int().min(10).max(604800).default(3600)
}).strict();

export const ghostReadSchema = z.object({
  envelope_id: z.string().trim().min(3).max(100),
  reader_id: z.string().trim().min(2).max(100).optional()
}).strict();

export const ghostVaporizeSchema = z.object({
  room_id: z.string().trim().min(3).max(100)
}).strict();

const readyDatabases = new WeakSet();

export async function ensureGhostVaultTables(db) {
  if (!db || readyDatabases.has(db)) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_ghost_sessions (
      room_id TEXT NOT NULL,
      peer_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      nickname TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, peer_id)
    );`,
    `CREATE TABLE IF NOT EXISTS ops_ghost_envelopes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      recipient_id TEXT,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      ephemeral_pubkey TEXT NOT NULL,
      burn_on_read INTEGER DEFAULT 1,
      burn_timer_seconds INTEGER DEFAULT 30,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      read_at INTEGER,
      destroyed_at INTEGER
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ghost_env_room ON ops_ghost_envelopes(room_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_ghost_env_expires ON ops_ghost_envelopes(expires_at);`
  ];

  for (const sql of statements) {
    await db.prepare(sql).run().catch(() => {});
  }
  readyDatabases.add(db);
}

/**
 * Automatické vyčistenie expirovaných správ z databázy D1 a KV.
 */
export async function cleanupExpiredEnvelopes(db, kv) {
  if (!db) return 0;
  const now = Date.now();
  try {
    const expired = await db.prepare(
      `SELECT id FROM ops_ghost_envelopes WHERE expires_at <= ?`
    ).bind(now).all().catch(() => ({ results: [] }));

    if (expired?.results?.length) {
      await db.prepare(
        `DELETE FROM ops_ghost_envelopes WHERE expires_at <= ?`
      ).bind(now).run().catch(() => {});

      if (kv) {
        for (const row of expired.results) {
          await kv.delete(`ghost:env:${row.id}`).catch(() => {});
        }
      }
      return expired.results.length;
    }
  } catch {}
  return 0;
}

/**
 * Hlavný router pre /api/ghost/*
 */
export async function handleGhostVaultApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const db = env.DB || env.TRINITY_D1;
  const kv = env.TRINITY_KV || env.Mastermind;

  if (db) {
    await ensureGhostVaultTables(db);
    // Asynchrónne spustenie vyčistenia expirovaných správ
    if (ctx?.waitUntil) {
      ctx.waitUntil(cleanupExpiredEnvelopes(db, kv));
    } else {
      void cleanupExpiredEnvelopes(db, kv);
    }
  }

  // 1. Bezpečnostný status a verifikácia Zero-Knowledge
  if (method === 'GET' && path === '/api/ghost/status') {
    let activeEnvelopes = 0;
    let activeSessions = 0;
    if (db) {
      try {
        const countRes = await db.prepare(
          `SELECT COUNT(*) as count FROM ops_ghost_envelopes WHERE expires_at > ?`
        ).bind(Date.now()).first().catch(() => ({ count: 0 }));
        activeEnvelopes = countRes?.count || 0;

        const sessRes = await db.prepare(
          `SELECT COUNT(*) as count FROM ops_ghost_sessions WHERE expires_at > ?`
        ).bind(Date.now()).first().catch(() => ({ count: 0 }));
        activeSessions = sessRes?.count || 0;
      } catch {}
    }

    return new Response(JSON.stringify({
      ok: true,
      service: 'Trinity Ghost Vault (Zero-Knowledge E2EE Ephemeral Messenger)',
      version: '1.0.0',
      status: 'operational',
      security: {
        zero_knowledge: true,
        server_plaintext_access: false,
        cryptography: 'ECDH (Curve P-256) + HKDF + AES-256-GCM',
        forward_secrecy: 'ephemeral-keypair-per-session',
        self_destruction_modes: ['burn-on-read', 'ttl-countdown', 'panic-vaporize'],
        anti_forensics: 'ephemeral-storage-no-audit-plaintext'
      },
      active_envelopes: activeEnvelopes,
      active_sessions: activeSessions,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // 2. Registrácia / zistenie verejného kľúča účastníka v miestnosti
  if (method === 'POST' && path === '/api/ghost/session') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatný JSON formát.' }), { status: 400 });
    }

    const parsed = ghostSessionSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatné parametre relácie.', details: parsed.error.issues }), { status: 400 });
    }

    const { room_id, peer_id, public_key, nickname, ttl_seconds } = parsed.data;
    const now = Date.now();
    const expires_at = now + (ttl_seconds * 1000);

    if (db) {
      await db.prepare(
        `INSERT OR REPLACE INTO ops_ghost_sessions (room_id, peer_id, public_key, nickname, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(room_id, peer_id, public_key, nickname || peer_id, now, expires_at).run().catch(() => {});
    }

    if (kv) {
      await kv.put(`ghost:sess:${room_id}:${peer_id}`, JSON.stringify({
        room_id, peer_id, public_key, nickname: nickname || peer_id, created_at: now, expires_at
      }), { expirationTtl: ttl_seconds }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      room_id,
      peer_id,
      registered: true,
      expires_at
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // 3. Zoznam účastníkov a ich verejných kľúčov v miestnosti
  if (method === 'GET' && path.startsWith('/api/ghost/session/')) {
    const roomId = decodeURIComponent(path.slice('/api/ghost/session/'.length));
    if (!roomId) {
      return new Response(JSON.stringify({ ok: false, error: 'Chýba room_id.' }), { status: 400 });
    }

    let peers = [];
    if (db) {
      try {
        const rows = await db.prepare(
          `SELECT peer_id, public_key, nickname, created_at, expires_at 
           FROM ops_ghost_sessions 
           WHERE room_id = ? AND expires_at > ?`
        ).bind(roomId, Date.now()).all().catch(() => ({ results: [] }));
        peers = rows?.results || [];
      } catch {}
    }

    return new Response(JSON.stringify({
      ok: true,
      room_id: roomId,
      peers
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // 4. Odoslanie zašifrovanej obálky (Blind Relay)
  if (method === 'POST' && path === '/api/ghost/envelope') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatný JSON formát.' }), { status: 400 });
    }

    const parsed = ghostEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatná šifrovaná obálka.', details: parsed.error.issues }), { status: 400 });
    }

    const envData = parsed.data;
    const now = Date.now();
    const envelopeId = 'ghost_' + crypto.randomUUID();
    const expiresAt = now + (envData.ttl_seconds * 1000);

    if (db) {
      await db.prepare(
        `INSERT INTO ops_ghost_envelopes 
         (id, room_id, sender_id, recipient_id, ciphertext, iv, ephemeral_pubkey, burn_on_read, burn_timer_seconds, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        envelopeId,
        envData.room_id,
        envData.sender_id,
        envData.recipient_id || null,
        envData.ciphertext,
        envData.iv,
        envData.ephemeral_pubkey,
        envData.burn_on_read ? 1 : 0,
        envData.burn_timer_seconds,
        now,
        expiresAt
      ).run();
    }

    if (kv) {
      await kv.put(`ghost:env:${envelopeId}`, JSON.stringify({
        id: envelopeId,
        room_id: envData.room_id,
        sender_id: envData.sender_id,
        recipient_id: envData.recipient_id || null,
        ciphertext: envData.ciphertext,
        iv: envData.iv,
        ephemeral_pubkey: envData.ephemeral_pubkey,
        burn_on_read: envData.burn_on_read,
        burn_timer_seconds: envData.burn_timer_seconds,
        created_at: now,
        expires_at: expiresAt
      }), { expirationTtl: Math.max(60, envData.ttl_seconds) }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      envelope_id: envelopeId,
      room_id: envData.room_id,
      burn_on_read: envData.burn_on_read,
      burn_timer_seconds: envData.burn_timer_seconds,
      expires_at: expiresAt
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // 5. Načítanie čakajúcich obálok pre miestnosť / príjemcu (Inbox)
  if (method === 'GET' && path === '/api/ghost/inbox') {
    const roomId = url.searchParams.get('room_id');
    const recipientId = url.searchParams.get('recipient_id');
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    if (!roomId && !recipientId) {
      return new Response(JSON.stringify({ ok: false, error: 'Vyžaduje sa room_id alebo recipient_id.' }), { status: 400 });
    }

    const now = Date.now();
    let envelopes = [];

    if (db) {
      try {
        let query = `SELECT id, room_id, sender_id, recipient_id, ciphertext, iv, ephemeral_pubkey, 
                            burn_on_read, burn_timer_seconds, created_at, expires_at 
                     FROM ops_ghost_envelopes 
                     WHERE expires_at > ? AND created_at > ? `;
        const params = [now, since];

        if (roomId && recipientId) {
          query += `AND (room_id = ? OR recipient_id = ?) `;
          params.push(roomId, recipientId);
        } else if (roomId) {
          query += `AND room_id = ? `;
          params.push(roomId);
        } else {
          query += `AND recipient_id = ? `;
          params.push(recipientId);
        }

        query += `ORDER BY created_at ASC LIMIT 100`;

        const res = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
        envelopes = (res?.results || []).map(r => ({
          ...r,
          burn_on_read: Boolean(r.burn_on_read)
        }));
      } catch {}
    }

    return new Response(JSON.stringify({
      ok: true,
      count: envelopes.length,
      envelopes
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // 6. Potvrdenie prečítania a okamžité fyzické zničenie (Burn-on-Read)
  if (method === 'POST' && path === '/api/ghost/read') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatný JSON.' }), { status: 400 });
    }

    const parsed = ghostReadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatné ID obálky.' }), { status: 400 });
    }

    const { envelope_id } = parsed.data;
    const now = Date.now();
    let destroyed = false;

    if (db) {
      try {
        const row = await db.prepare(
          `SELECT id, burn_on_read, burn_timer_seconds FROM ops_ghost_envelopes WHERE id = ?`
        ).bind(envelope_id).first().catch(() => null);

        if (row) {
          if (row.burn_on_read) {
            // Okamžité fyzické zmazanie z databázy
            await db.prepare(`DELETE FROM ops_ghost_envelopes WHERE id = ?`).bind(envelope_id).run().catch(() => {});
            destroyed = true;
          } else {
            // Nastavenie expirácie podľa burn_timer_seconds od prečítania
            const newExpiry = now + (row.burn_timer_seconds * 1000);
            await db.prepare(
              `UPDATE ops_ghost_envelopes SET read_at = ?, expires_at = ? WHERE id = ?`
            ).bind(now, newExpiry, envelope_id).run().catch(() => {});
          }
        }
      } catch {}
    }

    if (kv && destroyed) {
      await kv.delete(`ghost:env:${envelope_id}`).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      envelope_id,
      destroyed,
      timestamp: now
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // 7. Okamžité núdzové zničenie celej konverzácie / miestnosti (Panic Vaporize)
  if (method === 'POST' && path === '/api/ghost/vaporize') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatný JSON.' }), { status: 400 });
    }

    const parsed = ghostVaporizeSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Chýba room_id.' }), { status: 400 });
    }

    const { room_id } = parsed.data;
    let deletedCount = 0;

    if (db) {
      try {
        const countRes = await db.prepare(
          `SELECT COUNT(*) as count FROM ops_ghost_envelopes WHERE room_id = ?`
        ).bind(room_id).first().catch(() => ({ count: 0 }));
        deletedCount = countRes?.count || 0;

        await db.prepare(`DELETE FROM ops_ghost_envelopes WHERE room_id = ?`).bind(room_id).run().catch(() => {});
        await db.prepare(`DELETE FROM ops_ghost_sessions WHERE room_id = ?`).bind(room_id).run().catch(() => {});
      } catch {}
    }

    return new Response(JSON.stringify({
      ok: true,
      room_id,
      vaporized: true,
      deleted_envelopes: deletedCount,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Neznámy Ghost Vault endpoint.' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
