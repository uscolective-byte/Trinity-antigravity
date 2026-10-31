/**
 * OMNIDEV STUDIO DIAGNOSTICS & SELF-HEALING MODULE (Pillar 5 / P1)
 * Analyzuje stack trace chyby v OmniDev Studio, izoluje padajúce závislosti
 * a generuje opravný patch, ktorý vyžaduje Ring 0 autorizáciu vlastníka Basterix.
 */

import { SovereignLockMiddleware } from './sovereign-lock.js';

export function diagnoseOmniDevStackTrace(rawStack = '') {
  const stack = String(rawStack || '');
  const lines = stack.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const errorHeader = lines[0] || 'Unknown OmniDev Error';

  // Extrakcia súboru, riadku a stĺpca z prvého relevantného rámca
  const frameMatch = stack.match(/(?:at\s+.*?\(?|@)((?:[a-zA-Z]:\\|\/|file:\/\/)[^\s:)]+):(\d+):(\d+)/);
  const missingModuleMatch = stack.match(/Cannot find (?:module|package) ['"]([^'"]+)['"]/i) ||
    stack.match(/Error:\s*Missing dependency ['"]([^'"]+)['"]/i);

  return {
    module: 'OmniDev Studio',
    diagnosed: true,
    error_summary: errorHeader,
    failing_file: frameMatch ? frameMatch[1] : null,
    failing_line: frameMatch ? Number(frameMatch[2]) : null,
    failing_column: frameMatch ? Number(frameMatch[3]) : null,
    isolated_dependency: missingModuleMatch ? missingModuleMatch[1] : null,
    remediation_type: missingModuleMatch ? 'INSTALL_OR_ISOLATE_DEPENDENCY' : 'SOURCE_PATCH_REQUIRED',
    raw_stack_preserved: stack,
    diagnosed_at: new Date().toISOString()
  };
}

export async function proposeOmniDevRecoveryPatch({
  env = {},
  stackTrace = '',
  proposedGitDiff = '',
  targetFile = 'Trinity/src/omnidev-studio.js',
  operatorIdentity = '',
  verifiedSession = false,
  basterixManualConsent = false,
  basterixEscalationApproved = false,
  consentEnvelope = null,
  signingSecret = null
} = {}) {
  const diagnosis = diagnoseOmniDevStackTrace(stackTrace);
  const lock = new SovereignLockMiddleware(env);

  const authResult = await lock.authorizeCodeMutation({
    operatorIdentity,
    verifiedSession,
    isAutonomousSubagent: false,
    basterixManualConsent,
    basterixEscalationApproved,
    consentEnvelope,
    signingSecret,
    gitDiff: proposedGitDiff,
    filePath: targetFile,
    source: 'internal',
    processTree: ['omnidev-recovery-engine']
  });

  if (!authResult.authorized) {
    return {
      applied: false,
      status: 'AWAITING_BASTERIX_APPROVAL',
      diagnosis,
      security_gate: authResult
    };
  }

  return {
    applied: true,
    status: 'RECOVERY_PATCH_AUTHORIZED',
    diagnosis,
    security_gate: authResult
  };
}
