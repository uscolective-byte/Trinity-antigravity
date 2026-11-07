/**
 * Canonical source-of-truth for Trinity's deployable Worker targets.
 * Placeholder, experimental and unconfigured template folders are deliberately
 * excluded. Keep the build matrix and deployment runner on this same list.
 */

export const AURA_WORKERS = [
  'aura_analyzer', 'aura_architect', 'aura_codegen', 'aura_deployer', 'aura_evolver',
  'aura_memory', 'aura_optimizer', 'aura_planner', 'aura_sentinel', 'aura_tester'
];

export const TRINITY_CORE_WORKERS = [
  'trinity-core', 'trinity-builder', 'trinity-dispatcher', 'trinity-connectors',
  'trinity-guardian', 'trinity-memory', 'trinity-sentinel', 'trinity-skills'
];

export const STANDALONE_WORKERS = [
  { name: 'trinity-capacity', dir: 'Capacity-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-knowledge', dir: 'Knowledge-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-integrations', dir: 'Integrations-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-pc-bridge', dir: 'PC-Bridge-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-audit', dir: 'Audit-Worker', config: 'wrangler.jsonc' },
  { name: 'jericho123', dir: 'Jericho-Worker', config: 'wrangler.jsonc' }
];

export const AUXILIARY_WORKERS = [
  { name: 'trinity-chat-inference', dir: 'Trinity', config: 'wrangler.chat.jsonc' },
  { name: 'trinity-ops', dir: 'Trinity', config: 'wrangler.ops.jsonc' },
  { name: 'trinity-staging', dir: '.', config: 'wrangler.jsonc', env: 'staging' }
];

export const MASTER_WORKER = { name: 'trinity', dir: '.', config: 'wrangler.jsonc' };

export const WORKER_DEPLOYMENTS = [
  ...AURA_WORKERS.map(name => ({
    name,
    dir: 'Trinity',
    config: `workers/aura/${name}.jsonc`
  })),
  ...TRINITY_CORE_WORKERS.map(name => ({
    name,
    dir: 'Trinity',
    config: `workers/trinity/${name}.jsonc`
  })),
  ...STANDALONE_WORKERS,
  ...AUXILIARY_WORKERS,
  MASTER_WORKER
];
