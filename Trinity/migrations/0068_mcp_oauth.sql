CREATE TABLE IF NOT EXISTS ops_mcp_oauth_clients (
  provider TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(provider,redirect_uri)
);
CREATE TABLE IF NOT EXISTS ops_mcp_oauth_states (
  state_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','exchanging','completed','failed'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_expiry ON ops_mcp_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS ops_mcp_oauth_refresh (
  connector_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('refreshing','completed','failed')),
  started_at INTEGER NOT NULL
);
