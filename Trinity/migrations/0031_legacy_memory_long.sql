-- The runtime still reads the historical long-term memory table while
-- consolidating records into ops_memory. Fresh D1 databases did not have it,
-- which made authenticated status and memory endpoints fail after login.
CREATE TABLE IF NOT EXISTS memory_long (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT,
  importance INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_memory_long_importance
ON memory_long(importance DESC);
