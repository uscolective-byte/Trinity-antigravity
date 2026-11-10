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

    // 3. Výpočet kryptografického odtlačku reality (SHA-256)
    const encoder = new TextEncoder();
    const realityPayload = encoder.encode(`${toolName}:${exitCode}:${stdout}:${Date.now()}`);
    const digestBuffer = await crypto.subtle.digest('SHA-256', realityPayload);
    const realityHash = Array.from(new Uint8Array(digestBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 4. TAP Podpis reality
    const signature = await TapSovereignSigner.signPayload(
      env.TAP_PRIVATE_KEY || 'SOVEREIGN_RING0_KEY',
      realityHash
    );

    return {
      status: 'VERIFIED_REALITY',
      realityHash,
      signature,
      assertedAt: Date.now()
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
