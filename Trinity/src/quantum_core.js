/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module quantum_core.js (Trinity/src/quantum_core.js) in the TRINITY OMNI-CORE ecosystem.
 */
import { QCA } from './qca.js';
export { QCA };

export class QuantumCoreEngine {
  /**
   * Executes the Quantum Cognitive Accelerator (QCA) of the Trinity / Aura meta-layer.
   * @param {string} query
   * @param {object} [context]
   * @param {object} [env]
   */
  static async accelerate(query, context = {}, env = null) {
    return await QCA(query, context, env);
  }

  /**
   * Computes the interference factor between two states based on amplitudes and phase difference.
   * @param {{amplitude: number, phaseAngle: number}} stateA
   * @param {{amplitude: number, phaseAngle: number}} stateB
   * @returns {number} Range [0, 1]
   */
  static computeInterference(stateA, stateB) {
    const ampA = Math.max(0, Math.min(Number(stateA?.amplitude) || 0, 1.0));
    const ampB = Math.max(0, Math.min(Number(stateB?.amplitude) || 0, 1.0));
    const thetaA = Number(stateA?.phaseAngle) || 0;
    const thetaB = Number(stateB?.phaseAngle) || 0;
    const phaseDiff = thetaA - thetaB;
    const cosDiff = Math.cos(phaseDiff);
    // 1 = full constructive interference (aligned phases), 0 = full destructive interference (antiphase PI)
    const normalizedPhase = (1 + cosDiff) / 2;
    return Math.max(0, Math.min(1, Number((normalizedPhase * Math.min(ampA, ampB)).toFixed(4))));
  }

  /**
   * Collapses a superposition of states into the resulting manifested text.
   * @param {Array<{dimension: string, content: string, phaseAngle: number, amplitude: number}>} states
   * @param {{exists?: boolean, pathReport?: string}} [empiricalAnchor]
   */
  static collapseSuperposition(states, empiricalAnchor = { exists: true }) {
    // 1️⃣ Empirical veto: physical reality takes absolute precedence
    if (!empiricalAnchor.exists && empiricalAnchor.pathReport) {
      return {
        dominantDimension: "empiria",
        manifestedText: `[Ontological collapse failed]: Physical reality refuted the assumption (${empiricalAnchor.pathReport}).`,
        coherenceScore: 0,
        destructiveInterferenceCount: 1,
      };
    }

    // 2️⃣ Noise removal (amplitude < 0.2)
    const viable = (states || []).filter(s => (Number(s.amplitude) || 0) >= 0.2);
    if (viable.length === 0) {
      return {
        dominantDimension: "none",
        manifestedText: "No coherent hypothesis — collapsed into void.",
        coherenceScore: 0,
        destructiveInterferenceCount: 0,
      };
    }

    // 3️⃣ Compute destructive interference between thesis and antithesis
    let destructiveInterferenceCount = 0;
    const thesis = viable.find(s => s.dimension === "thesis");
    const antithesis = viable.find(s => s.dimension === "antithesis");

    if (thesis && antithesis) {
      const interference = this.computeInterference(thesis, antithesis);
      // If interference < 0.25 -> strong destructive interference
      if (interference < 0.25) destructiveInterferenceCount++;
    }

    // 4️⃣ Dominant dimension — highest amplitude
    const dominant = viable.reduce((best, cur) =>
      (Number(cur.amplitude) || 0) > (Number(best.amplitude) || 0) ? cur : best
    );

    // 5️⃣ Coherence score — mean amplitude of all viable states
    const coherenceScore =
      viable.reduce((sum, s) => sum + (Number(s.amplitude) || 0), 0) / viable.length;

    return {
      dominantDimension: dominant.dimension || "unknown",
      manifestedText: dominant.content || "",
      coherenceScore: Number(coherenceScore.toFixed(3)),
      destructiveInterferenceCount,
    };
  }

  /**
   * Parallel reasoning: evaluates 3 to 7 parallel reasoning branches and selects the best one.
   * @param {Array<{id: string, hypothesis: string, amplitude: number, phaseAngle: number, tags?: string[]}>} branches
   * @param {{preference?: 'creative'|'analytical'|'balanced'}} [options]
   */
  static parallelReasoning(branches = [], options = { preference: 'creative' }) {
    if (!Array.isArray(branches) || branches.length === 0) {
      return { selectedBranch: null, coherence: 0, branchCount: 0 };
    }

    const scoredBranches = branches.map((b, idx) => {
      const amp = Math.max(0.1, Math.min(1.0, Number(b.amplitude) || 0.7));
      const phase = Number(b.phaseAngle) || (idx * (Math.PI / 4));
      // For creative preference, boost branches with innovative tags or divergent phase
      const isCreativeBonus = options.preference === 'creative' && (b.tags?.includes('innovative') || b.tags?.includes('creative') || (phase > 0 && phase < Math.PI));
      const finalScore = Number((amp * (isCreativeBonus ? 1.25 : 1.0)).toFixed(4));
      return {
        ...b,
        calculatedScore: finalScore,
        phaseAngle: phase
      };
    });

    // Sort by score descending
    scoredBranches.sort((a, b) => b.calculatedScore - a.calculatedScore);
    const winner = scoredBranches[0];

    const avgCoherence = scoredBranches.reduce((acc, cur) => acc + cur.calculatedScore, 0) / scoredBranches.length;

    return {
      selectedBranch: winner,
      branchesEvaluated: scoredBranches.length,
      averageCoherence: Number(avgCoherence.toFixed(3)),
      manifestedSolution: winner.hypothesis,
      allRanked: scoredBranches.map(b => ({ id: b.id, score: b.calculatedScore, hypothesis: b.hypothesis }))
    };
  }

  /**
   * Multi-Agent Fusion: unifies specialist outputs (Guardian, Sentinel, Planner, Optimizer, Analyzer).
   * @param {Record<string, {content: string, confidence?: number}>} agentOutputs
   * @param {Record<string, number>} [weights]
   */
  static fuseAgentOutputs(agentOutputs = {}, weights = {}) {
    const roles = Object.keys(agentOutputs);
    if (roles.length === 0) {
      return { fusedContent: '', consensusScore: 0, contributingRoles: [] };
    }

    const defaultWeights = {
      guardian: 1.2,
      sentinel: 1.1,
      planner: 1.0,
      optimizer: 1.05,
      analyzer: 1.0,
      ...weights
    };

    let totalWeight = 0;
    const states = [];

    for (const [role, data] of Object.entries(agentOutputs)) {
      const weight = defaultWeights[role.toLowerCase()] || 1.0;
      totalWeight += weight;
      states.push({
        dimension: role,
        content: data.content || '',
        phaseAngle: (states.length * Math.PI) / (roles.length || 1),
        amplitude: Math.min(1.0, (Number(data.confidence) || 0.8) * (weight / 1.2))
      });
    }

    const collapse = this.collapseSuperposition(states);
    const consensusScore = Number((collapse.coherenceScore * (totalWeight / roles.length)).toFixed(3));

    // Synthesized consensus
    const fusedInsights = states.map(s => `[${s.dimension.toUpperCase()}]: ${s.content}`).join('\n');

    return {
      fusedContent: fusedInsights,
      consensusScore,
      dominantRole: collapse.dominantDimension,
      contributingRoles: roles,
      leadInsight: collapse.manifestedText
    };
  }

  /**
   * Error-Correction Layer: phase-corrects and removes flaws in a candidate solution draft.
   * @param {string} draft
   * @param {Array<{pattern: RegExp|string, fix: string, reason: string}>} corrections
   */
  static errorCorrectionLayer(draft = '', corrections = []) {
    let corrected = String(draft);
    const appliedFixes = [];

    for (const corr of corrections) {
      const regex = typeof corr.pattern === 'string' ? new RegExp(corr.pattern, 'gi') : corr.pattern;
      if (regex.test(corrected)) {
        corrected = corrected.replace(regex, corr.fix);
        appliedFixes.push({ reason: corr.reason, appliedAt: new Date().toISOString() });
      }
    }

    return {
      correctedOutput: corrected,
      fixesAppliedCount: appliedFixes.length,
      fixes: appliedFixes,
      clean: appliedFixes.length === 0
    };
  }
}

