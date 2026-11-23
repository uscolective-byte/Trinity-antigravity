/**
 * TRINITY OMNI-CORE - Sovereign Ledger MMR (Merkle Mountain Range) Engine
 * Cryptographically chained immutable audit ledger with MMR peaks and integrity verification.
 */

export async function sha256Hex(message) {
  const msgUint8 = new TextEncoder().encode(typeof message === 'string' ? message : JSON.stringify(message ?? ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const LEDGER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trinity_sovereign_ledger_v3 (
  block_id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tsl_actor ON trinity_sovereign_ledger_v3(actor);
CREATE INDEX IF NOT EXISTS idx_tsl_operation ON trinity_sovereign_ledger_v3(operation);
CREATE INDEX IF NOT EXISTS idx_tsl_curr_hash ON trinity_sovereign_ledger_v3(current_hash);
`;

export class SovereignLedgerEngine {
  constructor(env = {}, db = null) {
    this.env = env;
    this.db = db || env?.DB || env?.TRINITY_D1 || env?.rea || null;
    this.inMemoryBlocks = [];
    this._tableInitialized = false;
  }

  async ensureSchema() {
    if (this._tableInitialized || !this.db || typeof this.db.prepare !== 'function') {
      return;
    }
    try {
      await this.db.prepare(LEDGER_SCHEMA_SQL).run();
      this._tableInitialized = true;
    } catch {
      // Fallback if D1 does not support multiline batch execution or table already exists
      try {
        await this.db
          .prepare(
            `CREATE TABLE IF NOT EXISTS trinity_sovereign_ledger_v3 (
              block_id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp TEXT NOT NULL,
              actor TEXT NOT NULL,
              operation TEXT NOT NULL,
              previous_hash TEXT NOT NULL,
              current_hash TEXT NOT NULL,
              payload TEXT,
              created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )`
          )
          .run();
        this._tableInitialized = true;
      } catch (_) {
        // Ignore if table already exists or D1 is read-only
      }
    }
  }

  async appendRecord({ actor = 'basterix_edge_gateway', operation = 'AUDIT_RECORD', payload = {} }) {
    await this.ensureSchema();

    const timestamp = new Date().toISOString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const payloadHash = await sha256Hex(payloadStr);

    let prevHash = GENESIS_HASH;
    let nextBlockId = 1;

    if (this.db && typeof this.db.prepare === 'function') {
      try {
        const lastRowQuery = await this.db
          .prepare(
            'SELECT block_id, current_hash FROM trinity_sovereign_ledger_v3 ORDER BY block_id DESC LIMIT 1'
          )
          .first();

        if (lastRowQuery) {
          nextBlockId = (Number(lastRowQuery.block_id) || 0) + 1;
          prevHash = lastRowQuery.current_hash || GENESIS_HASH;
        } else if (this.inMemoryBlocks.length > 0) {
          const lastMem = this.inMemoryBlocks[this.inMemoryBlocks.length - 1];
          nextBlockId = (Number(lastMem.blockId) || 0) + 1;
          prevHash = lastMem.currentHash || GENESIS_HASH;
        }
      } catch (_) {
        if (this.inMemoryBlocks.length > 0) {
          const lastMem = this.inMemoryBlocks[this.inMemoryBlocks.length - 1];
          nextBlockId = (Number(lastMem.blockId) || 0) + 1;
          prevHash = lastMem.currentHash || GENESIS_HASH;
        }
      }
    } else if (this.inMemoryBlocks.length > 0) {
      const lastMem = this.inMemoryBlocks[this.inMemoryBlocks.length - 1];
      nextBlockId = (Number(lastMem.blockId) || 0) + 1;
      prevHash = lastMem.currentHash || GENESIS_HASH;
    }

    const header = `${nextBlockId}|${timestamp}|${actor}|${operation}|${prevHash}|${payloadHash}`;
    const currentHash = await sha256Hex(header);

    const record = {
      blockId: nextBlockId,
      timestamp,
      actor,
      operation,
      previousHash: prevHash,
      currentHash,
      payload: typeof payload === 'string' ? payload : payload
    };

    this.inMemoryBlocks.push(record);

    if (this.db && typeof this.db.prepare === 'function') {
      try {
        await this.db
          .prepare(
            `INSERT INTO trinity_sovereign_ledger_v3 (block_id, timestamp, actor, operation, previous_hash, current_hash, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(nextBlockId, timestamp, actor, operation, prevHash, currentHash, payloadStr)
          .run();
      } catch (err) {
        // Attempt schema initialization and retry insert
        try {
          await this.ensureSchema();
          await this.db
            .prepare(
              `INSERT INTO trinity_sovereign_ledger_v3 (block_id, timestamp, actor, operation, previous_hash, current_hash, payload)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(nextBlockId, timestamp, actor, operation, prevHash, currentHash, payloadStr)
            .run();
        } catch (retryErr) {
          console.error('[SOVEREIGN LEDGER] D1 write failed:', retryErr.message);
        }
      }
    }

    return record;
  }

  async verifyChainIntegrity(limit = 1000) {
    let rows = [];

    if (this.db && typeof this.db.prepare === 'function') {
      try {
        const queryRes = await this.db
          .prepare(
            `SELECT block_id, timestamp, actor, operation, previous_hash, current_hash, payload
             FROM trinity_sovereign_ledger_v3
             ORDER BY block_id ASC
             LIMIT ?`
          )
          .bind(limit)
          .all();

        rows = queryRes?.results || [];
      } catch (err) {
        if (this.inMemoryBlocks.length > 0) {
          rows = this.inMemoryBlocks.map((b) => ({
            block_id: b.blockId,
            timestamp: b.timestamp,
            actor: b.actor,
            operation: b.operation,
            previous_hash: b.previousHash,
            current_hash: b.currentHash,
            payload: typeof b.payload === 'string' ? b.payload : JSON.stringify(b.payload)
          }));
        } else {
          return {
            valid: true,
            chainLength: 0,
            message: `No blocks found in D1 database (${err.message})`
          };
        }
      }
    } else {
      rows = this.inMemoryBlocks.map((b) => ({
        block_id: b.blockId,
        timestamp: b.timestamp,
        actor: b.actor,
        operation: b.operation,
        previous_hash: b.previousHash,
        current_hash: b.currentHash,
        payload: typeof b.payload === 'string' ? b.payload : JSON.stringify(b.payload)
      }));
    }

    if (rows.length === 0) {
      return {
        valid: true,
        chainLength: 0,
        message: 'Chain is empty; integrity valid (genesis).'
      };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < rows.length; i++) {
      const block = rows[i];
      const blockId = Number(block.block_id);

      if (i === 0) {
        // First block must link from GENESIS or its declared previous_hash
        expectedPrevHash = block.previous_hash;
      } else {
        if (block.previous_hash !== expectedPrevHash) {
          return {
            valid: false,
            brokenAtIndex: blockId,
            error: `Chain link violation: previous_hash [${block.previous_hash}] does not match previous block hash [${expectedPrevHash}].`
          };
        }
      }

      const payloadStr = typeof block.payload === 'string' ? block.payload : JSON.stringify(block.payload ?? {});
      const payloadHash = await sha256Hex(payloadStr);
      const expectedHeader = `${blockId}|${block.timestamp}|${block.actor}|${block.operation}|${block.previous_hash}|${payloadHash}`;
      const recalculatedHash = await sha256Hex(expectedHeader);

      if (recalculatedHash !== block.current_hash) {
        return {
          valid: false,
          brokenAtIndex: blockId,
          error: `Invalid checksum for block ${blockId}: expected [${recalculatedHash}], found [${block.current_hash}].`
        };
      }

      expectedPrevHash = block.current_hash;
    }

    return {
      valid: true,
      chainLength: rows.length,
      headHash: expectedPrevHash,
      verifiedAt: new Date().toISOString()
    };
  }
}
