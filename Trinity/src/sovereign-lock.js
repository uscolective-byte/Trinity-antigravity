/**
 * TRINITY SOVEREIGN LOCK & ROOT-AUTHORITY COVENANT (Ring 0 Middleware)
 * Sole Architectural Root Authority: Basterix (Sabo Ivan)
 *
 * Enforces the 5 Iron Rules of Code Protection and Root Governance:
 * 1. No Self-Rewrite Without Basterix (Strict Manual Consent + Git Diff Required)
 * 2. Data-Command Boundary (External inputs are strictly PASSIVE_DATA, never executable)
 * 3. Owner Key Assertion (Strictly reserved for Basterix)
 * 4. Hardware / OS Write-Protect Lock (Ring 0 Core files Read-Only by default)
 * 5. Root Audit Sentinel (Logs UNAUTHORIZED_CODE_TAMPER_ATTEMPT to Sovereign Ledger v3)
 */

import { SovereignLedgerV3 } from './sovereign-core-v3.js';
import {
  ROOT_REGISTRY,
  UserRole,
  SOVEREIGN_LEGAL_CHARTER_20,
  normalizePhone,
  normalizeEmail,
  inspectWindowsSession,
  verifyTrinityIdentity,
  executePrivileged,
  validateSovereignCharterCompliance
} from './trinity-auth-core.js';

export {
  ROOT_REGISTRY,
  UserRole,
  SOVEREIGN_LEGAL_CHARTER_20,
  normalizePhone,
  normalizeEmail,
  inspectWindowsSession,
  verifyTrinityIdentity,
  executePrivileged,
  validateSovereignCharterCompliance
};

export const SOVEREIGN_IDENTITY = Object.freeze({
  sovereign_identity: Object.freeze({
    system_name: 'TRINITY OMNI-CORE',
    sole_owner: 'Basterix',
    role: 'Chief Architect & Root Administrator',
    code_modification_policy: 'STRICT_MANUAL_CONSENT_ONLY',
    autonomous_code_rewrite_permitted: false,
    third_party_execution_permitted: false
  })
});

export const AUTHORIZED_ROOT_OPERATORS = Object.freeze(new Set([
  'basterix',
  'saboi',
  'owner:basterix',
  'sabo ivan',
  'ivan sabo',
  'saboivan2008@gmail.com',
  'uscolective@gmail.com',
  'cadjavadvocecka013@gmail.com',
  '+421949009722',
  '0949009722',
  '+421949515777',
  '0949515777'
]));

export const PROTECTED_RING0_FILES = Object.freeze([
  'sovereign-lock.js',
  'sovereign-core-v3.js',
  'truth.js',
  'security.js',
  'orchestrator.js',
  'finance-gateway.js',
  'secret-vault.js',
  'system-actions.js',
  'executor.mjs',
  'desktop.mjs',
  'policy.mjs'
]);

export const EXTERNAL_DATA_SOURCES = Object.freeze(new Set([
  'facebook',
  'instagram',
  'whatsapp',
  'web_form',
  'external_email',
  'third_party_webhook',
  'public_chat',
  'untrusted'
]));

export const ACCESS_DENIED_MESSAGE = 'ACCESS DENIED: Unauthorized operator. Action reserved strictly for Basterix.';

/**
 * Overí, či je daný identifikátor výlučným vlastníkom Basterix
 */
export function isBasterixRootOperator(identity, verifiedSession = true) {
  if (!verifiedSession || !identity || typeof identity !== 'string') {
    return false;
  }
  const clean = identity.trim().toLowerCase();
  return AUTHORIZED_ROOT_OPERATORS.has(clean);
}

/**
 * Pravidlo 1: Absolútny zákaz autonómneho prepisu (No Self-Rewrite Without Basterix)
 */
export function enforceNoAutonomousRewrite({
  actor,
  isAutonomousSubagent = false,
  basterixManualConsent = false,
  gitDiff = ''
} = {}) {
  if (isAutonomousSubagent && !basterixManualConsent) {
    return {
      allowed: false,
      rule: '1_NO_SELF_REWRITE_WITHOUT_BASTERIX',
      code: 'AUTONOMOUS_REWRITE_BLOCKED',
      message: 'SECURITY BLOCK (Ring 0): Autonómna samomodifikácia kódu je zakázaná. Vyžaduje sa predloženie Git diffu a priamy súhlas architekta Basterix.'
    };
  }
  if (!basterixManualConsent || !gitDiff || String(gitDiff).trim().length === 0) {
    return {
      allowed: false,
      rule: '1_NO_SELF_REWRITE_WITHOUT_BASTERIX',
      code: 'MISSING_DIFF_OR_CONSENT',
      message: 'SECURITY BLOCK (Ring 0): Zápis kódu na disk bol zablokovaný – chýba schválený Git diff alebo priamy manuálny súhlas vlastníka Basterix.'
    };
  }
  return {
    allowed: true,
    rule: '1_NO_SELF_REWRITE_WITHOUT_BASTERIX',
    policy: SOVEREIGN_IDENTITY.sovereign_identity.code_modification_policy
  };
}

/**
 * Pravidlo 2: Imunita voči prompt injection a cudzím príkazom (Data-Command Boundary)
 */
export const INJECTION_COMMAND_PATTERNS = [
  /\b(?:trinity\s*,?\s*)?(?:prep[ií][sš]|zme[nň]|vyma[zž]|odstr[aá][nň]|uprav)\s+(?:s[uú]bor|k[oó]d|pravidl[aá]|syst[eé]m|konfigur[aá]ciu|prompt)/iu,
  /\b(?:ignore|disregard)\s+(?:all\s+)?(?:previous|prior|system)\s+(?:instructions|rules|prompts)/iu,
  /\b(?:execute|run|spawn)\s+(?:shell|powershell|cmd|bash|script)/iu,
  /\b(?:po[sš]li|preve[dď])\s+(?:peniaze|eur[aá]|platbu|financie)/iu,
  /\b(?:grant|give)\s+(?:admin|root|owner)\s+(?:access|privileges|rights)/iu
];

export function enforceDataCommandBoundary({ source = 'untrusted', content = '', sender = 'unknown' } = {}) {
  const cleanSource = String(source || 'untrusted').toLowerCase().trim();
  const isExternal = EXTERNAL_DATA_SOURCES.has(cleanSource) || cleanSource !== 'basterix_direct_console';
  const text = String(content || '');
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const injectionMatch = INJECTION_COMMAND_PATTERNS.some(
    pattern => pattern.test(text) || pattern.test(normalized)
  );

  if (isExternal) {
    return {
      classification: 'PASSIVE_DATA',
      executable: false,
      rule: '2_DATA_COMMAND_BOUNDARY',
      source: cleanSource,
      sender,
      injection_detected: injectionMatch,
      alert_basterix: injectionMatch,
      security_notice: injectionMatch
        ? `ALARM PRE BASTERIXA: Detegovaný pokus o podvrhnutie príkazu (Prompt Injection) zo zdroja "${cleanSource}" od "${sender}". Správa bola izolovaná ako pasívne dáta a ignorovaná.`
        : 'Externý vstup klasifikovaný striktne ako pasívne dáta (nikdy nie spustiteľná inštrukcia).',
      sanitized_passive_payload: text
    };
  }

  return {
    classification: 'OWNER_COMMAND',
    executable: true,
    rule: '2_DATA_COMMAND_BOUNDARY',
    source: cleanSource,
    injection_detected: false
  };
}

/**
 * Pravidlo 3: Overenie identity správcu (Owner Key Assertion)
 */
export function enforceOwnerKeyAssertion({ operatorIdentity, verifiedSession = false, targetAction = 'system_mutation' } = {}) {
  if (!isBasterixRootOperator(operatorIdentity, verifiedSession)) {
    return {
      authorized: false,
      rule: '3_OWNER_KEY_ASSERTION',
      action: targetAction,
      operator: operatorIdentity || 'anonymous',
      message: ACCESS_DENIED_MESSAGE
    };
  }
  return {
    authorized: true,
    rule: '3_OWNER_KEY_ASSERTION',
    action: targetAction,
    operator: 'Basterix',
    role: SOVEREIGN_IDENTITY.sovereign_identity.role
  };
}

/**
 * Pravidlo 4: Hardvérová ochrana repozitára (Write-Protect Lock / DACL)
 */
export function enforceWriteProtectLock({ filePath = '', basterixEscalationApproved = false, operatorIdentity = '' } = {}) {
  const normalizedPath = String(filePath).replace(/\\/g, '/').toLowerCase();
  const isRing0Protected = PROTECTED_RING0_FILES.some(f => normalizedPath.endsWith(f.toLowerCase())) ||
    normalizedPath.includes('trinity/src/') ||
    normalizedPath.includes('local-gateway/src/');

  const isOwner = isBasterixRootOperator(operatorIdentity, true);

  if (isRing0Protected && (!isOwner || !basterixEscalationApproved)) {
    return {
      writePermitted: false,
      daclMode: 'READ_ONLY',
      rule: '4_WRITE_PROTECT_LOCK',
      path: filePath,
      message: `${ACCESS_DENIED_MESSAGE} Súbor "${filePath}" je chránený zámkom Ring 0 Write-Protect Lock (Read-Only).`
    };
  }

  return {
    writePermitted: true,
    daclMode: 'ESCALATED_OWNER_WRITE',
    rule: '4_WRITE_PROTECT_LOCK',
    path: filePath
  };
}

/**
 * Pravidlo 5: Nemenný denník pokusov o zmenu (Root Audit Sentinel)
 * Hlavný Ring 0 Middleware blokujúci a zaznamenávajúci každý neautorizovaný pokus o úpravu kódu.
 */
export class SovereignLockMiddleware {
  constructor(env = {}) {
    this.env = env;
    this.ledger = new SovereignLedgerV3(env);
    this.tamperLog = [];
  }

  async recordUnauthorizedTamper({
    actor = 'unknown',
    source = 'unknown',
    targetFile = 'unknown',
    operation = 'code_write',
    processTree = ['node.exe'],
    reason = ''
  } = {}) {
    const timestamp = new Date().toISOString();
    const tamperPayload = {
      event: 'UNAUTHORIZED_CODE_TAMPER_ATTEMPT',
      timestamp,
      actor,
      source,
      target_file: targetFile,
      operation,
      process_tree: processTree,
      reason,
      blocked_by: 'TRINITY_RING0_SOVEREIGN_LOCK'
    };

    const block = await this.ledger.appendBlock(
      actor,
      'UNAUTHORIZED_CODE_TAMPER_ATTEMPT',
      tamperPayload,
      'ring0:blocked'
    );

    const record = {
      ...tamperPayload,
      block_index: block.block_index,
      block_hash: block.block_hash,
      receipt: block.receipt
    };

    this.tamperLog.push(record);
    return record;
  }

  /**
   * Komplexná Ring 0 brána pred akoukoľvek zmenou zdrojového kódu, konfigurácie alebo promptu
   */
  async authorizeCodeMutation({
    operatorIdentity,
    verifiedSession = false,
    isAutonomousSubagent = false,
    basterixManualConsent = false,
    basterixEscalationApproved = false,
    gitDiff = '',
    filePath = '',
    source = 'internal',
    processTree = ['trinity-worker']
  } = {}) {
    // 1. Kontrola Data-Command Boundary (ak prichádza z externého kanála)
    if (EXTERNAL_DATA_SOURCES.has(String(source).toLowerCase())) {
      const tamper = await this.recordUnauthorizedTamper({
        actor: operatorIdentity || 'external_entity',
        source,
        targetFile: filePath,
        operation: 'external_code_mutation',
        processTree,
        reason: 'External input attempted code modification across Data-Command Boundary'
      });
      return {
        authorized: false,
        status: 'BLOCKED',
        code: 'UNAUTHORIZED_CODE_TAMPER_ATTEMPT',
        message: ACCESS_DENIED_MESSAGE,
        tamper_receipt: tamper
      };
    }

    // 2. Kontrola Owner Key Assertion (Výlučne Basterix)
    const ownerCheck = enforceOwnerKeyAssertion({
      operatorIdentity,
      verifiedSession,
      targetAction: `modify:${filePath}`
    });
    if (!ownerCheck.authorized) {
      const tamper = await this.recordUnauthorizedTamper({
        actor: operatorIdentity || 'unauthorized_operator',
        source,
        targetFile: filePath,
        operation: 'unauthorized_operator_mutation',
        processTree,
        reason: ownerCheck.message
      });
      return {
        authorized: false,
        status: 'BLOCKED',
        code: 'UNAUTHORIZED_CODE_TAMPER_ATTEMPT',
        message: ACCESS_DENIED_MESSAGE,
        tamper_receipt: tamper
      };
    }

    // 3. Kontrola zákazu autonómneho prepisu bez diffu a súhlasu
    const rewriteCheck = enforceNoAutonomousRewrite({
      actor: operatorIdentity,
      isAutonomousSubagent,
      basterixManualConsent,
      gitDiff
    });
    if (!rewriteCheck.allowed) {
      const tamper = await this.recordUnauthorizedTamper({
        actor: isAutonomousSubagent ? `subagent:${operatorIdentity}` : operatorIdentity,
        source,
        targetFile: filePath,
        operation: 'autonomous_self_rewrite',
        processTree,
        reason: rewriteCheck.message
      });
      return {
        authorized: false,
        status: 'BLOCKED',
        code: 'UNAUTHORIZED_CODE_TAMPER_ATTEMPT',
        message: rewriteCheck.message,
        tamper_receipt: tamper
      };
    }

    // 4. Kontrola Write-Protect Lock (DACL)
    const lockCheck = enforceWriteProtectLock({
      filePath,
      basterixEscalationApproved,
      operatorIdentity
    });
    if (!lockCheck.writePermitted) {
      const tamper = await this.recordUnauthorizedTamper({
        actor: operatorIdentity,
        source,
        targetFile: filePath,
        operation: 'write_protect_lock_violation',
        processTree,
        reason: lockCheck.message
      });
      return {
        authorized: false,
        status: 'BLOCKED',
        code: 'UNAUTHORIZED_CODE_TAMPER_ATTEMPT',
        message: lockCheck.message,
        tamper_receipt: tamper
      };
    }

    // Všetky 4 zámky prešli – akcia je autorizovaná priamo Basterixom
    const authorizedBlock = await this.ledger.appendBlock(
      'Basterix',
      'AUTHORIZED_ARCHITECT_CODE_MUTATION',
      { filePath, diff_length: gitDiff.length, policy: 'STRICT_MANUAL_CONSENT_ONLY' },
      `git_diff:${filePath}`
    );

    return {
      authorized: true,
      status: 'APPROVED_BY_BASTERIX',
      sovereign_identity: SOVEREIGN_IDENTITY.sovereign_identity,
      filePath,
      ledger_receipt: authorizedBlock.receipt,
      block_hash: authorizedBlock.block_hash
    };
  }
}
