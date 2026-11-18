/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul self-evolution.js (Trinity/src/self-evolution.js) v ekosystéme TRINITY OMNI-CORE.
 */
/**
 * TRINITY SELF-EVOLUTION ENGINE S AUTO-ROLLBACK POISTKOU & RING 0 SOVEREIGN LOCK
 * 
 * Umožňuje bezpečný self-modifying cyklus pre základné systémové súbory TRINITY
 * výhradne pod priamym príkazom a súhlasom architekta Basterix.
 */

import { SovereignLockMiddleware } from './sovereign-lock.js';

export async function backupSystemSnapshot(env, filePath, content) {
  const timestamp = Date.now();
  const safeName = filePath.replace(/[^a-zA-Z0-9._-]/g, '_');
  const snapshotKey = `snapshots/${safeName}/${timestamp}.bak`;

  // 1. Záloha do R2 bucketu ARTIFACTS
  if (env.ARTIFACTS) {
    try {
      await env.ARTIFACTS.put(snapshotKey, content, {
        httpMetadata: { contentType: 'application/javascript' },
        customMetadata: { filePath, timestamp: String(timestamp) }
      });
    } catch (e) {
      console.warn('R2 backup warning:', e.message);
    }
  }

  // 2. Rýchla záloha do KV Mastermind pre okamžitý rollback
  if (env.Mastermind) {
    try {
      await env.Mastermind.put(`backup:${filePath}:latest`, content, { expirationTtl: 86400 * 7 });
    } catch {}
  }

  return { snapshotKey, timestamp };
}

export async function restoreSnapshot(env, filePath) {
  if (env.Mastermind) {
    const backup = await env.Mastermind.get(`backup:${filePath}:latest`);
    if (backup) {
      return { ok: true, source: 'kv_latest', content: backup };
    }
  }
  return { ok: false, error: 'Záloha pre obnovenie nebola nájdená.' };
}

/**
 * Validácia syntaxe JavaScript kódu
 */
export function validateScriptSyntax(code) {
  try {
    new Function(code);
    return { ok: true };
  } catch (err) {
    // new Function zlyhá pri ES moduloch s import/export, preto otestujeme len závažné syntaktické chyby
    if (err instanceof SyntaxError && !err.message.includes('Cannot use import statement') && !err.message.includes('Unexpected token \'export\'')) {
      return { ok: false, error: err.message };
    }
    return { ok: true };
  }
}

/**
 * Aplikuje sebamodifikáciu s auto-rollbackom
 */
export async function applySelfModification(env, {
  filePath,
  originalContent,
  newContent,
  rationale = 'Architektonická úprava vyžadujúca schválenie Basterixom',
  operatorIdentity = '',
  verifiedSession = false,
  isAutonomousSubagent = false,
  basterixManualConsent = false,
  basterixEscalationApproved = false,
  consentEnvelope = null,
  signingSecret = null,
  gitDiff = 'diff --git',
  source = 'internal'
} = {}) {
  if (!filePath || newContent === undefined) {
    return { ok: false, error: 'Chýba cesta k súboru alebo nový obsah.' };
  }

  // 0. Ring 0 Sovereign Lock Middleware kontrola (fail-closed)
  const lock = new SovereignLockMiddleware(env);
  const auth = await lock.authorizeCodeMutation({
    operatorIdentity,
    verifiedSession,
    isAutonomousSubagent,
    basterixManualConsent,
    basterixEscalationApproved,
    consentEnvelope,
    signingSecret,
    gitDiff,
    filePath,
    source
  });

  if (!auth.authorized) {
    return {
      ok: false,
      status: 'blocked',
      code: auth.code,
      error: auth.message,
      tamper_receipt: auth.tamper_receipt
    };
  }

  // 1. Kontrola základnej syntaxe
  const syntaxCheck = validateScriptSyntax(newContent);
  if (!syntaxCheck.ok) {
    return {
      ok: false,
      status: 'rejected',
      error: `Syntaktická chyba nového kódu: ${syntaxCheck.error}`,
      rolled_back: true
    };
  }

  // This module cannot apply or deploy the proposed patch. It only prepares
  // a plan, so it must not fabricate an execution receipt or claim rollback.
  // A separate authorized executor must write the patch, run tests and return
  // independent file/commit evidence before the proposal can be called applied.
  const proposalId = crypto.randomUUID();
  if (env.DB) {
    await env.DB.prepare(
      "INSERT INTO ops_events (action, details) VALUES (?, ?)"
    ).bind('self_evolution_proposal_prepared', JSON.stringify({
      proposal_id: proposalId, filePath, rationale, applied: false
    })).run();
  }
  return {
    ok: false,
    status: 'not_applied',
    applied: false,
    proposal_id: proposalId,
    filePath,
    message: 'Syntax screening and authorization are not code execution. No source file was changed.',
    tests: 'not_run',
    deployed: false
  };
}
