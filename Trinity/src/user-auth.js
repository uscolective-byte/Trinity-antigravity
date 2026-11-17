/**
 * @module TRINITY_OMNI_CORE
 * @subsystem USER_CREDENTIALS_AND_PROFILE_AUTH
 * @author Basterix (Root Architect) & Antigravity
 * @license Sovereign Irrevocable Covenant
 * @description Bezpečná správa prihlasovacích údajov (Email + Heslo via Web Crypto PBKDF2-SHA256, 100 000 iterácií),
 * registrácia, prihlásenie, profile provision a profilové atribúty pre TRINITY OMNI-CORE.
 */

import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { HttpError, issueSession, isOwnerEmail, isAdminEmail } from './security.js';

export const registerSchema = z.object({
  email: z.string().trim().email('Neplatný formát e-mailovej adresy.').max(120),
  password: z.string()
    .min(8, 'Heslo musí mať aspoň 8 znakov.')
    .max(128, 'Heslo nesmie presiahnuť 128 znakov.')
    .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'Heslo musí obsahovať písmená aj čísla.'),
  display_name: z.string().trim().min(2, 'Meno musí mať aspoň 2 znaky.').max(60).optional()
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email('Neplatný formát e-mailovej adresy.').max(120),
  password: z.string().min(1, 'Zadaj heslo.').max(128)
}).strict();

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;

/**
 * Bezpečne zahashuje heslo pomocou Web Crypto PBKDF2 (HMAC-SHA256) a náhodnej 16-bajtovej soli.
 */
export async function hashPassword(password, saltHex = null) {
  const salt = saltHex
    ? Buffer.from(saltHex, 'hex')
    : crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );

  return {
    hashHex: Buffer.from(derived).toString('hex'),
    saltHex: Buffer.from(salt).toString('hex')
  };
}

/**
 * Overí heslo v konštantnom čase voči uloženému hashu a soli.
 */
export async function verifyPassword(password, storedHashHex, storedSaltHex) {
  if (!password || !storedHashHex || !storedSaltHex) return false;
  try {
    const computed = await hashPassword(password, storedSaltHex);
    return timingSafeEqual(
      Buffer.from(computed.hashHex, 'hex'),
      Buffer.from(storedHashHex, 'hex')
    );
  } catch {
    return false;
  }
}

const passwordChangeSchema = z.object({
  current_password: loginSchema.shape.password,
  new_password: registerSchema.shape.password.refine(password => password.length >= 12, 'Nové heslo musí mať aspoň 12 znakov.')
}).strict();

export async function changeOwnPassword(env, email, currentSessionHash, input) {
  const { current_password, new_password } = passwordChangeSchema.parse(input);
  if (!email || !currentSessionHash) throw new HttpError(401, 'Prihlás sa do Trinity.');
  if (current_password === new_password) throw new HttpError(400, 'Použi iné heslo.');
  const user = await env.DB.prepare(
    "SELECT password_hash,password_salt FROM ops_users WHERE email=? AND status='active'"
  ).bind(email).first();
  if (!await verifyPassword(current_password, user?.password_hash, user?.password_salt)) {
    throw new HttpError(403, 'Aktuálne heslo nie je správne.');
  }

  const { hashHex, saltHex } = await hashPassword(new_password);
  const [changed] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE ops_users SET password_hash=?,password_salt=?,updated_at=datetime('now') WHERE email=? AND status='active' AND password_hash=? AND password_salt=?"
    ).bind(hashHex, saltHex, email, user.password_hash, user.password_salt),
    env.DB.prepare(
      'DELETE FROM ops_sessions WHERE lower(email)=? AND token_hash<>? AND EXISTS(SELECT 1 FROM ops_users WHERE email=? AND password_hash=?)'
    ).bind(email, currentSessionHash, email, hashHex)
  ]);
  if (changed.meta?.changes !== 1) throw new HttpError(409, 'Účet sa medzitým zmenil. Skús to znovu.');
}

/**
 * Sanitizuje a vráti objekt používateľského profilu pre frontend/API.
 */
export function sanitizeUserProfile(user, isOwner = false) {
  if (!user) return null;
  return {
    email: user.email,
    display_name: user.display_name,
    role: isOwner ? 'owner' : (user.role || 'user'),
    status: user.status,
    avatar_url: user.avatar_url || null,
    created_at: user.created_at,
    last_login_at: user.last_login_at || null,
    is_owner: Boolean(isOwner)
  };
}

/**
 * Zaregistruje nového používateľa (Email + Heslo).
 * Ak je e-mail v zozname TRINITY_OWNER_EMAILS, automaticky získa rolu 'owner'/'admin' a status 'active'.
 */
export async function registerWithCredentials(request, env, input) {
  const data = registerSchema.parse(input);
  const emailNorm = data.email.toLowerCase();
  
  if (!env?.DB?.prepare) {
    throw new HttpError(503, 'Databáza používateľov nie je pripojená.');
  }

  if (isOwnerEmail(env,emailNorm) || isAdminEmail(env,emailNorm)) {
    throw new HttpError(403, 'Správcovský účet vyžaduje overené zriadenie prístupu.');
  }
  const existing = await env.DB.prepare('SELECT email FROM ops_users WHERE email=?').bind(emailNorm).first();
  if (existing) {
    throw new HttpError(409, 'Používateľ s týmto e-mailom už existuje. Použi existujúci spôsob prihlásenia.');
  }

  const { hashHex, saltHex } = await hashPassword(data.password);
  const role = 'user';
  const status = 'active';
  const displayName = data.display_name || emailNorm.split('@')[0];
  const googleSubSynthetic = `creds:${crypto.randomUUID()}`;

  await env.DB.prepare(`
    INSERT INTO ops_users (email, google_sub, display_name, role, status, password_hash, password_salt, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `).bind(emailNorm, googleSubSynthetic, displayName, role, status, hashHex, saltHex).run();

  const user = await env.DB.prepare('SELECT * FROM ops_users WHERE email=?').bind(emailNorm).first();

  // Zaloguj do audit logu
  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('user_registered', ?)")
    .bind(JSON.stringify({ email: emailNorm, role, status, at: Date.now() }))
    .run()
    .catch(() => {});

  // Vytvor session cookie
  const sessionRes = await issueSession(env, undefined, emailNorm, request);
  const cookie = sessionRes.headers.get('Set-Cookie');

  return {
    user: sanitizeUserProfile(user, false),
    cookie
  };
}

/**
 * Prihlási používateľa (Email + Heslo) a vráti session cookie a profil.
 */
export async function loginWithCredentials(request, env, input) {
  const data = loginSchema.parse(input);
  const emailNorm = data.email.toLowerCase();

  if (!env?.DB?.prepare) {
    throw new HttpError(503, 'Databáza používateľov nie je pripojená.');
  }

  const user = await env.DB.prepare('SELECT * FROM ops_users WHERE email=?')
    .bind(emailNorm)
    .first();

  if (!user || !user.password_hash || !user.password_salt) {
    throw new HttpError(401, 'Nesprávny e-mail alebo heslo.');
  }

  const match = await verifyPassword(data.password, user.password_hash, user.password_salt);
  if (!match) {
    throw new HttpError(401, 'Nesprávny e-mail alebo heslo.');
  }

  if (user.status === 'blocked' || user.status === 'rejected') {
    throw new HttpError(403, 'Tento účet bol zablokovaný alebo pozastavený.');
  }

  // Aktualizuj last_login_at
  await env.DB.prepare("UPDATE ops_users SET last_login_at=datetime('now'), updated_at=datetime('now') WHERE email=?")
    .bind(emailNorm)
    .run()
    .catch(() => {});

  const isOwner = isOwnerEmail(env, emailNorm);

  // Zaloguj udalosť
  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('user_logged_in', ?)")
    .bind(JSON.stringify({ email: emailNorm, at: Date.now() }))
    .run()
    .catch(() => {});

  const sessionRes = await issueSession(env, undefined, emailNorm, request, user.password_hash);
  const cookie = sessionRes.headers.get('Set-Cookie');

  return {
    user: sanitizeUserProfile({ ...user, last_login_at: new Date().toISOString() }, isOwner),
    cookie
  };
}

/**
 * Získa profil prihláseného používateľa.
 */
export async function getUserProfile(env, email) {
  if (!email || !env?.DB?.prepare) return null;
  const emailNorm = email.toLowerCase();
  const row = await env.DB.prepare('SELECT * FROM ops_users WHERE email=?').bind(emailNorm).first();
  if (!row) return null;
  return sanitizeUserProfile(row, isOwnerEmail(env, emailNorm));
}

/**
 * Aktualizuje profilové údaje (display_name, avatar_url).
 */
export async function updateUserProfile(env, email, updates = {}) {
  if (!email || !env?.DB?.prepare) throw new HttpError(401, 'Neautorizovaný prístup.');
  const emailNorm = email.toLowerCase();
  const schema = z.object({
    display_name: z.string().trim().min(2).max(60).optional(),
    avatar_url: z.string().url().max(300).optional().nullable()
  }).strict();

  const data = schema.parse(updates);
  const sets = [];
  const binds = [];

  if (data.display_name !== undefined) {
    sets.push('display_name=?');
    binds.push(data.display_name);
  }
  if (data.avatar_url !== undefined) {
    sets.push('avatar_url=?');
    binds.push(data.avatar_url);
  }

  if (!sets.length) return await getUserProfile(env, emailNorm);

  sets.push("updated_at=datetime('now')");
  binds.push(emailNorm);

  await env.DB.prepare(`UPDATE ops_users SET ${sets.join(', ')} WHERE email=?`).bind(...binds).run();
  return await getUserProfile(env, emailNorm);
}
