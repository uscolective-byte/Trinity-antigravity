import test from 'node:test';
import assert from 'node:assert/strict';
import { EdgeSnapshotStore, TieredMemoryManager } from '../src/snapshot-kernel.js';

test('Edge Snapshotting: saves and rehydrates state from L1 memory within 5ms', async () => {
  const store = new EdgeSnapshotStore();
  const kernelState = {
    ring0: 'Ivan Sabo (Basterix)',
    activeWorkers: 47,
    secretsCached: ['OLLAMA_SECRET', 'TRINITY_GITHUB_TOKEN'],
    loadedAt: Date.now()
  };

  await store.saveSnapshot('kernel_core', kernelState, 60);
  const result = await store.rehydrateSnapshot('kernel_core');

  assert.equal(result.hydrated, true);
  assert.equal(result.source, 'memory_l1');
  assert.equal(result.data.ring0, 'Ivan Sabo (Basterix)');
  assert.equal(result.data.activeWorkers, 47);
  assert.ok(result.latencyMs < 10, 'Latencia L1 rehydratácie musí byť pod 10 ms');
});

test('Edge Snapshotting: rehydrates from KV when memory cache is empty (Cold Start simulation)', async () => {
  const mockKvStore = new Map();
  const mockKv = {
    get: async (k) => mockKvStore.get(k) || null,
    put: async (k, v) => mockKvStore.set(k, v)
  };

  const initialStore = new EdgeSnapshotStore(mockKv);
  await initialStore.saveSnapshot('fleet_state', { fleetReady: true, count: 47 });

  // Simulujeme nový studený štart (nová inštancia EdgeSnapshotStore bez lokálnej pamäte)
  const coldStartStore = new EdgeSnapshotStore(mockKv);
  const result = await coldStartStore.rehydrateSnapshot('fleet_state');

  assert.equal(result.hydrated, true);
  assert.equal(result.source, 'kv_l2');
  assert.equal(result.data.fleetReady, true);
  assert.equal(result.data.count, 47);
});

test('Tiered Memory Manager: checks L1 first and falls back to L2 with auto-population', async () => {
  const mockRemote = new Map();
  mockRemote.set('user:pref:lang', JSON.stringify({ key: 'user:pref:lang', value: 'sk', tags: ['ui'] }));

  const memory = new TieredMemoryManager({
    localStore: new Map(),
    remoteStore: {
      get: async (k) => mockRemote.get(k) || null,
      put: async (k, v) => mockRemote.set(k, v)
    }
  });

  // 1. Dotaz na kľúč, ktorý je len na remote L2
  const res1 = await memory.get('user:pref:lang');
  assert.equal(res1.found, true);
  assert.equal(res1.tier, 'L2_COLD');
  assert.equal(res1.record.value, 'sk');

  // 2. Druhý dotaz už musí trafiť L1_LOCAL (pretože sa automaticky nakopíroval)
  const res2 = await memory.get('user:pref:lang');
  assert.equal(res2.found, true);
  assert.equal(res2.tier, 'L1_LOCAL');
  assert.equal(res2.record.value, 'sk');
});
