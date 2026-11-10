-- ═══════════════════════════════════════════════════════════════════════
-- Trinity Truth Policy v3 Enforcement Migration
-- Target Staging: trinity-development (1cce5249-e044-4c93-868c-0df534a778b5)
-- Target Production: trinity-v03 (ca8ea24e-f7db-431e-b8bf-97f713ae4533)
-- ═══════════════════════════════════════════════════════════════════════

-- Tabuľka porušení pravidiel pravdivosti (Audit zlyhaní)
CREATE TABLE IF NOT EXISTS truth_violations (
    violation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    violation_code TEXT NOT NULL,
    details TEXT NOT NULL,
    attempted_payload TEXT,
    detected_at INTEGER NOT NULL
);

-- Pridanie stĺpca overenia integrity do sovereign_events
ALTER TABLE sovereign_events ADD COLUMN reality_hash TEXT;
ALTER TABLE sovereign_events ADD COLUMN truth_verified INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_violations_actor ON truth_violations(actor_id, detected_at);
