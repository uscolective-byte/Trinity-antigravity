import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QuantumCoreEngine} from '../src/quantum_core.js';
import {TeleologicalMemoryEngine} from '../src/teleological_memory.js';
import {processTeleologicalPrompt} from '../src/quantum_pipeline.js';

test('QuantumCoreEngine: collapse superposition handles thesis, antithesis, and synthesis', () => {
  const states = [
    { dimension: 'thesis', content: 'Priame riešenie', phaseAngle: 0, amplitude: 0.85 },
    { dimension: 'antithesis', content: 'Kritika a riziká', phaseAngle: Math.PI, amplitude: 0.70 },
    { dimension: 'synthesis', content: 'Zjednotená syntéza', phaseAngle: Math.PI / 4, amplitude: 0.95 }
  ];

  const result = QuantumCoreEngine.collapseSuperposition(states);
  assert.equal(result.dominantDimension, 'synthesis');
  assert.equal(result.manifestedText, 'Zjednotená syntéza');
  assert.ok(result.coherenceScore > 0 && result.coherenceScore <= 1.0);
  assert.ok(result.destructiveInterferenceCount >= 1, 'Protifáza 0 a PI vytvára deštruktívnu interferenciu');
});

test('TeleologicalMemoryEngine: recalls core invariants', async () => {
  const mockDb = {
    prepare: () => ({
      all: async () => ({
        results: [
          { key: 'profil/basterix', value: 'Sabo Ivan (Basterix) je tvorca a hlavny architekt.' }
        ]
      })
    })
  };

  const engine = new TeleologicalMemoryEngine(mockDb, null, null);
  const invariants = await engine.recallTeleologicalState('Ako ďalej s projektom Trinity?', 'session-1');
  assert.ok(Array.isArray(invariants));
  assert.ok(invariants.some(i => i.includes('Sabo Ivan')));
});

test('processTeleologicalPrompt: executes full dialectical quantum pipeline', async () => {
  let aiCalls = 0;
  const mockEnv = {
    AI: {
      run: async (model, input) => {
        aiCalls++;
        const sys = input.messages[0].content;
        if (sys.includes('Téza')) return { response: 'Téza: Systém navrhuje priamu optimalizáciu.' };
        if (sys.includes('Antitéza')) return { response: 'Antitéza: Treba overiť pamäťové limity a bezpečnosť.' };
        if (sys.includes('Syntéza')) return { response: 'Syntéza: Implementujeme optimalizáciu so striktným overením limitov.' };
        return { response: 'Definitívna odpoveď' };
      }
    },
    DB: {
      prepare: () => ({
        all: async () => ({ results: [] })
      })
    },
    BRIDGE_SHARED_SECRET: 'trinity-bridge-secret-123'
  };

  const res = await processTeleologicalPrompt(
    mockEnv,
    'Analyzuj stabilitu ekosystému',
    'sess-42',
    true // bridgeActive
  );

  assert.equal(res.bridgeVerified, true);
  assert.equal(res.dominantDimension, 'synthesis');
  assert.equal(res.manifestedText, 'Syntéza: Implementujeme optimalizáciu so striktným overením limitov.');
  assert.ok(res.coherenceScore > 0);
  assert.equal(aiCalls, 3, 'Malo prebehnúť volanie Tézy, Antitézy a Syntézy');
});
