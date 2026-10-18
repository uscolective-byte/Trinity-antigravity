/**
 * Trinity Quantum Core Engine
 * Matematický aparát pre superpozíciu myšlienkových stavov a vlnový kolaps.
 */

export class QuantumCoreEngine {
  /**
   * Kolabuje superpozíciu dimenzionálnych stavov do jedného manifestovaného textu.
   * @param {Array<{dimension: string, content: string, phaseAngle: number, amplitude: number}>} states
   * @param {{exists?: boolean}} [options]
   */
  static collapseSuperposition(states, options = { exists: true }) {
    if (!Array.isArray(states) || states.length === 0) {
      return {
        manifestedText: '',
        dominantDimension: 'none',
        coherenceScore: 0,
        destructiveInterferenceCount: 0
      };
    }

    let totalWeight = 0;
    let dominantState = states[0];
    let maxEffectiveMagnitude = -1;
    let destructiveInterferences = 0;

    // Fázový súčet pre koherentné interferencie
    let sumReal = 0;
    let sumImag = 0;

    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      const theta = Number(s.phaseAngle) || 0;
      const amp = Math.max(0, Math.min(Number(s.amplitude) || 0, 1.0));

      const real = amp * Math.cos(theta);
      const imag = amp * Math.sin(theta);

      sumReal += real;
      sumImag += imag;
      totalWeight += amp;

      // Kontrola deštruktívnej interferencie voči ostatným stavom
      for (let j = i + 1; j < states.length; j++) {
        const otherTheta = Number(states[j].phaseAngle) || 0;
        const phaseDiff = Math.abs(theta - otherTheta) % (2 * Math.PI);
        // Ak sú stavy v protifáze (blízko PI), nastáva deštruktívna interferencia
        if (Math.abs(phaseDiff - Math.PI) < Math.PI / 3) {
          destructiveInterferences++;
        }
      }

      // Výpočet dominantného stavu (syntéza má prirodzene najvyššiu prioritu, inak najväčšia amplitúda)
      const magnitude = Math.sqrt(real * real + imag * imag);
      const bonus = s.dimension === 'synthesis' ? 0.3 : 0;
      const effectiveMagnitude = magnitude + bonus;

      if (effectiveMagnitude > maxEffectiveMagnitude) {
        maxEffectiveMagnitude = effectiveMagnitude;
        dominantState = s;
      }
    }

    // Celková koherencia interferenčného poľa (0.0 - 1.0)
    const netMagnitude = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    const coherenceScore = totalWeight > 0
      ? Math.min(1.0, Math.max(0.0, Number((netMagnitude / totalWeight).toFixed(4))))
      : 0;

    return {
      manifestedText: dominantState.content || '',
      dominantDimension: dominantState.dimension || 'unknown',
      coherenceScore,
      destructiveInterferenceCount: destructiveInterferences
    };
  }
}
