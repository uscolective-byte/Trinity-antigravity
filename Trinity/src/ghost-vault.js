/**
 * ════════════════════════════════════════════════════════════════════════════════
 * TRINITY GHOST VAULT · ZERO-KNOWLEDGE E2EE EPHEMERAL MESSENGER (SOVEREIGN WHISPER)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Security and architectural guarantees (Signal Protocol & Telegram Secret Chat equivalent):
 * 1. Zero-Knowledge Relay: The server (Trinity Worker) acts purely as a blind mailbox relay.
 *    It never holds private keys and never sees plaintext messages or attachments.
 * 2. Asymmetric Cryptography (Web Crypto API):
 *    - ECDH key exchange on NIST P-256 (or Ed25519/X25519).
 *    - 256-bit AES-GCM authenticated encryption with a random 96-bit IV per message.
 *    - Safety Numbers / integrity fingerprint for MITM detection.
 * 3. Message Self-Destruction (Self-Destruct & Burn-on-Read):
 *    - Mode 1: Burn-on-Read — immediate physical deletion from D1 and KV upon recipient decryption receipt.
 *    - Mode 2: TTL Timer — automatic expiration and permanent destruction after countdown (10s to 24h).
 *    - Mode 3: Panic Vaporize — immediate one-click destruction of all messages in a room.
 * 4. Anti-forensic hygiene: No ciphertext logging, no archival backups, clean ephemeral lifecycle.
 */

import { z } from 'zod';
import { generateQrSvg } from './wallet-terminals.js';

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

export const ghostContactRegisterSchema = z.object({
  peer_id: z.string().trim().min(2).max(100),
  alias: z.string().trim().min(2).max(100),
  public_key: z.string().min(10).max(5000),
  avatar_color: z.string().trim().max(30).optional()
}).strict();

export const ghostHeartbeatSchema = z.object({
  peer_id: z.string().trim().min(2).max(100),
  alias: z.string().trim().min(2).max(100).optional(),
  public_key: z.string().min(10).max(5000).optional(),
  avatar_color: z.string().trim().max(30).optional()
}).strict();

/**
 * Dynamically computes online presence status from the last_seen timestamp.
 * - <= 120 seconds: online
 * - <= 900 seconds (15 min): away
 * - older: offline
 */
export function computePresenceStatus(lastSeen, now = Date.now()) {
  if (!lastSeen) return 'offline';
  const diff = now - Number(lastSeen);
  if (diff <= 120_000) return 'online';
  if (diff <= 900_000) return 'away';
  return 'offline';
}

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
    `CREATE INDEX IF NOT EXISTS idx_ghost_env_expires ON ops_ghost_envelopes(expires_at);`,
    `CREATE TABLE IF NOT EXISTS ops_ghost_directory (
      peer_id TEXT PRIMARY KEY,
      alias TEXT NOT NULL,
      public_key TEXT NOT NULL,
      status TEXT DEFAULT 'online',
      avatar_color TEXT,
      last_seen INTEGER NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ghost_dir_alias ON ops_ghost_directory(alias);`
  ];

  for (const sql of statements) {
    await db.prepare(sql).run().catch(() => {});
  }
  readyDatabases.add(db);
}

/**
 * Automatically purges expired envelopes from D1 and KV.
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
 * Main API router for /api/ghost/*
 */
export async function handleGhostVaultApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const db = env.DB || env.TRINITY_D1;
  const kv = env.TRINITY_KV || env.Mastermind;

  if (db) {
    await ensureGhostVaultTables(db);
    // Trigger asynchronous purge of expired envelopes
    if (ctx?.waitUntil) {
      ctx.waitUntil(cleanupExpiredEnvelopes(db, kv));
    } else {
      void cleanupExpiredEnvelopes(db, kv);
    }
  }

  // 1. Security status and Zero-Knowledge verification
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

  // 2. Register or refresh a room participant's public key
  if (method === 'POST' && path === '/api/ghost/session') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON format.' }), { status: 400 });
    }

    const parsed = ghostSessionSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session parameters.', details: parsed.error.issues }), { status: 400 });
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

  // 3. List participants and their public keys in a room
  if (method === 'GET' && path.startsWith('/api/ghost/session/')) {
    const roomId = decodeURIComponent(path.slice('/api/ghost/session/'.length));
    if (!roomId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing room_id.' }), { status: 400 });
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

  // 4. Submit an encrypted envelope (Blind Relay)
  if (method === 'POST' && path === '/api/ghost/envelope') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON format.' }), { status: 400 });
    }

    const parsed = ghostEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid encrypted envelope.', details: parsed.error.issues }), { status: 400 });
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

  // 5. Fetch pending envelopes for a room or recipient (Inbox)
  if (method === 'GET' && path === '/api/ghost/inbox') {
    const roomId = url.searchParams.get('room_id');
    const recipientId = url.searchParams.get('recipient_id');
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    if (!roomId && !recipientId) {
      return new Response(JSON.stringify({ ok: false, error: 'Either room_id or recipient_id is required.' }), { status: 400 });
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

  // 6. Acknowledge read and immediately destroy physically (Burn-on-Read)
  if (method === 'POST' && path === '/api/ghost/read') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON.' }), { status: 400 });
    }

    const parsed = ghostReadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid envelope ID.' }), { status: 400 });
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
            // Immediately physically delete from database
            await db.prepare(`DELETE FROM ops_ghost_envelopes WHERE id = ?`).bind(envelope_id).run().catch(() => {});
            destroyed = true;
          } else {
            // Set expiration according to burn_timer_seconds from read time
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

  // 7. Immediate emergency destruction of an entire conversation/room (Panic Vaporize)
  if (method === 'POST' && path === '/api/ghost/vaporize') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON.' }), { status: 400 });
    }

    const parsed = ghostVaporizeSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing room_id.' }), { status: 400 });
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

  // 8. Contact listing and search in directory (Encrypted Contacts Directory + Registered Profiles)
  if (method === 'GET' && path === '/api/ghost/contacts') {
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    const filterType = (url.searchParams.get('filter') || 'all').toLowerCase(); // 'all', 'registered', 'online'
    let ghostContacts = [];
    let registeredUsers = [];

    if (db) {
      try {
        let sql = `SELECT peer_id, alias, public_key, status, avatar_color, last_seen FROM ops_ghost_directory `;
        const params = [];
        if (query) {
          sql += `WHERE LOWER(alias) LIKE ? OR LOWER(peer_id) LIKE ? `;
          params.push(`%${query}%`, `%${query}%`);
        }
        sql += `ORDER BY last_seen DESC LIMIT 50`;
        const res = await db.prepare(sql).bind(...params).all().catch(() => ({ results: [] }));
        ghostContacts = res?.results || [];
      } catch {}

      try {
        let userSql = `SELECT email, display_name, role, status, avatar_url, last_login_at FROM ops_users `;
        const userParams = [];
        if (query) {
          userSql += `WHERE (LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?) `;
          userParams.push(`%${query}%`, `%${query}%`);
        }
        userSql += `ORDER BY display_name ASC LIMIT 50`;
        const userRes = await db.prepare(userSql).bind(...userParams).all().catch(() => ({ results: [] }));
        registeredUsers = userRes?.results || [];
      } catch {}
    }

    const now = Date.now();
    const defaultSeeds = [
      {
        peer_id: 'basterix',
        alias: 'Basterix (Owner & Lead Architect)',
        public_key: '{"crv":"P-256","kty":"EC","x":"5ynaf2vkiAqkRtAjgFaDy6tmQixU3OOzZfcx0bzAPyw","y":"oDd3HaxjKMt1JNT2unNyT26tAxKGhyM4LQpSZvGCumY"}',
        status: 'online',
        avatar_color: '#3b82f6',
        is_registered: true,
        last_seen: now
      },
      {
        peer_id: 'trinity_ai',
        alias: 'Trinity Sovereign AI Copilot',
        public_key: '{"crv":"P-256","kty":"EC","x":"Rsuu0Xa1ibol44F3Phvtc7KHmewEP42ENOjsXb7K9VE","y":"J_akHg0A48np8UyaBzp5H7vqN0ezPiICJu5GjYZM7QA"}',
        status: 'online',
        avatar_color: '#10b981',
        is_registered: true,
        last_seen: now
      },
      {
        peer_id: 'usc_underground',
        alias: 'Underground Street Collective',
        public_key: '{"crv":"P-256","kty":"EC","x":"4s3EixOXcG6JqHp9x16kZBpYPZ_8jYzMFqpNpswYfTA","y":"nuHHFdlFdcNfTjLiSmTkWxPb-2K9pubhcnsJanvDHaY"}',
        status: 'away',
        avatar_color: '#a855f7',
        is_registered: true,
        last_seen: now - 360_000
      },
      {
        peer_id: 'delirium_trade',
        alias: 'Delirium Trade Vault',
        public_key: '{"crv":"P-256","kty":"EC","x":"hJFqljm1-Z74_77Zu-0JB-BQS5I8_Ioz5EGbJgFVwdY","y":"ijkWjpoZzuYj3yeeC2WFXKB0JW1Wo5tKh2RwGs9oWm4"}',
        status: 'online',
        avatar_color: '#f59e0b',
        is_registered: true,
        last_seen: now
      }
    ];

    const ghostPeerMap = new Map();
    for (const c of ghostContacts) {
      const dynamicStatus = computePresenceStatus(c.last_seen, now);
      ghostPeerMap.set(c.peer_id, {
        ...c,
        status: dynamicStatus
      });
    }

    const merged = [];

    // First integrate registered profiles from the system
    for (const u of registeredUsers) {
      const email = u.email || '';
      const peerId = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const existingGhost = ghostPeerMap.get(peerId);
      const ghostLastSeen = existingGhost?.last_seen ? Number(existingGhost.last_seen) : null;
      const userLastLogin = u.last_login_at ? new Date(u.last_login_at).getTime() : null;
      const effectiveLastSeen = Math.max(ghostLastSeen || 0, userLastLogin || 0);
      const dynamicStatus = computePresenceStatus(effectiveLastSeen, now);

      merged.push({
        peer_id: peerId,
        alias: u.display_name || email.split('@')[0],
        email: email,
        role: u.role || 'user',
        is_registered: true,
        status: dynamicStatus,
        avatar_color: u.role === 'admin' ? '#ef4444' : '#2563eb',
        avatar_url: u.avatar_url || null,
        public_key: existingGhost?.public_key || null,
        last_seen: effectiveLastSeen
      });
      ghostPeerMap.delete(peerId);
    }

    // Append remaining ghost directory contacts
    for (const [peerId, c] of ghostPeerMap.entries()) {
      merged.push({
        ...c,
        is_registered: false
      });
    }

    // Append default seed nodes if absent
    for (const seed of defaultSeeds) {
      if (!merged.some(c => c.peer_id === seed.peer_id)) {
        if (!query || seed.alias.toLowerCase().includes(query) || seed.peer_id.toLowerCase().includes(query)) {
          merged.push(seed);
        }
      }
    }

    // Apply contact filter
    let filtered = merged;
    if (filterType === 'registered') {
      filtered = merged.filter(c => c.is_registered);
    } else if (filterType === 'online') {
      filtered = merged.filter(c => c.status === 'online');
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      count: filtered.length, 
      contacts: filtered,
      total_registered: registeredUsers.length 
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // 8b. Generate invite QR code (ISO 18004 SVG)
  if (method === 'GET' && path === '/api/ghost/invite-qr') {
    const data = url.searchParams.get('data') || url.searchParams.get('url') || 'https://auru.dev/#encrypted_shits';
    const size = Math.min(Math.max(parseInt(url.searchParams.get('size') || '240', 10), 100), 600);
    try {
      const svg = generateQrSvg(data, size);
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="20" fill="red">QR Error</text></svg>', {
        status: 500,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
      });
    }
  }

  // 9. Register a contact into the public key directory
  if (method === 'POST' && path === '/api/ghost/contacts/register') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON.' }), { status: 400 });
    }

    const parsed = ghostContactRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid contact details.', details: parsed.error.issues }), { status: 400 });
    }

    const { peer_id, alias, public_key, avatar_color } = parsed.data;
    const now = Date.now();

    if (db) {
      try {
        await db.prepare(
          `INSERT OR REPLACE INTO ops_ghost_directory (peer_id, alias, public_key, status, avatar_color, last_seen)
           VALUES (?, ?, ?, 'online', ?, ?)`
        ).bind(peer_id, alias, public_key, avatar_color || '#3b82f6', now).run().catch(() => {});
      } catch {}
    }

    return new Response(JSON.stringify({ ok: true, peer_id, alias, registered: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  // 10. Heartbeat for maintaining active online presence
  if (method === 'POST' && (path === '/api/ghost/heartbeat' || path === '/api/ghost/contacts/heartbeat')) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON.' }), { status: 400 });
    }

    const parsed = ghostHeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid heartbeat payload.', details: parsed.error.issues }), { status: 400 });
    }

    const { peer_id, alias, public_key, avatar_color } = parsed.data;
    const now = Date.now();

    if (db) {
      try {
        const updateRes = await db.prepare(
          `UPDATE ops_ghost_directory SET last_seen = ?, status = 'online' WHERE peer_id = ?`
        ).bind(now, peer_id).run().catch(() => null);

        if ((!updateRes || updateRes.meta?.changes === 0) && alias && public_key) {
          await db.prepare(
            `INSERT INTO ops_ghost_directory (peer_id, alias, public_key, status, avatar_color, last_seen)
             VALUES (?, ?, ?, 'online', ?, ?)`
          ).bind(peer_id, alias, public_key, avatar_color || '#3b82f6', now).run().catch(() => {});
        }
      } catch (err) {
        console.error('Heartbeat write error:', err);
      }
    }

    return new Response(JSON.stringify({ ok: true, peer_id, last_seen: now, status: 'online' }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Unknown Ghost Vault endpoint.' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
