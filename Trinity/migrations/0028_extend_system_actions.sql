ALTER TABLE ops_system_actions RENAME TO ops_system_actions_legacy;

CREATE TABLE ops_system_actions (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL CHECK(action IN ('read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr')),
 payload_json TEXT NOT NULL,
 rationale TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('proposed','approved','claimed','completed','failed','rejected','expired')),
 requested_by TEXT NOT NULL,
 approved_by TEXT,
 approved_at INTEGER,
 claimed_by TEXT,
 lease_until INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 receipt_json TEXT,
 error TEXT,
 expires_at INTEGER NOT NULL,
 completed_at INTEGER,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ops_system_actions(id,action,payload_json,rationale,status,requested_by,approved_by,approved_at,claimed_by,lease_until,attempts,receipt_json,error,expires_at,completed_at,created_at,updated_at)
SELECT id,action,payload_json,rationale,status,requested_by,approved_by,approved_at,claimed_by,lease_until,attempts,receipt_json,error,expires_at,completed_at,created_at,updated_at
FROM ops_system_actions_legacy;

DROP TABLE ops_system_actions_legacy;
CREATE INDEX idx_system_actions_queue ON ops_system_actions(status,expires_at,created_at);
