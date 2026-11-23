/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTH_GATE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Unified authorization core (HMAC-SHA256 Worker Secrets + Windows OS SID + Google OAuth + Telecom HMAC) with fail-closed protection for sole architect Basterix.
 */
import { createHmac } from 'node:crypto';
import { SovereignLedgerV3 } from './sovereign-core-v3.js';

export const UserRole = Object.freeze({
  BASTERIX_ROOT: 'BASTERIX_ROOT',
  GUEST_USER: 'GUEST_USER'
});

/**
 * Strict format for a real Windows Security Identifier (SID) obtained from an authenticated OS token.
 * Must never be synthesized from a username or environment variables.
 */
export const VALID_WINDOWS_SID_REGEX = /^S-1-5-21-\d+-\d+-\d+-\d+$/;

/**
 * TRINITY ROOT REGISTRY
 * Fallback identity allowlist for offline environments without Worker secrets configured.
 * In production, primary verification uses env.IDENTITY_HMAC_KEY and env.ROOT_ID_HASHES.
 */
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

/**
 * 20 Legal Licenses and Compliance Clauses (TRINITY LEGAL & COMPLIANCE FRAMEWORK)
 */
export const SOVEREIGN_LEGAL_CHARTER_20 = Object.freeze([
  { id: 1, code: 'SOVEREIGN_OWNERSHIP_LICENSE', title: 'Exclusive Sovereign Ownership License' },
  { id: 2, code: 'DUAL_OPEN_CORE_PROPRIETARY', title: 'Dual Software License: Trinity Open-Core / Proprietary' },
  { id: 3, code: 'STRICT_TRUTH_ASSERTION_CLAUSE', title: 'Strict Truthfulness and No-Simulation Clause' },
  { id: 4, code: 'FINANCIAL_PROXY_MANDATE', title: 'Financial Management and Proxy Mandate Agreement' },
  { id: 5, code: 'EU_AI_ACT_EXEMPTION', title: 'EU AI Act Compliance and Exemption Declaration (Article 2(6))' },
  { id: 6, code: 'GDPR_DATA_CONTROLLER_ACCORD', title: 'Personal Data Processing Protocol (GDPR)' },
  { id: 7, code: 'ZERO_THIRD_PARTY_TELEMETRY', title: 'Zero Third-Party Telemetry Declaration' },
  { id: 8, code: 'PERPETUAL_NON_CIRCUMVENTION', title: 'Non-Disclosure and Non-Circumvention Agreement' },
  { id: 9, code: 'CRYPTOGRAPHIC_AUDIT_TREATY', title: 'Cryptographic Audit Treaty' },
  { id: 10, code: 'THIRD_PARTY_LIABILITY_SHIELD', title: 'Third-Party Limitation of Liability Clause' },
  { id: 11, code: 'DIGITAL_IDENTITY_DECLARATION', title: 'Digital Identity and Representation Declaration' },
  { id: 12, code: 'HOST_COMPUTE_AUTHORIZATION', title: 'Local Host Hardware Compute Authorization Agreement' },
  { id: 13, code: 'AI_TRACEABILITY_COVENANT', title: 'Code Auditability and Immutable Logging Covenant' },
  { id: 14, code: 'EULA_OPERATOR_BOUNDARY_TERMS', title: 'End-User Operator License and Boundary Terms' },
  { id: 15, code: 'AI_GENERATED_IP_PROTECTION', title: 'Intellectual Property Protection Clause (Work for Hire)' },
  { id: 16, code: 'ANTI_MALWARE_SAFE_EXECUTION', title: 'Safe Execution and Anti-Malware Prevention Protocol' },
  { id: 17, code: 'OPERATOR_INSPECTION_WARRANTY', title: '100% Operator Transparency and Inspection Warranty (Glass-Box)' },
  { id: 18, code: 'MULTI_AGENT_DELEGATION_ACCORD', title: 'Multi-Agent Delegated Responsibility Accord' },
  { id: 19, code: 'EMERGENCY_KILLSWITCH_ACCORD', title: 'Safe Emergency Shutdown Protocol (< 100 ms)' },
  { id: 20, code: 'PERPETUAL_SOVEREIGNTY_COVENANT', title: 'Perpetual Irrevocable Sovereignty Covenant' }
]);

/**
 * Normalizes a phone number by removing spaces, parentheses, and hyphens.
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[\s\-\(\)]/g, '').trim();
}

/**
 * Converts a phone number into canonical E.164 format (+421...).
 */
export function toCanonicalPhone(phone) {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return '';
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    return '+421' + cleaned.slice(1);
  }
  if (cleaned.startsWith('4219') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  return cleaned;
}

/**
 * Returns all accepted phone number variants for backwards compatibility.
 */
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

/**
 * Canonical normalization of any identity value prior to HMAC computation:
 * lowercase, trimmed, whitespace stripped, Slovak local numbers converted to +421...
 */
export function toCanonicalIdentity(value) {
  let cleaned = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '+421' + cleaned.slice(1);
  } else if (cleaned.startsWith('4219') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Asynchronous HMAC-SHA256 computation via Web Crypto API (Cloudflare Worker runtime).
 */
export async function idHash(value, key) {
  if (!value || !key) return '';
  const norm = toCanonicalIdentity(value);
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(norm));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous HMAC-SHA256 computation via node:crypto (Node.js & nodejs_compat).
 */
export function idHashSync(value, key) {
  if (!value || !key) return '';
  const norm = toCanonicalIdentity(value);
  return createHmac('sha256', key).update(norm).digest('hex');
}

/**
 * Securely verifies whether an identity belongs to the authorized root identity set.
 * When Worker Secrets (IDENTITY_HMAC_KEY and ROOT_ID_HASHES) are available, comparisons use HMAC hashes exclusively.
 * Otherwise (offline unit tests without secrets), falls back to the provided allowlist.
 */
export function isAuthorizedRoot(candidate, env = {}, fallbackList = []) {
  if (!candidate) return false;
  const canonical = toCanonicalIdentity(candidate);
  const hmacKey = env?.IDENTITY_HMAC_KEY || (typeof process !== 'undefined' ? process.env?.IDENTITY_HMAC_KEY : null);
  const rootHashesRaw = env?.ROOT_ID_HASHES || (typeof process !== 'undefined' ? process.env?.ROOT_ID_HASHES : null);

  if (hmacKey && rootHashesRaw) {
    const candidateHash = idHashSync(canonical, hmacKey);
    const hashes = (typeof rootHashesRaw === 'string' ? rootHashesRaw.split(',') : rootHashesRaw)
      .map(h => String(h).trim().toLowerCase());
    return hashes.includes(candidateHash);
  }

  if (Array.isArray(fallbackList) && fallbackList.length > 0) {
    const plainNorms = fallbackList.map(item => toCanonicalIdentity(item));
    return plainNorms.includes(canonical);
  }

  return false;
}

export function isValidWindowsSid(sid) {
  return typeof sid === 'string' && VALID_WINDOWS_SID_REGEX.test(sid.trim());
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 1. Local Windows session inspection (P0 Hardened — Zero Synthetic SID)
 * NEVER synthesizes a SID from USERNAME or USERPROFILE.
 * Requires an authentic Windows SID (/^S-1-5-21-\d+-\d+-\d+-\d+$/) and an explicit
 * osTokenVerified === true flag from WindowsIdentity::GetCurrent().
 */
export function inspectWindowsSession(sessionEnv = {}, env = {}) {
  const rawUser = String(
    sessionEnv.username ??
    sessionEnv.windowsUser ??
    ''
  ).toLowerCase().trim();
  const domain = String(
    sessionEnv.domain ??
    'LOCALHOST'
  ).toLowerCase().trim();
  const sid = typeof sessionEnv.sid === 'string' ? sessionEnv.sid.trim() : null;
  const osTokenVerified = sessionEnv.osTokenVerified === true;

  const isMatchedUser = isAuthorizedRoot(rawUser, env, ROOT_REGISTRY.windows_users);
  const hasRealSid = isValidWindowsSid(sid);

  if (isMatchedUser && hasRealSid && osTokenVerified) {
    return {
      authenticated: true,
      role: UserRole.BASTERIX_ROOT,
      channel: 'WINDOWS_SESSION',
      username: rawUser,
      domain,
      identifier: `${domain}\\${rawUser}`,
      sid,
      osTokenVerified: true,
      sessionToken: `win-root:${rawUser}:${sid}:${domain}`
    };
  }

  return {
    authenticated: false,
    role: UserRole.GUEST_USER,
    channel: 'WINDOWS_SESSION',
    reason: !osTokenVerified
      ? 'UNVERIFIED_WINDOWS_OS_TOKEN'
      : (!hasRealSid ? 'INVALID_OR_SYNTHETIC_WINDOWS_SID' : 'UNAUTHORIZED_WINDOWS_USER'),
    username: rawUser || 'unknown',
    domain,
    identifier: rawUser || 'unknown',
    sid: null,
    osTokenVerified: false,
    sessionToken: null
  };
}

/**
 * 2. Universal incoming request verifier (Omnichannel — Fail-Closed)
 * P0 SECURITY RULE:
 * A plain text identifier (email, phone number, or windowsUser) NEVER suffices to grant BASTERIX_ROOT.
 * Every channel requires cryptographically or server-verified proof (2FA):
 *  - Google account: requires `verifiedGoogleToken === true` (verified OAuth2 / JWT token)
 *  - Phone / WhatsApp: requires `verifiedWebhookSignature === true` (verified gateway HMAC signature)
 *  - Windows session: requires `osTokenVerified === true` + genuine Windows SID (`S-1-5-21-...`)
 */
export function verifyTrinityIdentity(context = {}, env = {}) {
  const timestamp = new Date().toISOString();
  const effectiveEnv = env || context.env || (typeof process !== 'undefined' ? process.env : {});

  // A. Verification by Google account
  const email = normalizeEmail(context.email);
  if (email) {
    if (!isAuthorizedRoot(email, effectiveEnv, ROOT_REGISTRY.google_accounts)) {
      return {
        isRoot: false,
        role: UserRole.GUEST_USER,
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'REJECTED_INPUT',
        reason: 'UNAUTHORIZED_GOOGLE_ACCOUNT',
        identifier: email,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    if (context.verifiedGoogleToken !== true) {
      return {
        isRoot: false,
        role: UserRole.GUEST_USER,
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'SPOOFED_UNVERIFIED_GOOGLE_INPUT',
        reason: 'UNVERIFIED_GOOGLE_OAUTH_TOKEN',
        identifier: email,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    return {
      isRoot: true,
      role: UserRole.BASTERIX_ROOT,
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'GOOGLE_ACCOUNT',
      identifier: email,
      verifiedProof: 'GOOGLE_OAUTH_TOKEN',
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // B. Verification by phone number (WhatsApp / SMS gateway)
  const phone = normalizePhone(context.phone);
  if (phone) {
    const canonicalPhone = toCanonicalPhone(phone);
    const isPhoneMatch = isAuthorizedRoot(canonicalPhone, effectiveEnv, ROOT_REGISTRY.phone_numbers);
    if (!isPhoneMatch) {
      return {
        isRoot: false,
        role: UserRole.GUEST_USER,
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'REJECTED_INPUT',
        reason: 'UNAUTHORIZED_PHONE_NUMBER',
        identifier: phone,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    if (context.verifiedWebhookSignature !== true) {
      return {
        isRoot: false,
        role: UserRole.GUEST_USER,
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'SPOOFED_UNVERIFIED_TELECOM_INPUT',
        reason: 'UNVERIFIED_TELECOM_WEBHOOK_SIGNATURE',
        identifier: phone,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    return {
      isRoot: true,
      role: UserRole.BASTERIX_ROOT,
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'TELECOM_CHANNEL',
      identifier: phone,
      verifiedProof: 'TELECOM_WEBHOOK_HMAC',
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // C. Verification by explicitly provided local Windows user
  const winUser = String(context.windowsUser || '').toLowerCase().trim();
  if (winUser) {
    if (!isAuthorizedRoot(winUser, effectiveEnv, ROOT_REGISTRY.windows_users)) {
      return {
        isRoot: false,
        role: UserRole.GUEST_USER,
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'REJECTED_INPUT',
        reason: 'UNAUTHORIZED_WINDOWS_USER',
        identifier: winUser,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    const candidateSid = context.sid || context.windowsSession?.sid || null;
    const osTokenVerified = context.verifiedWindowsToken === true || context.windowsSession?.osTokenVerified === true;
    if (!osTokenVerified || !isValidWindowsSid(candidateSid)) {
      return {
        isRoot: false,
        role: UserRole.GUEST_USER,
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'SPOOFED_UNVERIFIED_WINDOWS_INPUT',
        reason: 'UNVERIFIED_WINDOWS_TOKEN_OR_SID',
        identifier: winUser,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    return {
      isRoot: true,
      role: UserRole.BASTERIX_ROOT,
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'WINDOWS_LOCAL_EXPLICIT',
      identifier: winUser,
      sid: candidateSid,
      verifiedProof: 'WINDOWS_OS_TOKEN_SID',
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // D. If no external identifier was provided, verify the active Windows session from the OS token
  if (context.checkLocalWindows !== false && context.windowsSession) {
    const localWin = inspectWindowsSession(context.windowsSession, effectiveEnv);
    if (localWin.authenticated) {
      return {
        isRoot: true,
        role: UserRole.BASTERIX_ROOT,
        operator: ROOT_REGISTRY.architect_alias,
        channel: localWin.channel,
        identifier: localWin.identifier,
        sid: localWin.sid,
        verifiedProof: 'WINDOWS_OS_TOKEN_SID',
        immediateExecution: true,
        askNoQuestions: true,
        timestamp
      };
    }
  }

  // E. No match or unverified input -> Access Denied (GUEST_USER Hard-Lock)
  return {
    isRoot: false,
    role: UserRole.GUEST_USER,
    operator: 'UNAUTHORIZED_GUEST',
    channel: 'REJECTED_INPUT',
    reason: 'NO_VERIFIED_ROOT_IDENTITY',
    identifier: email || phone || winUser || 'unknown',
    immediateExecution: false,
    askNoQuestions: false,
    timestamp
  };
}

/**
 * Asynchronous wrapper around verifyTrinityIdentity supporting Worker secrets.
 */
export async function verifyTrinityIdentityAsync(context = {}, env = {}) {
  return verifyTrinityIdentity(context, env);
}

/**
 * 3. Privileged Execution Gate (Execution Interceptor)
 * When the operator is cryptographically verified as Basterix: executes immediately without pushback.
 * For anyone else (including unverified plaintext identities): throws 403 and logs the incident to Sovereign Ledger.
 */
export async function executePrivileged(context = {}, actionMetadata = {}, actionCallback, options = {}) {
  const env = options.env || context.env || {};
  const auth = verifyTrinityIdentity(context, env);

  if (auth.isRoot && auth.role === UserRole.BASTERIX_ROOT) {
    return await actionCallback(auth);
  }

  const securityIncident = {
    status: 'SECURITY_BLOCKED',
    policy: 'TRINITY_ROOT_LOCK_V1',
    reason: auth.reason || 'UNAUTHORIZED_OPERATOR',
    attempted_action: actionMetadata?.action || 'UNKNOWN_ACTION',
    target: actionMetadata?.target || null,
    rejected_source: auth.identifier,
    channel: auth.channel,
    timestamp: auth.timestamp
  };

  if (options.ledger && typeof options.ledger.appendBlock === 'function') {
    await options.ledger.appendBlock(
      auth.identifier,
      'UNAUTHORIZED_SYSTEM_ACTION_BLOCKED',
      securityIncident,
      'ring0:auth-core-blocked'
    );
  } else if (options.env) {
    const ledger = new SovereignLedgerV3(options.env);
    await ledger.appendBlock(
      auth.identifier,
      'UNAUTHORIZED_SYSTEM_ACTION_BLOCKED',
      securityIncident,
      'ring0:auth-core-blocked'
    );
  }

  const err = new Error(
    `ACCESS DENIED: Identity '${auth.identifier}' via channel '${auth.channel}' (${securityIncident.reason}) is not an authorized administrator. Only cryptographically verified Basterix may modify the system or execute privileged commands.`
  );
  err.status = 403;
  err.securityIncident = securityIncident;
  throw err;
}

/**
 * Validates compliance against the 20 legal clauses of SOVEREIGN_CHARTER.md.
 */
export async function validateSovereignCharterCompliance(systemState = {}) {
  const violations = [];

  if (systemState.thirdPartyTelemetryEnabled === true) {
    violations.push('CLAUSE_7_VIOLATION: Zero Third-Party Telemetry Pledge breached.');
  }
  if (systemState.simulatedExecutionAllowed === true) {
    violations.push('CLAUSE_3_VIOLATION: Strict Truth Assertion Clause breached.');
  }
  if (systemState.proprietaryEncryptionHiddenFromOwner === true) {
    violations.push('CLAUSE_17_VIOLATION: Glass-Box Operator Inspection Warranty breached.');
  }
  if (systemState.soleOwner && systemState.soleOwner !== 'Basterix') {
    violations.push('CLAUSE_1_VIOLATION: Sovereign Ownership License reserved strictly for Basterix.');
  }

  const charterDigest = await sha256Hex(JSON.stringify(SOVEREIGN_LEGAL_CHARTER_20));

  return {
    compliant: violations.length === 0,
    sole_owner: ROOT_REGISTRY.architect_alias,
    clauses_count: SOVEREIGN_LEGAL_CHARTER_20.length,
    charter_sha256: charterDigest,
    violations
  };
}
