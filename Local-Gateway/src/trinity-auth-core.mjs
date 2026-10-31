/**
 * TRINITY UNIFIED AUTHORIZATION CORE (Local-Gateway / Windows Host)
 * Zjednotené autorizačné jadro pre lokálny systémový most vo Windows:
 * 1. Windows Auth Gate (účet 'saboi' / 'basterix' + unikátne Windows SID cez PowerShell)
 * 2. Google Identity Verifier ('saboivan2008@gmail.com', 'uscolective@gmail.com', 'cadjavadvocecka013@gmail.com')
 * 3. Telecom / WhatsApp / SMS Channel ('+421949009722', '0949009722', '+421949515777', '0949515777')
 * 4. Keď je operátor overený Basterix: koná okamžite a bez otázok.
 *    Keď je to obyčajný používateľ (GUEST_USER): okamžitý HARD-LOCK (403 ACCESS DENIED).
 */

import os from 'node:os';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

export const ROOT_REGISTRY = Object.freeze({
  architect_alias: 'Basterix',
  windows_users: Object.freeze(['saboi', 'basterix']),
  google_accounts: Object.freeze([
    'saboivan2008@gmail.com',
    'uscolective@gmail.com',
    'cadjavadvocecka013@gmail.com'
  ]),
  phone_numbers: Object.freeze([
    '+421949009722',
    '0949009722',
    '+421949515777',
    '0949515777'
  ])
});

export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[\s\-\(\)]/g, '').trim();
}

export function canonicalPhoneVariants(phone) {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return [];
  const variants = new Set([cleaned]);
  if (cleaned.startsWith('+421') && cleaned.length === 13) {
    variants.add('0' + cleaned.slice(4));
  } else if (cleaned.startsWith('09') && cleaned.length === 10) {
    variants.add('+421' + cleaned.slice(1));
  } else if (cleaned.startsWith('4219') && cleaned.length === 12) {
    variants.add('+' + cleaned);
    variants.add('0' + cleaned.slice(3));
  }
  return [...variants];
}

export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim();
}

let cachedWindowsSid = undefined;

export function getActiveWindowsSID() {
  if (cachedWindowsSid !== undefined) return cachedWindowsSid;
  if (os.platform() !== 'win32') {
    cachedWindowsSid = null;
    return null;
  }
  try {
    const rawSid = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value"',
      { encoding: 'utf8', timeout: 2500 }
    ).trim();
    cachedWindowsSid = rawSid || null;
    return cachedWindowsSid;
  } catch {
    cachedWindowsSid = null;
    return null;
  }
}

/**
 * 1. Lokálna Windows inšpekcia
 * Zisťuje, či aktuálny proces beží pod prihláseným kontom Basterixa ('saboi' / 'basterix') a overuje SID.
 */
export function inspectWindowsSession(overrides = {}) {
  const envUser = String(
    overrides.username ??
    process.env.USERNAME ??
    os.userInfo().username ??
    ''
  ).toLowerCase().trim();
  const domain = String(
    overrides.domain ??
    process.env.USERDOMAIN ??
    os.hostname() ??
    ''
  ).toLowerCase().trim();
  const sid = overrides.sid !== undefined ? overrides.sid : getActiveWindowsSID();

  const isMatchedUser = ROOT_REGISTRY.windows_users.includes(envUser);

  if (isMatchedUser && sid) {
    const sessionToken = crypto
      .createHash('sha256')
      .update(`${envUser}:${sid}:${domain}`)
      .digest('hex');

    return {
      authenticated: true,
      role: 'BASTERIX_ROOT',
      channel: 'WINDOWS_SESSION',
      username: envUser,
      domain,
      identifier: `${domain}\\${envUser}`,
      sid,
      sessionToken
    };
  }

  return {
    authenticated: false,
    role: 'GUEST_USER',
    channel: 'WINDOWS_SESSION',
    username: envUser || 'unknown',
    domain,
    identifier: envUser || 'unknown',
    sid: null,
    sessionToken: null
  };
}

/**
 * 2. Univerzálny overovač prichádzajúcich požiadaviek (Omnichannel)
 */
export function verifyTrinityIdentity(context = {}) {
  const timestamp = new Date().toISOString();

  // A. Kontrola podľa Google účtu
  const email = normalizeEmail(context.email);
  if (email && ROOT_REGISTRY.google_accounts.includes(email)) {
    return {
      isRoot: true,
      role: 'BASTERIX_ROOT',
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'GOOGLE_ACCOUNT',
      identifier: email,
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // B. Kontrola podľa telefónneho čísla (WhatsApp / SMS brána)
  const phone = normalizePhone(context.phone);
  if (phone) {
    const incomingVariants = canonicalPhoneVariants(phone);
    const isPhoneMatch = ROOT_REGISTRY.phone_numbers.some(entry =>
      incomingVariants.includes(normalizePhone(entry))
    );
    if (isPhoneMatch) {
      return {
        isRoot: true,
        role: 'BASTERIX_ROOT',
        operator: ROOT_REGISTRY.architect_alias,
        channel: 'TELECOM_CHANNEL',
        identifier: phone,
        immediateExecution: true,
        askNoQuestions: true,
        timestamp
      };
    }
  }

  // C. Kontrola podľa explicitného lokálneho Windows používateľa
  const winUser = String(context.windowsUser || '').toLowerCase().trim();
  if (winUser && ROOT_REGISTRY.windows_users.includes(winUser)) {
    return {
      isRoot: true,
      role: 'BASTERIX_ROOT',
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'WINDOWS_LOCAL_EXPLICIT',
      identifier: winUser,
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // D. Ak nie je zadaný externý identifikátor, over aktívnu Windows reláciu
  const hasExplicitExternalId = Boolean(email || phone || winUser);
  if (!hasExplicitExternalId && context.checkLocalWindows !== false) {
    const localWin = inspectWindowsSession(context.windowsSession || {});
    if (localWin.authenticated) {
      return {
        isRoot: true,
        role: 'BASTERIX_ROOT',
        operator: ROOT_REGISTRY.architect_alias,
        channel: localWin.channel,
        identifier: localWin.identifier,
        sid: localWin.sid,
        immediateExecution: true,
        askNoQuestions: true,
        timestamp
      };
    }
  }

  // E. Žiadna zhoda -> Zákaz prístupu
  return {
    isRoot: false,
    role: 'GUEST_USER',
    operator: 'UNAUTHORIZED_GUEST',
    channel: 'REJECTED_INPUT',
    identifier: email || phone || winUser || 'unknown',
    immediateExecution: false,
    askNoQuestions: false,
    timestamp
  };
}

/**
 * 3. Hlavná exekučná brána (Execution Interceptor)
 */
export async function executePrivileged(context = {}, actionMetadata = {}, actionCallback) {
  const auth = verifyTrinityIdentity(context);

  if (auth.isRoot && auth.role === 'BASTERIX_ROOT') {
    return await actionCallback(auth);
  }

  const securityIncident = {
    status: 'SECURITY_BLOCKED',
    policy: 'TRINITY_ROOT_LOCK_V1',
    reason: 'UNAUTHORIZED_OPERATOR',
    attempted_action: actionMetadata?.action || 'UNKNOWN_ACTION',
    target: actionMetadata?.target || null,
    rejected_source: auth.identifier,
    channel: auth.channel,
    timestamp: auth.timestamp
  };

  console.error('[TRINITY SOVEREIGN LOCKOUT]', JSON.stringify(securityIncident));

  const err = new Error(
    `ACCESS DENIED: Identita '${auth.identifier}' cez kanál '${auth.channel}' nie je autorizovaný administrátor. Modifikovať systém a spúšťať príkazy môže výlučne overený Basterix.`
  );
  err.status = 403;
  err.securityIncident = securityIncident;
  throw err;
}
