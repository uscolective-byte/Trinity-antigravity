CREATE TABLE IF NOT EXISTS ops_hitl_approvals (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executing', 'executed', 'rejected', 'failed', 'expired')),
  decision_by TEXT,
  decision_channel TEXT,
  approval_token_hash TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  telegram_chat_id TEXT,
  telegram_message_id INTEGER,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hitl_status ON ops_hitl_approvals(status, expires_at, created_at);
