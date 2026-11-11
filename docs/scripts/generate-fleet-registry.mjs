import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRINITY_FLEET_CLUSTERS } from '../../Trinity/src/fleet-clusters.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outputPath = path.join(here, '../registry/fleet-registry.json');
const excluded = new Set(['node_modules', '.git', 'Archive', '.trinity-backups', 'dist', '.next']);

async function findWranglerConfigs(dir, relative = '') {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name)) continue;
    const rel = path.join(relative, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await findWranglerConfigs(full, rel));
    else if (entry.isFile() && entry.name === 'wrangler.jsonc') found.push({ path: rel, full });
  }
  return found;
}

const rootConfig = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
const configs = await findWranglerConfigs(root);
const configNames = [];
for (const config of configs) {
  try {
    const parsed = JSON.parse(await readFile(config.full, 'utf8'));
    configNames.push({ name: parsed.name, path: config.path, environment: 'default' });
    if (parsed.env?.staging?.name) configNames.push({ name: parsed.env.staging.name, path: config.path, environment: 'staging' });
  } catch {}
}

const environments = {
  production: rootConfig.services ?? [],
  staging: rootConfig.env?.staging?.services ?? []
};
const workers = TRINITY_FLEET_CLUSTERS.flatMap((cluster) =>
  cluster.workers.map((worker) => {
    const matchingConfigs = configNames.filter((item) => item.name === worker.name);
    const bindings = Object.fromEntries(Object.entries(environments).map(([environment, services]) => [
      environment,
      services.filter((service) => service.service === worker.name).map(({ binding, service }) => ({ binding, service }))
    ]));
    return {
      worker_number: worker.number,
      worker_id: '#' + String(worker.number).padStart(2, '0'),
      name: worker.name,
      role: worker.role,
      cluster_id: cluster.cluster_id,
      cluster_name: cluster.name,
      cluster_range: cluster.range,
      worker_config_found: matchingConfigs.length > 0,
      worker_configs: matchingConfigs.map(({ name, path, environment }) => ({ name, path, environment })),
      service_bindings: bindings,
      timeout_ms: null,
      compute_budget: null,
      fallback_policy: 'UNSPECIFIED_IN_SOURCE',
      live_status: 'NOT_QUERIED'
    };
  })
).sort((a, b) => a.worker_number - b.worker_number);

const registry = {
  schema_version: '1.0.0',
  source: 'Trinity/src/fleet-clusters.js + wrangler.jsonc',
  evidence_scope: 'Declared fleet manifest and repository Wrangler configuration only; not Cloudflare live deployment state.',
  generated_at: new Date().toISOString(),
  declared_cluster_count: TRINITY_FLEET_CLUSTERS.length,
  declared_worker_count: workers.length,
  wrangler_config_count: configs.length,
  service_binding_count: {
    production: environments.production.length,
    staging: environments.staging.length
  },
  unknown_fields_policy: 'Timeout, compute budget, fallback and live status remain null/UNSPECIFIED/NOT_QUERIED unless source code or a live probe provides evidence.',
  clusters: TRINITY_FLEET_CLUSTERS.map(({ cluster_id, name, range, responsibility, bindings }) => ({
    cluster_id, name, range, responsibility, bindings
  })),
  workers
};

if (workers.length !== 47 || new Set(workers.map((worker) => worker.worker_number)).size !== 47) {
  throw new Error('FLEET_MANIFEST_INVALID: ' + workers.length + ' declared workers');
}
await writeFile(outputPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
console.log('Generated ' + workers.length + ' workers across ' + registry.declared_cluster_count + ' clusters.');

const mdLines = [
  '# Fleet Workers — deklarovaných 47 Workerov',
  '',
  'Zdroj zoznamu: Trinity/src/fleet-clusters.js. Bindingy sa mapujú presnou zhodou na wrangler.jsonc. Live status sa tu nevyhodnocuje.',
  '',
  '| ID | Cluster | Worker | Úloha | Config | Production bindings | Staging bindings | Timeout | Compute | Fallback | Live |',
  '|---|---|---|---|---|---|---|---:|---|---|---|'
];
for (const worker of workers) {
  const production = worker.service_bindings.production.map((item) => item.binding).join(', ') || '—';
  const staging = worker.service_bindings.staging.map((item) => item.binding).join(', ') || '—';
  const role = worker.role.replaceAll('|', '/');
  mdLines.push(
    '| ' + worker.worker_id +
    ' | ' + worker.cluster_id + ' ' + worker.cluster_name +
    ' | ' + worker.name +
    ' | ' + role +
    ' | ' + (worker.worker_config_found ? 'yes' : 'no') +
    ' | ' + production +
    ' | ' + staging +
    ' | unknown | unknown | unspecified | not queried |'
  );
}
mdLines.push(
  '',
  '## Interpretácia',
  '',
  '- Worker config = samostatný Wrangler config alebo explicitný staging environment v koreňovom configu.',
  '- Bindingy sú aliasy z wrangler.jsonc; duplicitné aliasy sa nesčítavajú ako samostatné Workery.',
  '- Timeout, compute budget a fallback nie sú v inventári domyslené.',
  '- Live status vyžaduje samostatnú Cloudflare probe; tento súbor nie je live health report.'
);
await writeFile(path.join(here, '../registry/fleet-workers.md'), mdLines.join('\n') + '\n', 'utf8');

const serviceRegistry = {
  schema_version: '1.0.0',
  source: 'wrangler.jsonc',
  evidence_scope: 'Repository configuration only; not Cloudflare live state.',
  generated_at: registry.generated_at,
  worker_configs: configNames,
  production: environments.production.map((service) => ({
    binding: service.binding,
    service: service.service,
    worker_config_found: configNames.some((item) => item.name === service.service),
    timeout_ms: null,
    compute_budget: null,
    fallback_policy: 'UNSPECIFIED_IN_SOURCE'
  })),
  staging: environments.staging.map((service) => ({
    binding: service.binding,
    service: service.service,
    worker_config_found: configNames.some((item) => item.name === service.service),
    timeout_ms: null,
    compute_budget: null,
    fallback_policy: 'UNSPECIFIED_IN_SOURCE'
  }))
};
await writeFile(path.join(here, '../registry/service-bindings.json'), JSON.stringify(serviceRegistry, null, 2) + '\n', 'utf8');
