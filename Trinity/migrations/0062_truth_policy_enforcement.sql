-- ═══════════════════════════════════════════════════════════════════════
-- Trinity Truth Policy v3 Enforcement Migration
-- Target Staging: trinity-development (1cce5249-e044-4c93-868c-0df534a778b5)
-- Target Production: trinity-v03 (ca8ea24e-f7db-431e-b8bf-97f713ae4533)
-- ═══════════════════════════════════════════════════════════════════════

-- Tabuľka porušení pravidiel pravdivosti (Audit zlyhaní)
CREATE TABLE IF NOT EXISTS truth_violations (
    id TEXT PRIMARY KEY,
    memory_id TEXT,
    agent TEXT,
    claim TEXT,
    reason TEXT,
    severity TEXT,
    r2_evidence_key TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pridanie stĺpca overenia integrity do sovereign_events
ALTER TABLE sovereign_events ADD COLUMN reality_hash TEXT;
ALTER TABLE sovereign_events ADD COLUMN truth_verified INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_truth_violations_agent_detected ON truth_violations(agent, detected_at);
