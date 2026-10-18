import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QuantumCoreEngine} from '../src/quantum_core.js';
import {TeleologicalMemoryEngine} from '../src/teleological_memory.js';
import {processTeleologicalPrompt} from '../src/quantum_pipeline.js';

test('QuantumCoreEngine: computeInterference and collapseSuperposition with empirical veto', () => {
  const thesis = { dimension: 'thesis', content: 'Téza', phaseAngle: 0, amplitude: 0.85 };
  const antithesis = { dimension: 'antithesis', content: 'Antitéza', phaseAngle: Math.PI, amplitude: 0.70 };
  const synthesis = { dimension: 'synthesis', content: 'Syntéza', phaseAngle: Math.PI / 4, amplitude: 0.95 };

  // Výpočet interferencie medzi tézou a antitézou v protifáze PI
  const interf = QuantumCoreEngine.computeInterference(thesis, antithesis);
  assert.ok(interf < 0.25, 'V protifáze musí byť interferencia minimálna (< 0.25)');

  // Kolaps superpozície
  const collapse = QuantumCoreEngine.collapseSuperposition([thesis, antithesis, synthesis]);
  assert.equal(collapse.dominantDimension, 'synthesis');
  assert.equal(collapse.manifestedText, 'Syntéza');
  assert.ok(collapse.destructiveInterferenceCount >= 1);
  assert.ok(collapse.coherenceScore > 0 && collapse.coherenceScore <= 1.0);

  // Empirický veto test
  const veto = QuantumCoreEngine.collapseSuperposition([thesis], { exists: false, pathReport: 'Súbor nenájdený' });
  assert.equal(veto.dominantDimension, 'empiria');
  assert.ok(veto.manifestedText.includes('Súbor nenájdený'));
  assert.equal(veto.coherenceScore, 0);

  // Šumový test (amplitúda < 0.2)
  const noisy = QuantumCoreEngine.collapseSuperposition([{ dimension: 'noise', content: 'Šum', phaseAngle: 0, amplitude: 0.1 }]);
  assert.equal(noisy.dominantDimension, 'none');
});

test('TeleologicalMemoryEngine: coherence decay, validation and safe recall', async () => {
  const engine = new TeleologicalMemoryEngine(null, null, null);

  // Test výpočtu koherencie
  const now = Date.now();
  const freshCoherence = engine.calculateCurrentCoherence({ gravitationalWeight: 0.8, entropyRate: 0.05 }, now);
  assert.ok(freshCoherence >= 0.79 && freshCoherence <= 0.81);

  // Test validácie addMemory
  await assert.rejects(async () => {
    await engine.addMemory('cieľ', 'obsah', 'default', -0.5, 0.05);
  }, /weight must be in \[0,1\]/);

  await assert.rejects(async () => {
    await engine.addMemory('cieľ', 'obsah', 'default', 0.5, 1.5);
  }, /entropy must be in \[0,1\]/);

  // Test základného vyvolania invariantov
  const invariants = await engine.recallTeleologicalState('Základný dopyt');
  assert.ok(invariants.some(i => i.includes('Sabo Ivan')));
});

test('processTeleologicalPrompt: end-to-end telemetry and execution', async () => {
  let aiCalls = 0;
  const mockEnv = {
    AI: {
      run: async (model, input) => {
        aiCalls++;
        const sys = input.messages[0].content;
        if (sys.includes('Téza')) return { response: 'Téza: Priama implementácia.' };
        if (sys.includes('Antitéza')) return { response: 'Antitéza: Možné riziká a limity.' };
        if (sys.includes('Syntéza')) return { response: 'Syntéza: Bezpečná a otestovaná implementácia.' };
        return { response: 'Definitívna pravda' };
      }
    },
    DB: {
      prepare: () => ({
        all: async () => ({ results: [] })
      })
    },
    BRIDGE_SHARED_SECRET: 'trinity-bridge-secret-xyz'
  };

  const res = await processTeleologicalPrompt(
    mockEnv,
    'Analyzuj stav a bezpečnosť systému',
    'session-xyz',
    true
  );

  assert.equal(res.bridgeVerified, true);
  assert.equal(res.dominantDimension, 'synthesis');
  assert.equal(res.manifestedText, 'Syntéza: Bezpečná a otestovaná implementácia.');
  assert.ok(res.coherenceScore > 0);
  assert.equal(aiCalls, 3);
});
