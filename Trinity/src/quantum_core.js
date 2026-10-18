/**
 * Trinity Quantum Core Engine
 * Matematický aparát pre superpozíciu myšlienkových stavov, fázovú interferenciu a vlnový kolaps.
 */

export class QuantumCoreEngine {
  /**
   * Vypočíta interferenčný faktor medzi dvoma stavmi na základe amplitúd a fázového posunu.
   * @param {{amplitude: number, phaseAngle: number}} stateA
   * @param {{amplitude: number, phaseAngle: number}} stateB
   * @returns {number} Rozsah [0, 1]
   */
  static computeInterference(stateA, stateB) {
    const ampA = Math.max(0, Math.min(Number(stateA?.amplitude) || 0, 1.0));
    const ampB = Math.max(0, Math.min(Number(stateB?.amplitude) || 0, 1.0));
    const thetaA = Number(stateA?.phaseAngle) || 0;
    const thetaB = Number(stateB?.phaseAngle) || 0;
    const phaseDiff = thetaA - thetaB;
    const cosDiff = Math.cos(phaseDiff);
    // 1 = plná konštruktívna interferencia (fázy zhodné), 0 = plná deštruktívna (protifáza PI)
    const normalizedPhase = (1 + cosDiff) / 2;
    return Math.max(0, Math.min(1, Number((normalizedPhase * Math.min(ampA, ampB)).toFixed(4))));
  }

  /**
   * Kolabuje superpozíciu stavov do výsledného manifestovaného textu.
   * @param {Array<{dimension: string, content: string, phaseAngle: number, amplitude: number}>} states
   * @param {{exists?: boolean, pathReport?: string}} [empiricalAnchor]
   */
  static collapseSuperposition(states, empiricalAnchor = { exists: true }) {
    // 1️⃣ Empirický veto: fyzická realita má absolútnu prednosť
    if (!empiricalAnchor.exists && empiricalAnchor.pathReport) {
      return {
        dominantDimension: "empiria",
        manifestedText: `[Ontologický kolaps zlyhal]: Fyzická realita vyvrátila predpoklad (${empiricalAnchor.pathReport}).`,
        coherenceScore: 0,
        destructiveInterferenceCount: 1,
      };
    }

    // 2️⃣ Odstránenie šumu (amplitúda < 0.2)
    const viable = (states || []).filter(s => (Number(s.amplitude) || 0) >= 0.2);
    if (viable.length === 0) {
      return {
        dominantDimension: "none",
        manifestedText: "Žiadna koherentná hypotéza – kolaps do prázdna.",
        coherenceScore: 0,
        destructiveInterferenceCount: 0,
      };
    }

    // 3️⃣ Výpočet deštruktívnych interferencií medzi tézou a antitézou
    let destructiveInterferenceCount = 0;
    const thesis = viable.find(s => s.dimension === "thesis");
    const antithesis = viable.find(s => s.dimension === "antithesis");

    if (thesis && antithesis) {
      const interference = this.computeInterference(thesis, antithesis);
      // Ak je interferencia < 0.25 → silná deštruktívna interferencia
      if (interference < 0.25) destructiveInterferenceCount++;
    }

    // 4️⃣ Dominantná dimenzia – najvyššia amplitúda
    const dominant = viable.reduce((best, cur) =>
      (Number(cur.amplitude) || 0) > (Number(best.amplitude) || 0) ? cur : best
    );

    // 5️⃣ Koherenčné skóre – priemer amplitúd všetkých viable stavov
    const coherenceScore =
      viable.reduce((sum, s) => sum + (Number(s.amplitude) || 0), 0) / viable.length;

    return {
      dominantDimension: dominant.dimension || "unknown",
      manifestedText: dominant.content || "",
      coherenceScore: Number(coherenceScore.toFixed(3)),
      destructiveInterferenceCount,
    };
  }
}
