-- Trinity Omni-Core Migration 0066: Multi-Tenant Device Gateways & System Actions Target User
ALTER TABLE ops_system_actions ADD COLUMN target_user TEXT;

CREATE TABLE IF NOT EXISTS ops_device_gateways (
  id TEXT PRIMARY KEY,
  gateway_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  device_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ops_device_gateways_user ON ops_device_gateways(user_email);
CREATE INDEX IF NOT EXISTS idx_ops_device_gateways_token ON ops_device_gateways(token_hash);
