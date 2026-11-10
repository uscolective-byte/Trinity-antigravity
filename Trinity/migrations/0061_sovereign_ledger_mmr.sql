-- ═══════════════════════════════════════════════════════════════════════
-- Trinity Sovereign Ledger MMR (Merkle Mountain Range) Architecture v12.0
-- Target Staging: trinity-development (1cce5249-e044-4c93-868c-0df534a778b5)
-- Target Production: trinity-v03 (ca8ea24e-f7db-431e-b8bf-97f713ae4533)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sovereign_ledger_mmr_peaks (
  epoch_id INTEGER PRIMARY KEY,
  merkle_root TEXT NOT NULL,
  mmr_peaks TEXT NOT NULL, -- JSON array of peak hashes
  leaf_count INTEGER NOT NULL,
  total_gas_consumed INTEGER DEFAULT 0,
  committed_at TEXT DEFAULT (datetime('now')),
  chain_tx_hash TEXT,
  signature TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sovereign_ledger_proofs (
  id TEXT PRIMARY KEY,
  epoch_id INTEGER NOT NULL,
  leaf_index INTEGER NOT NULL,
  entry_hash TEXT NOT NULL,
  merkle_path TEXT NOT NULL, -- JSON array of proof hashes
  verified INTEGER DEFAULT 0,
  verified_at TEXT,
  FOREIGN KEY (epoch_id) REFERENCES sovereign_ledger_mmr_peaks(epoch_id)
);

CREATE INDEX IF NOT EXISTS idx_mmr_peaks_epoch ON sovereign_ledger_mmr_peaks(epoch_id);
CREATE INDEX IF NOT EXISTS idx_mmr_proofs_entry ON sovereign_ledger_proofs(entry_hash);
