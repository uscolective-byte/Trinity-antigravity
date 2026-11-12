-- ═══════════════════════════════════════════════════════════════════════
-- Trinity Licensing, Policy Compliance & Anti-Spam Shield Migration
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ops_license_grants (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  license_key_hash TEXT NOT NULL UNIQUE,
  license_prefix TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'pro_studio' CHECK(tier IN ('free_sandbox', 'pro_studio', 'enterprise_sovereign', 'owner_root')),
  license_type TEXT NOT NULL DEFAULT 'TRINITY-COMMERCIAL-2.0',
  max_rpm INTEGER NOT NULL DEFAULT 60,
  daily_requests_limit INTEGER NOT NULL DEFAULT 5000,
  max_payload_bytes INTEGER NOT NULL DEFAULT 131072,
  commercial_rights INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'revoked', 'expired')),
  issued_by TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ops_license_subject ON ops_license_grants(subject_id, status);

CREATE TABLE IF NOT EXISTS ops_policy_acceptances (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  document_codes_json TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ops_policy_actor ON ops_policy_acceptances(actor_id, policy_version, accepted_at DESC);

CREATE TABLE IF NOT EXISTS ops_abuse_incidents (
  id TEXT PRIMARY KEY,
  actor_hash TEXT NOT NULL,
  route TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  blocked_until INTEGER,
  sample_snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ops_abuse_actor ON ops_abuse_incidents(actor_hash, blocked_until DESC);

CREATE TABLE IF NOT EXISTS ops_daily_usage (
  usage_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
