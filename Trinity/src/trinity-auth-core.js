/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTH_GATE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Zjednotené autorizačné jadro (Windows OS SID + Google OAuth + Telecom HMAC) s fail-closed ochranou pre výlučného architekta Basterixa.
 */
/**
 * TRINITY UNIFIED AUTHORIZATION CORE (trinity-auth-core.js)
 * Zjednotené autorizačné jadro spájajúce:
 * 1. Windows Auth Gate (lokálne účty 'saboi', 'basterix' + autentický Windows SID zo systémového tokenu)
 * 2. Google Identity Verifier ('saboivan2008@gmail.com', 'uscolective@gmail.com', 'cadjavadvocecka013@gmail.com' + verifiedGoogleToken)
 * 3. Telecom / WhatsApp / SMS Channel ('+421949009722', '0949009722', '+421949515777', '0949515777' + verifiedWebhookSignature)
 * 4. Root vs Guest Gate (Fail-Closed):
 *    - Overený Basterix s kryptografickým/OS dôkazom (BASTERIX_ROOT) -> OKAMŽITÁ EXEKÚCIA BEZ OTÁZOK
 *    - Akýkoľvek neoverený textový vstup alebo cudzí používateľ (GUEST_USER) -> OKAMŽITÝ HARD-LOCK + zápis do Sovereign Ledgeru
 */

import { SovereignLedgerV3 } from './sovereign-core-v3.js';

export const UserRole = Object.freeze({
  BASTERIX_ROOT: 'BASTERIX_ROOT',
  GUEST_USER: 'GUEST_USER'
});

/**
 * Prísny formát skutočného Windows Security Identifier (SID) z autentifikovaného OS tokenu.
 * Nikdy sa nesmie syntetizovať z názvu používateľa ani premenných prostredia.
 */
export const VALID_WINDOWS_SID_REGEX = /^S-1-5-21-\d+-\d+-\d+-\d+$/;

/**
 * TRINITY ROOT REGISTRY
 * Nemenný register overených identít patriacich výhradne Basterixovi.
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
 * 20 Právnych licencií a doložiek legality (TRINITY LEGAL & COMPLIANCE FRAMEWORK)
 */
export const SOVEREIGN_LEGAL_CHARTER_20 = Object.freeze([
  { id: 1, code: 'SOVEREIGN_OWNERSHIP_LICENSE', title: 'Licencia výlučného zvrchovaného vlastníctva' },
  { id: 2, code: 'DUAL_OPEN_CORE_PROPRIETARY', title: 'Dvojitá softvérová licencia Trinity Open-Core / Proprietary' },
  { id: 3, code: 'STRICT_TRUTH_ASSERTION_CLAUSE', title: 'Doložka o absolútnej pravdivosti a absencii simulácie' },
  { id: 4, code: 'FINANCIAL_PROXY_MANDATE', title: 'Mandátna zmluva o správe financií a zástupcovstve' },
  { id: 5, code: 'EU_AI_ACT_EXEMPTION', title: 'Vyhlásenie o súlade a výnimke podľa EU AI Act (Article 2(6))' },
  { id: 6, code: 'GDPR_DATA_CONTROLLER_ACCORD', title: 'Protokol o spracovaní osobných údajov (GDPR)' },
  { id: 7, code: 'ZERO_THIRD_PARTY_TELEMETRY', title: 'Deklarácia nulovej telemetrie tretích strán' },
  { id: 8, code: 'PERPETUAL_NON_CIRCUMVENTION', title: 'Zmluva o mlčanlivosti a neobchádzaní' },
  { id: 9, code: 'CRYPTOGRAPHIC_AUDIT_TREATY', title: 'Zmluva o kryptografickom audite' },
  { id: 10, code: 'THIRD_PARTY_LIABILITY_SHIELD', title: 'Doložka o obmedzení zodpovednosti voči tretím stranám' },
  { id: 11, code: 'DIGITAL_IDENTITY_DECLARATION', title: 'Vyhlásenie o digitálnej identite a zastupovaní' },
  { id: 12, code: 'HOST_COMPUTE_AUTHORIZATION', title: 'Dohoda o užívaní lokálneho hardvéru' },
  { id: 13, code: 'AI_TRACEABILITY_COVENANT', title: 'Záväzok o auditovateľnosti kódu a nevratnosti logov' },
  { id: 14, code: 'EULA_OPERATOR_BOUNDARY_TERMS', title: 'Licencia koncového operátora a vymedzenie hraníc' },
  { id: 15, code: 'AI_GENERATED_IP_PROTECTION', title: 'Doložka o ochrane duševného vlastníctva (Work for Hire)' },
  { id: 16, code: 'ANTI_MALWARE_SAFE_EXECUTION', title: 'Protokol o bezpečnom vykonávaní a prevencii škodlivého kódu' },
  { id: 17, code: 'OPERATOR_INSPECTION_WARRANTY', title: 'Záruka 100 % otvorenosti voči reverznému inžinierstvu (Glass-Box)' },
  { id: 18, code: 'MULTI_AGENT_DELEGATION_ACCORD', title: 'Dohoda o delegovanej zodpovednosti v Multi-Agent roly' },
  { id: 19, code: 'EMERGENCY_KILLSWITCH_ACCORD', title: 'Protokol o bezpečnom núdzovom odstavení (< 100 ms)' },
  { id: 20, code: 'PERPETUAL_SOVEREIGNTY_COVENANT', title: 'Večný neodvolateľný sľub zvrchovanosti' }
]);

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
 * 1. Lokálna Windows inšpekcia (P0 Hardened — Zero Synthetic SID)
 * NIKDY nevytvára syntetický SID z USERNAME alebo USERPROFILE.
 * Vyžaduje autentický Windows SID (/^S-1-5-21-\d+-\d+-\d+-\d+$/) a explicitný príznak
 * osTokenVerified === true zo systémového prístupového tokenu WindowsIdentity::GetCurrent().
 */
export function inspectWindowsSession(sessionEnv = {}) {
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

  const isMatchedUser = ROOT_REGISTRY.windows_users.includes(rawUser);
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
 * 2. Univerzálny overovač prichádzajúcich požiadaviek (Omnichannel — Fail-Closed)
 * P0 BEZPEČNOSTNÉ PRAVIDLO:
 * Samotný textový reťazec (email, telefónne číslo alebo windowsUser) NIKDY nestačí na udelenie BASTERIX_ROOT!
 * Každý kanál vyžaduje kryptograficky alebo serverovo overený dôkaz:
 *  - Google účet: vyžaduje `verifiedGoogleToken === true` (overený OAuth2 / JWT token)
 *  - Telefón / WhatsApp: vyžaduje `verifiedWebhookSignature === true` (overený HMAC podpis brány)
 *  - Windows relácia: vyžaduje `osTokenVerified === true` + skutočný Windows SID (`S-1-5-21-...`)
 */
export function verifyTrinityIdentity(context = {}) {
  const timestamp = new Date().toISOString();

  // A. Kontrola podľa Google účtu
  const email = normalizeEmail(context.email);
  if (email) {
    if (!ROOT_REGISTRY.google_accounts.includes(email)) {
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

  // B. Kontrola podľa telefónneho čísla (WhatsApp / SMS brána)
  const phone = normalizePhone(context.phone);
  if (phone) {
    const incomingVariants = canonicalPhoneVariants(phone);
    const isPhoneMatch = ROOT_REGISTRY.phone_numbers.some(entry =>
      incomingVariants.includes(normalizePhone(entry))
    );
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

  // C. Kontrola podľa explicitne zadaného lokálneho Windows používateľa
  const winUser = String(context.windowsUser || '').toLowerCase().trim();
  if (winUser) {
    if (!ROOT_REGISTRY.windows_users.includes(winUser)) {
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

  // D. Ak nie je zadaný externý identifikátor, over aktívnu Windows reláciu zo systémového tokenu
  if (context.checkLocalWindows !== false && context.windowsSession) {
    const localWin = inspectWindowsSession(context.windowsSession);
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

  // E. Žiadna zhoda alebo neoverený vstup -> Zákaz prístupu (GUEST_USER Hard-Lock)
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
 * 3. Hlavná exekučná brána (Execution Interceptor)
 * Keď je operátor overený Basterix: koná okamžite a bez otázok.
 * Pre kohokoľvek iného (vrátane neoverených textových identít): vyhodí chybu a zapíše incident do Sovereign Ledgeru.
 */
export async function executePrivileged(context = {}, actionMetadata = {}, actionCallback, options = {}) {
  const auth = verifyTrinityIdentity(context);

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
    `ACCESS DENIED: Identita '${auth.identifier}' cez kanál '${auth.channel}' (${securityIncident.reason}) nie je autorizovaný administrátor. Modifikovať systém a spúšťať príkazy môže výlučne kryptograficky overený Basterix.`
  );
  err.status = 403;
  err.securityIncident = securityIncident;
  throw err;
}

/**
 * Validácia súladu s 20 právnymi doložkami SOVEREIGN_CHARTER.md
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
