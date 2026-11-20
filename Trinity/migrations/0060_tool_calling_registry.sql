-- The runtime registry contract is shared by lib/d1.js, the service dispatcher
-- and lib/trinity-tool-executor.js. Preserve existing canonical rows.
-- Registration and availability must come from real handlers, not seed aliases.
CREATE TABLE IF NOT EXISTS trinity_tool_registry (
  tool_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  input_schema TEXT NOT NULL DEFAULT '{}',
  output_schema TEXT,
  handler_type TEXT NOT NULL,
  handler_target TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trinity_tool_registry_category_name
  ON trinity_tool_registry(category,name);
