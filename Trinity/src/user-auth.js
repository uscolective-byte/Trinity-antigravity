/**
 * @module TRINITY_OMNI_CORE
 * @subsystem USER_CREDENTIALS_AND_PROFILE_AUTH
 * @author Basterix (Root Architect) & Antigravity
 * @license Sovereign Irrevocable Covenant
 * @description Secure credential management (email + password via Web Crypto PBKDF2-SHA256, 100,000 iterations),
 * registration, login, profile provisioning, and profile attributes for TRINITY OMNI-CORE.
 */

import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { HttpError, issueSession, isOwnerEmail, isAdminEmail } from './security.js';

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address format.').max(120),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password must not exceed 128 characters.')
    .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'Password must contain both letters and numbers.'),
  display_name: z.string().trim().min(2, 'Display name must be at least 2 characters long.').max(60).optional()
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format.').max(120),
  password: z.string().min(1, 'Password is required.').max(128)
}).strict();

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;

/**
 * Securely hashes a password using Web Crypto PBKDF2 (HMAC-SHA256) and a random 16-byte salt.
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
 * Verifies a password in constant time against the stored hash and salt.
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
  new_password: registerSchema.shape.password.refine(password => password.length >= 12, 'New password must be at least 12 characters long.')
}).strict();

export async function changeOwnPassword(env, email, currentSessionHash, input) {
  const { current_password, new_password } = passwordChangeSchema.parse(input);
  if (!email || !currentSessionHash) throw new HttpError(401, 'Sign in to Trinity.');
  if (current_password === new_password) throw new HttpError(400, 'Please choose a different password.');
  const user = await env.DB.prepare(
    "SELECT password_hash,password_salt FROM ops_users WHERE email=? AND status='active'"
  ).bind(email).first();
  if (!await verifyPassword(current_password, user?.password_hash, user?.password_salt)) {
    throw new HttpError(403, 'Current password is incorrect.');
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
  if (changed.meta?.changes !== 1) throw new HttpError(409, 'Account changed concurrently. Please try again.');
}

/**
 * Sanitizes and returns the user profile object for frontend/API responses.
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
 * Registers a new user with email and password credentials.
 * Privileged owner/admin emails are rejected from public registration and require verified provisioning.
 */
export async function registerWithCredentials(request, env, input) {
  const data = registerSchema.parse(input);
  const emailNorm = data.email.toLowerCase();
  
  if (!env?.DB?.prepare) {
    throw new HttpError(503, 'User database is not connected.');
  }

  if (isOwnerEmail(env,emailNorm) || isAdminEmail(env,emailNorm)) {
    throw new HttpError(403, 'Privileged account requires verified access provisioning.');
  }
  const existing = await env.DB.prepare('SELECT email FROM ops_users WHERE email=?').bind(emailNorm).first();
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists. Please use an existing sign-in method.');
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

  // Record audit log entry
  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('user_registered', ?)")
    .bind(JSON.stringify({ email: emailNorm, role, status, at: Date.now() }))
    .run()
    .catch(() => {});

  // Issue session cookie
  const sessionRes = await issueSession(env, undefined, emailNorm, request);
  const cookie = sessionRes.headers.get('Set-Cookie');

  return {
    user: sanitizeUserProfile(user, false),
    cookie
  };
}

/**
 * Authenticates a user with email and password and returns a session cookie and profile.
 */
export async function loginWithCredentials(request, env, input) {
  const data = loginSchema.parse(input);
  const emailNorm = data.email.toLowerCase();

  if (!env?.DB?.prepare) {
    throw new HttpError(503, 'User database is not connected.');
  }

  const user = await env.DB.prepare('SELECT * FROM ops_users WHERE email=?')
    .bind(emailNorm)
    .first();

  if (!user || !user.password_hash || !user.password_salt) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const match = await verifyPassword(data.password, user.password_hash, user.password_salt);
  if (!match) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  if (user.status === 'blocked' || user.status === 'rejected') {
    throw new HttpError(403, 'This account has been blocked or suspended.');
  }

  // Update last_login_at timestamp
  await env.DB.prepare("UPDATE ops_users SET last_login_at=datetime('now'), updated_at=datetime('now') WHERE email=?")
    .bind(emailNorm)
    .run()
    .catch(() => {});

  const isOwner = isOwnerEmail(env, emailNorm);

  // Record audit log event
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
 * Retrieves the profile of the authenticated user.
 */
export async function getUserProfile(env, email) {
  if (!email || !env?.DB?.prepare) return null;
  const emailNorm = email.toLowerCase();
  const row = await env.DB.prepare('SELECT * FROM ops_users WHERE email=?').bind(emailNorm).first();
  if (!row) return null;
  return sanitizeUserProfile(row, isOwnerEmail(env, emailNorm));
}

/**
 * Updates user profile attributes (display_name, avatar_url).
 */
export async function updateUserProfile(env, email, updates = {}) {
  if (!email || !env?.DB?.prepare) throw new HttpError(401, 'Unauthorized access.');
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
