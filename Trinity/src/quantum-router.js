/**
 * @module TRINITY_OMNI_CORE
 * @subsystem QUANTUM_ROUTER
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module quantum-router.js (Trinity/src/quantum-router.js).
 * Implements intent superposition and observer collapse under the 3-6-9 specification.
 */

/**
 * @typedef {Object} IntentState
 * @property {string} agent - Identifier of the candidate execution path
 * @property {number} score - Probability amplitude / intent score
 * @property {string} [rationale] - Rationale for amplitude assignment
 */

/**
 * @typedef {IntentState[]} IntentWaveFunction
 */

export class QuantumRouter {
  /**
   * Builds the input intent wave function ψ = ∑ c_i |agent_i⟩ prior to observation.
   * @param {string} userInput - User input text
   * @param {object} [context] - Session and observer context
   * @param {object} [config] - Weight configuration from resonance.json
   * @returns {IntentWaveFunction} Superposition wave function
   */
  static buildWaveFunction(userInput, context = {}, config = {}) {
    const raw = String(userInput || '').trim().toLowerCase();
    const weights = config?.weights || {
      coder: 1.2,
      planner: 1.0,
      auditor: 1.1,
      sentinel: 1.5,
      chat: 0.8
    };

    /** @type {IntentWaveFunction} */
    const candidates = [
      { agent: 'chat', score: 0.25 * (weights.chat || 1.0) },
      { agent: 'planner', score: 0.20 * (weights.planner || 1.0) },
      { agent: 'coder', score: 0.20 * (weights.coder || 1.0) },
      { agent: 'auditor', score: 0.20 * (weights.auditor || 1.0) },
      { agent: 'sentinel', score: 0.15 * (weights.sentinel || 1.0) }
    ];

    if (!raw) {
      return candidates;
    }

    // Shift amplitudes based on resonance of input attributes (Slovak + English)
    for (const c of candidates) {
      if (c.agent === 'coder' && /kód|code|funkci|function|oprav|fix|implementuj|implement|build|script|skript|pr|vetv|git|css|html|ts|js|worker/i.test(raw)) {
        c.score += 0.55;
      }
      if (c.agent === 'planner' && /plán|plan|architekt|architect|rozpad|postup|stratégi|strategy|krok|step|fáz|phase|road/i.test(raw)) {
        c.score += 0.50;
      }
      if (c.agent === 'auditor' && /test|over|skontroluj|verify|audit|analýz|analy|log|výsledok|result|dôkaz|proof|chyb|error|bug/i.test(raw)) {
        c.score += 0.52;
      }
      if (c.agent === 'sentinel' && /bezpečnos|security|token|kľúč|key|secret|heslo|password|access|auth|lock|d1|kv/i.test(raw)) {
        c.score += 0.60;
      }
      if (c.agent === 'chat' && (raw.length < 40 || /ahoj|dobrý|pomoc|kto si|ďakujem|hello|hi|help|who are you|thanks/i.test(raw))) {
        c.score += 0.45;
      }
    }

    // Normalize probabilities: ∑ score = 1.0
    const total = candidates.reduce((acc, cur) => acc + cur.score, 0) || 1.0;
    return candidates.map(c => ({
      agent: c.agent,
      score: Number((c.score / total).toFixed(4))
    }));
  }

  /**
   * Collapses the wave function (Observer Effect).
   * Selects the highest-probability, most appropriate execution path for the input.
   * @param {IntentWaveFunction} psi - Input wave function
   * @returns {IntentState} Collapsed intent state
   */
  static collapseIntent(psi) {
    if (!Array.isArray(psi) || psi.length === 0) {
      return { agent: 'chat', score: 1.0 };
    }
    const sorted = [...psi].sort((a, b) => b.score - a.score);
    return sorted[0];
  }

  /**
   * Full quantum intent routing.
   * @param {string} userInput
   * @param {object} [context]
   * @param {object} [config]
   */
  static route(userInput, context = {}, config = {}) {
    const psi = this.buildWaveFunction(userInput, context, config);
    const collapsed = this.collapseIntent(psi);
    return {
      psi,
      collapsed,
      collapsedAgent: collapsed.agent,
      confidence: collapsed.score,
      timestamp: new Date().toISOString()
    };
  }
}
