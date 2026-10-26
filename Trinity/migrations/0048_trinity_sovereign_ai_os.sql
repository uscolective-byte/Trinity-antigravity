-- 0048_trinity_sovereign_ai_os.sql
-- Trinity 12.0 Sovereign AI Operating System Architecture
-- Policy Engine, Capability-First Scheduler, Multi-Level Knowledge Graph, Agent Mesh & Resource State

-- 1. Policy Engine: Deklaratívne politiky a invarianty
CREATE TABLE IF NOT EXISTS sovereign_policies (
  policy_id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  severity TEXT NOT NULL DEFAULT 'error' CHECK(severity IN ('error','warn','audit')),
  rule_json TEXT NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- 2. Agent Registry: Centrálny register agentov a uzlov
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'core', 'aura', 'standalone', 'bridge', 'external'
  version TEXT DEFAULT '12.0.0',
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('registered','available','busy','degraded','offline')),
  endpoint TEXT,                      -- RPC service binding name alebo endpoint
  owner TEXT DEFAULT 'system',
  environment TEXT DEFAULT 'production',
  capabilities_hash TEXT,
  heartbeat_at INTEGER,               -- Unix epoch ms
  load_score REAL DEFAULT 0.0,        -- 0.0 (voľný) až 1.0 (preťažený)
  trust_score REAL DEFAULT 1.0,       -- 0.0 až 1.0
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- 3. Heartbeat telemetria agentov
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  active_jobs INTEGER DEFAULT 0,
  cpu_load REAL DEFAULT 0.0,
  memory_load REAL DEFAULT 0.0,
  latency_ms INTEGER DEFAULT 0,
  timestamp INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats ON agent_heartbeats(agent_id, timestamp DESC);

-- 4. Capability Registry
CREATE TABLE IF NOT EXISTS capabilities (
  capability_id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,            -- 'os', 'memory', 'ai', 'workflow', 'infrastructure', 'bridge', 'security', 'audit'
  critical INTEGER DEFAULT 0 CHECK(critical IN (0,1)),
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);

-- 5. M:N väzba Agent <-> Schopnosti
CREATE TABLE IF NOT EXISTS agent_capabilities (
  agent_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  priority INTEGER DEFAULT 100,
  PRIMARY KEY (agent_id, capability_id),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY(capability_id) REFERENCES capabilities(capability_id)
);

-- 6. Závislosti medzi agentmi (Dependency Mesh)
CREATE TABLE IF NOT EXISTS agent_dependencies (
  agent_id TEXT NOT NULL,
  depends_on_agent_id TEXT NOT NULL,
  critical INTEGER DEFAULT 1 CHECK(critical IN (0,1)),
  PRIMARY KEY (agent_id, depends_on_agent_id),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY(depends_on_agent_id) REFERENCES agents(agent_id)
);

-- 7. Agent Leasing: Zámky úloh
CREATE TABLE IF NOT EXISTS agent_leases (
  lease_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY(job_id) REFERENCES ops_jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_agent_leases_expires ON agent_leases(expires_at);

-- 8. Resource State: Stav a vyťaženie infraštruktúrnych uzlov
CREATE TABLE IF NOT EXISTS resource_state (
  resource_id TEXT PRIMARY KEY,
  node_name TEXT NOT NULL,
  cpu_score REAL DEFAULT 0.0,
  memory_score REAL DEFAULT 0.0,
  queue_depth INTEGER DEFAULT 0,
  active_jobs INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'edge' CHECK(tier IN ('edge','workstation','cloud','gpu')),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- 9. Knowledge Graph: Štruktúrovaný sémantický pamäťový model
CREATE TABLE IF NOT EXISTS kg_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- 'project', 'agent', 'capability', 'artifact', 'model', 'user'
  name TEXT NOT NULL,
  properties_json TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(type, name);

CREATE TABLE IF NOT EXISTS kg_relations (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,        -- 'controls', 'depends_on', 'has_capability', 'produced', 'audited_by'
  weight REAL DEFAULT 1.0,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(source_entity_id) REFERENCES kg_entities(id),
  FOREIGN KEY(target_entity_id) REFERENCES kg_entities(id)
);
CREATE INDEX IF NOT EXISTS idx_kg_relations_src ON kg_relations(source_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_kg_relations_tgt ON kg_relations(target_entity_id, relation_type);

CREATE TABLE IF NOT EXISTS kg_observations (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  observation TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  timestamp INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(entity_id) REFERENCES kg_entities(id)
);

CREATE TABLE IF NOT EXISTS kg_evidence (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  proof_json TEXT,
  verified INTEGER DEFAULT 1 CHECK(verified IN (0,1)),
  timestamp INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(observation_id) REFERENCES kg_observations(id)
);

CREATE TABLE IF NOT EXISTS kg_decisions (
  id TEXT PRIMARY KEY,
  rationale TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_agent_id TEXT NOT NULL,
  outcome TEXT,
  timestamp INTEGER DEFAULT (unixepoch() * 1000)
);

-- 10. Agent Reputation Engine: Metriky kvality a dôveryhodnosti
CREATE TABLE IF NOT EXISTS agent_reputation (
  agent_id TEXT PRIMARY KEY,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0.0,
  uptime_ratio REAL DEFAULT 1.0,
  audit_score REAL DEFAULT 1.0,
  trust_score REAL DEFAULT 1.0,
  last_evaluated INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
);

-- Východzie Sovereign Politiky (Invarianty I1 - I8)
INSERT OR IGNORE INTO sovereign_policies (policy_id, name, enabled, severity, rule_json, description) VALUES
  ('pol_deny_undefined_bind', 'deny_undefined_bind', 1, 'error', '{"rule":"disallow_undefined_in_d1_bind","sanitize":"null"}', 'Invariant I1: undefined sa nikdy nesmie poslat do D1 bind()'),
  ('pol_completed_requires_evidence', 'completed_requires_evidence', 1, 'error', '{"rule":"require_verified_receipt","fields":["receipt_id"]}', 'Invariant I2: Status completed vyzaduje doklad o vysledku'),
  ('pol_catch_no_completed', 'catch_no_completed', 1, 'error', '{"rule":"reject_completed_in_catch_block"}', 'Invariant I3: Catch blok nesmie vratit status completed'),
  ('pol_parent_requires_children', 'parent_requires_children', 1, 'error', '{"rule":"parent_complete_only_if_all_children_complete"}', 'Invariant I4: Parent job je completed iba ak vsetci potomkovia su completed'),
  ('pol_heartbeat_lease_revocation', 'heartbeat_lease_revocation', 1, 'warn', '{"rule":"lease_timeout_on_stale_heartbeat","max_stale_ms":60000}', 'Invariant I5: Zastaveny heartbeat automaticky uvolnuje lease');
