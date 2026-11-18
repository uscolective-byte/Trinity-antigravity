/**
 * Trinity Omni-Core v11.3 - L4_SOVEREIGN_LEDGER
 * Truth Policy Assertion & Zero-Hallucination Guard
 * @author Basterix (Root Architect) & Antigravity
 * @license Sovereign Irrevocable Covenant
 */
import { TapSovereignSigner } from './tap-signer.js';

export class TruthPolicyViolation extends Error {
  constructor(code, details) {
    super(`[TRUTH_POLICY_VIOLATION | ${code}] ${details}`);
    this.name = 'TruthPolicyViolation';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }
}

export class TruthAssertionEngine {
  /**
   * Striktná verifikácia exekúcie nástroja pred zápisom do histórie.
   */
  static async assertExecution(executionResult, env = {}) {
    if (!executionResult || typeof executionResult !== 'object') {
      throw new TruthPolicyViolation('INVALID_EXECUTION_REPORT', 'Execution report is missing.');
    }
    const { toolName, exitCode, stdout = '', stderr = '', rawOutput = '' } = executionResult;

    // 1. Invariant: Nulový návratový kód
    if (exitCode !== 0) {
      throw new TruthPolicyViolation(
        'NON_ZERO_EXIT_CODE',
        `Nástroj ${toolName} zlyhal s kódom ${exitCode}. Chybový výstup: ${stderr || 'Neznáma chyba'}`
      );
    }

    // 2. Invariant: Detekcia zakázaných textových simulácií a placeholdrov
    const forbiddenPatterns = [
      /\/\/\s*todo/i,
      /\/\*.*sem vložte.*?\*\//is,
      /<placeholder>/i,
      /mock_response/i,
      /not implemented/i
    ];

    const contentToCheck = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(contentToCheck)) {
        throw new TruthPolicyViolation(
          'PLACEHOLDER_DETECTED',
          `Výstup nástroja ${toolName} obsahuje zakázaný neúplný kód alebo placeholdery: ${pattern}`
        );
      }
    }

    // A successful exit code is only an execution report, not proof of truth.
    // Signing a report authenticates its bytes; it does not verify the real world.
    if (typeof env.TAP_PRIVATE_KEY !== 'string' || !env.TAP_PRIVATE_KEY.length) {
      throw new TruthPolicyViolation('TAP_SIGNING_KEY_REQUIRED', 'No signing secret configured.');
    }
    if (typeof toolName !== 'string' || !toolName.trim()) {
      throw new TruthPolicyViolation('INVALID_TOOL_NAME', 'Execution report has no tool name.');
    }
    const assertedAt = Date.now();
    const reportBytes = new TextEncoder().encode(
      JSON.stringify({ toolName, exitCode, stdout, stderr, rawOutput, assertedAt })
    );
    const digestBuffer = await crypto.subtle.digest('SHA-256', reportBytes);
    const executionHash = Array.from(new Uint8Array(digestBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const signature = await TapSovereignSigner.signPayload(env.TAP_PRIVATE_KEY, executionHash);

    return {
      status: 'EXECUTION_REPORT_SIGNED',
      verified: false,
      verificationStatus: 'requires_independent_evidence',
      executionHash,
      signature,
      assertedAt
    };
  }

  /**
   * Overenie tvrdenia modelu voči stavu Cloudflare D1 databázy
   */
  static async assertDatabaseState(db, sqlQuery, expectedRowCount = null) {
    try {
      if (!db || typeof db.prepare !== 'function') {
        throw new TruthPolicyViolation('D1_NOT_CONFIGURED', 'D1 databáza nie je inicializovaná.');
      }
      const result = await db.prepare(sqlQuery).all();
      if (expectedRowCount !== null && result.results.length !== expectedRowCount) {
        throw new TruthPolicyViolation(
          'STATE_MISMATCH',
          `Očakávaný počet riadkov (${expectedRowCount}) nezodpovedá realite v D1 (${result.results.length}).`
        );
      }
      return result.results;
    } catch (err) {
      if (err instanceof TruthPolicyViolation) throw err;
      throw new TruthPolicyViolation('D1_QUERY_FAILED', err.message);
    }
  }
}
