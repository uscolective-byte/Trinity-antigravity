import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCloudLink } from './cloud-link.mjs';
import { executeProposal } from './executor.mjs';
import { ProposalStore } from './store.mjs';

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const allowedTasks = new Set([
  'Trinity:build',
  'Trinity:tests',
  'Local-Gateway:tests',
  'Local-Gateway:node-version',
]);

export async function executeCloudProposal(root, proposal, dataDir) {
  const { project, task } = proposal.payload ?? {};
  if (proposal.action !== 'run' || typeof project !== 'string' ||
      typeof task !== 'string' || !allowedTasks.has(`${project}:${task}`)) {
    throw new Error('This action is unavailable on the cloud runner.');
  }
  const taskEnvironment = {
    PATH: process.env.PATH,
    HOME: '/tmp',
    CI: '1',
    NO_COLOR: '1',
  };
  return executeProposal(root, { ...proposal, payload: { project, task } }, dataDir, {
    taskEnvironment,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const endpoint = new URL(process.env.TRINITY_CLOUD_URL ?? 'https://auru.dev');
  if (endpoint.href !== 'https://auru.dev/') {
    throw new Error('The staging runner requires https://auru.dev.');
  }

  const key = process.env.TRINITY_GATEWAY_KEY;
  const dataDir = process.env.TRINITY_GATEWAY_DATA;
  if (!key || !dataDir || !path.isAbsolute(dataDir)) {
    throw new Error('A staging gateway key and an absolute state volume path are required.');
  }

  const store = new ProposalStore(dataDir);
  await store.init();
  await store.recoverInterrupted();
  let status = 'connecting';
  const stop = startCloudLink({
    baseUrl: endpoint.origin,
    key,
    store,
    workspaceRoot,
    dataDir,
    execute: executeCloudProposal,
    beforeClaim: async () => {
      const response = await fetch(new URL('/health', endpoint), {
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
      const health = response.ok ? await response.json() : null;
      if (health?.service !== 'Trinity' || health.environment !== 'staging') {
        throw new Error('The endpoint did not identify as the staging Trinity Worker.');
      }
    },
    onState: state => { status = state.status; },
  });

  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }).end(JSON.stringify({ service: 'Trinity Cloud Runner', status, environment: 'staging' }));
  });
  server.listen(Number(process.env.PORT ?? 8791), '0.0.0.0');

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      stop();
      server.close();
    });
  }
}
