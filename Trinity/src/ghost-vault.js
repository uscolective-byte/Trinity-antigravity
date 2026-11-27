import { z } from 'zod';
import { authenticate, checkOrigin, hash, readJSON } from './security.js';

const peerId = z.string().regex(/^p_[a-f0-9]{32}$/);
const key = z.object({
  kty: z.literal('EC'), crv: z.literal('P-256'),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();
const profile = z.object({alias:z.string().trim().min(1).max(60), public_key:key, replace:z.boolean().default(false)}).strict();
const envelope = z.object({
  recipient_id:peerId,
  sender_key:key,
  recipient_key:key,
  ciphertext:z.string().min(24).max(26000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  iv:z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  burn_on_read:z.boolean(),
  ttl_seconds:z.union([z.literal(60),z.literal(300),z.literal(3600),z.literal(86400)]),
}).strict();
const readReceipt = z.object({envelope_id:z.string().uuid()}).strict();

const initialized = new WeakMap();
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'};
const reply = (body,status=200) => Response.json(body,{status,headers});

export async function privatePeerId(email) {
  return 'p_' + (await hash('trinity-private-chat:' + email.trim().toLowerCase())).slice(0,32);
}

export const privateRoomId = (a,b) => 'dm__' + [a,b].sort().join('__');

export async function ensureGhostVaultTables(db) {
  if (!initialized.has(db)) {
    const setup = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS ops_ghost_directory (
        peer_id TEXT PRIMARY KEY, alias TEXT NOT NULL, public_key TEXT NOT NULL,
        status TEXT DEFAULT 'online', avatar_color TEXT, last_seen INTEGER NOT NULL
      )`).run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS ops_ghost_envelopes (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL, sender_id TEXT NOT NULL,
        recipient_id TEXT, ciphertext TEXT NOT NULL, iv TEXT NOT NULL,
        ephemeral_pubkey TEXT NOT NULL, burn_on_read INTEGER DEFAULT 1,
        burn_timer_seconds INTEGER DEFAULT 30, created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, read_at INTEGER, destroyed_at INTEGER
      )`).run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_ghost_env_room ON ops_ghost_envelopes(room_id, created_at)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_ghost_env_expires ON ops_ghost_envelopes(expires_at)').run();
    })();
    initialized.set(db, setup);
    setup.catch(() => initialized.delete(db));
  }
  await initialized.get(db);
}

async function parse(request,schema) {
  const result = schema.safeParse(await readJSON(request, 34000));
  return result.success ? result.data : null;
}

export async function handleGhostVaultApi(request, env, ctx) {
  const {pathname, searchParams} = new URL(request.url);
  const endpoint = pathname.slice('/api/ghost/'.length);
  try {
    checkOrigin(request, env);
    const account = await authenticate(request, env);
    if (!account.email || account.role === 'guest') return reply({error:'Vyžaduje sa účet s e-mailom.'},403);
    const db = env.DB;
    if (!db) return reply({error:'Úložisko správ je nedostupné.'},503);
    const me = await privatePeerId(account.email);
    if (request.method === 'GET' && endpoint === 'me') return reply({peer_id:me});
    await ensureGhostVaultTables(db);
    const now = Date.now();
    const lookup = id => db.prepare('SELECT peer_id,alias,public_key FROM ops_ghost_directory WHERE peer_id=?').bind(id).first();

    if (request.method === 'POST' && endpoint === 'profile') {
      const data = await parse(request,profile);
      if (!data) return reply({error:'Neplatný profil.'},400);
      await crypto.subtle.importKey('jwk',data.public_key,{name:'ECDH',namedCurve:'P-256'},false,[])
        .catch(() => { throw Object.assign(new Error('Neplatný verejný kľúč.'),{status:400}); });
      const publicKey = JSON.stringify(data.public_key);
      const result = await db.prepare(`INSERT INTO ops_ghost_directory(peer_id,alias,public_key,last_seen)
        VALUES(?,?,?,?) ON CONFLICT(peer_id) DO UPDATE SET alias=excluded.alias,
        public_key=excluded.public_key,last_seen=excluded.last_seen
        WHERE ops_ghost_directory.public_key=excluded.public_key OR ?
        RETURNING peer_id`).bind(me,data.alias,publicKey,now,Number(data.replace)).first();
      return result ? reply({peer_id:me}) : reply({error:'Účet má kľúč z iného prehliadača. Použi pôvodný prehliadač alebo výslovne obnov kľúč.'},409);
    }

    if (request.method === 'GET' && endpoint === 'contacts') {
      const target = searchParams.get('peer');
      if (target) {
        if (!peerId.safeParse(target).success || target===me) return reply({error:'Neplatný kontakt.'},400);
        const contact = await lookup(target);
        return contact ? reply({contacts:[contact]}) : reply({error:'Kontakt zatiaľ nemá aktívny profil.'},404);
      }
      const search = (searchParams.get('q') || '').trim().slice(0,60);
      const {results} = await db.prepare(`SELECT peer_id,alias,public_key FROM ops_ghost_directory
        WHERE peer_id != ? AND length(peer_id)=34 AND peer_id GLOB 'p_[0-9a-f]*'
        AND instr(lower(alias),lower(?)) > 0 ORDER BY alias COLLATE NOCASE,peer_id LIMIT 50`)
        .bind(me,search).all();
      return reply({contacts:results});
    }

    if (request.method === 'POST' && endpoint === 'envelope') {
      const data = await parse(request,envelope);
      if (!data || data.recipient_id===me) return reply({error:'Neplatná šifrovaná správa.'},400);
      const [sender, recipient] = await Promise.all([lookup(me),lookup(data.recipient_id)]);
      if (sender?.public_key !== JSON.stringify(data.sender_key)) {
        return reply({error:'Kľúč tohto prehliadača už nie je aktívny.'},409);
      }
      if (recipient?.public_key !== JSON.stringify(data.recipient_key)) {
        return reply({error:'Kľúč kontaktu sa zmenil alebo nie je dostupný. Otvor konverzáciu znova.'},409);
      }
      const id = crypto.randomUUID();
      const expiresAt = now + data.ttl_seconds * 1000;
      await db.prepare(`INSERT INTO ops_ghost_envelopes
        (id,room_id,sender_id,recipient_id,ciphertext,iv,ephemeral_pubkey,burn_on_read,burn_timer_seconds,created_at,expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,privateRoomId(me,data.recipient_id),me,data.recipient_id,data.ciphertext,
          data.iv,sender.public_key,Number(data.burn_on_read),data.ttl_seconds,now,expiresAt).run();
      return reply({id,created_at:now,expires_at:expiresAt},201);
    }

    if (request.method === 'GET' && endpoint === 'inbox') {
      const target = searchParams.get('peer');
      if (!peerId.safeParse(target).success || target===me) return reply({error:'Neplatný kontakt.'},400);
      const after = z.coerce.number().int().nonnegative().safeParse(searchParams.get('after') ?? 0);
      const afterId = searchParams.get('after_id') || '';
      if (!after.success || (afterId && !z.string().uuid().safeParse(afterId).success)) return reply({error:'Neplatná pozícia.'},400);
      const {results} = await db.prepare(`SELECT id,sender_id,ciphertext,iv,ephemeral_pubkey,burn_on_read,created_at,expires_at
        FROM ops_ghost_envelopes WHERE room_id=? AND expires_at > ?
        AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))
        AND (created_at>? OR (created_at=? AND id>?)) ORDER BY created_at,id LIMIT 100`)
        .bind(privateRoomId(me,target),now,me,target,target,me,after.data,after.data,afterId).all();
      if (ctx?.waitUntil) ctx.waitUntil(db.prepare('DELETE FROM ops_ghost_envelopes WHERE expires_at<=?').bind(now).run().catch(()=>{}));
      return reply({envelopes:results});
    }

    if (request.method === 'POST' && endpoint === 'read') {
      const data = await parse(request,readReceipt);
      if (!data) return reply({error:'Neplatné potvrdenie.'},400);
      await db.prepare('DELETE FROM ops_ghost_envelopes WHERE id=? AND recipient_id=? AND burn_on_read=1')
        .bind(data.envelope_id,me).run();
      return reply({ok:true});
    }

    return reply({error:'Táto operácia súkromných správ už nie je dostupná.'},404);
  } catch (error) {
    return error?.status && error.status < 500
      ? reply({error:error.message},error.status)
      : reply({error:'Súkromné správy sú dočasne nedostupné.'},503);
  }
}
