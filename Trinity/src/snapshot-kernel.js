/**
 * @module TRINITY_SNAPSHOT_KERNEL
 * @subsystem ZERO_COLD_START_AND_TIERED_MEMORY
 * @author Basterix (Root Architect) & Antigravity
 * @license Sovereign Irrevocable Covenant
 * @description Modul snapshot-kernel.js v ekosystéme TRINITY OMNI-CORE v11.3 / v12.0.
 * Zabezpečuje Zero-Cold-Start snapshotting cez KV/Memory a vrstvenú L1/L2 pamäťovú hierarchiu.
 */

export class EdgeSnapshotStore {
  constructor(kvBinding = null) {
    this.kv = kvBinding;
    this.localCache = new Map();
  }

  async saveSnapshot(scope, state, ttlSeconds = 900) {
    const payload = {
      scope,
      data: state,
      timestamp: Date.now(),
      version: '12.0.0'
    };
    const key = `snapshot:${scope}`;
    this.localCache.set(key, { payload, expires: Date.now() + ttlSeconds * 1000 });

    if (this.kv && typeof this.kv.put === 'function') {
      try {
        await this.kv.put(key, JSON.stringify(payload), { expirationTtl: ttlSeconds });
      } catch (err) {
        console.warn(`[Snapshot Store] Nepodarilo sa zapísať snapshot do KV:`, err);
      }
    }
    return payload;
  }

  async rehydrateSnapshot(scope, maxAgeMs = 900_000) {
    const key = `snapshot:${scope}`;
    const start = Date.now();

    // 1. Skús lokálnu in-memory L1 cache (< 1 ms)
    const local = this.localCache.get(key);
    if (local && Date.now() < local.expires) {
      return {
        hydrated: true,
        source: 'memory_l1',
        data: local.payload.data,
        ageMs: Date.now() - local.payload.timestamp,
        latencyMs: Date.now() - start
      };
    }

    // 2. Skús Cloudflare KV L2 (< 5 ms)
    if (this.kv && typeof this.kv.get === 'function') {
      try {
        const raw = await this.kv.get(key);
        if (raw) {
          const payload = JSON.parse(raw);
          const age = Date.now() - payload.timestamp;
          if (age <= maxAgeMs) {
            this.localCache.set(key, { payload, expires: Date.now() + (maxAgeMs - age) });
            return {
              hydrated: true,
              source: 'kv_l2',
              data: payload.data,
              ageMs: age,
              latencyMs: Date.now() - start
            };
          }
        }
      } catch {}
    }

    return { hydrated: false, source: null, data: null, latencyMs: Date.now() - start };
  }
}

/**
 * TieredMemoryManager: L1 (Fast Local / Session) + L2 (Cold Vector / Knowledge)
 */
export class TieredMemoryManager {
  constructor({ localStore = new Map(), remoteStore = null } = {}) {
    this.localStore = localStore;
    this.remoteStore = remoteStore;
  }

  async put(key, value, tags = []) {
    const record = { key, value, tags, savedAt: Date.now() };
    this.localStore.set(key, record);

    if (this.remoteStore && typeof this.remoteStore.put === 'function') {
      try {
        await this.remoteStore.put(key, JSON.stringify(record));
      } catch {}
    }
    return record;
  }

  async get(key) {
    // 1. Najprv L1 hľadanie
    if (this.localStore.has(key)) {
      return { found: true, tier: 'L1_LOCAL', record: this.localStore.get(key) };
    }

    // 2. Fallback na L2
    if (this.remoteStore && typeof this.remoteStore.get === 'function') {
      try {
        const raw = await this.remoteStore.get(key);
        if (raw) {
          const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
          this.localStore.set(key, record); // Populate L1 cache
          return { found: true, tier: 'L2_COLD', record };
        }
      } catch {}
    }

    return { found: false, tier: null, record: null };
  }
}
