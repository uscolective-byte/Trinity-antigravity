/**
 * Tetrakis ($TTK) - shared deployment logic (Base Sepolia / Base Mainnet / local test chain).
 *
 * Truth Policy: nothing here fabricates values. Every printed number comes from the RPC
 * node or from the compiled artifact. Private keys are read only from the environment or
 * a local file, are never printed, and are never written to any receipt.
 *
 * The contract constructor takes no arguments and mints to two hard-coded addresses
 * (Basterix wallet + Treasury), so the deployer key only pays gas: it does NOT have to be
 * the treasury key and it never receives any TTK.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { verifyTetrakis, BASTERIX, TREASURY } from '../../../../scripts/verify-tetrakis.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ARTIFACT_PATH = path.resolve(__dirname, '../../build/TetrakisToken.json');
export const BUILD_DIR = path.resolve(__dirname, '../../build');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
export const DEFAULT_KEY_FILE = path.join(REPO_ROOT, '.secrets', 'tetrakis-treasury.json');

export const NETWORKS = {
  'base-sepolia': {
    label: 'Base Sepolia TESTNET', chainId: 84532n, rpcEnv: 'BASE_SEPOLIA_RPC', defaultRpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org', mainnet: false,
    faucets: ['https://www.alchemy.com/faucets/base-sepolia', 'https://faucets.chain.link/base-sepolia', 'https://docs.base.org/base-chain/tools/network-faucets']
  },
  'base-mainnet': {
    label: 'Base MAINNET (REAL MONEY, IRREVERSIBLE)', chainId: 8453n, rpcEnv: 'BASE_MAINNET_RPC', defaultRpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org', mainnet: true, faucets: []
  }
};

export const MAINNET_CONFIRM_FLAG = '--i-understand-mainnet-is-irreversible';

export function maskUrl(urlStr) {
  try { const u = new URL(urlStr); return `${u.protocol}//${u.host}`; } catch { return '<invalid rpc url>'; }
}

/** Accepts a bare hex key or a JSON file with wallet.private_key / privateKey / private_key. */
export function parsePrivateKey(raw) {
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('KEY_EMPTY');
  let candidate = text;
  if (text.startsWith('{')) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('KEY_FILE_NOT_VALID_JSON'); }
    candidate = parsed.wallet?.private_key || parsed.wallet?.privateKey || parsed.privateKey || parsed.private_key || '';
  }
  candidate = String(candidate).trim();
  if (!candidate.startsWith('0x')) candidate = '0x' + candidate;
  if (!/^0x[0-9a-fA-F]{64}$/.test(candidate)) throw new Error('KEY_FORMAT_INVALID (expected 32-byte hex)');
  return candidate;
}

/**
 * Key sources, in priority order: env TTK_DEPLOYER_PRIVATE_KEY, file named by
 * env TTK_DEPLOYER_KEY_FILE, then the default .secrets/tetrakis-treasury.json.
 */
export function loadDeployerKey(env = process.env, keyFileDefault = DEFAULT_KEY_FILE) {
  if (env.TTK_DEPLOYER_PRIVATE_KEY) return { key: parsePrivateKey(env.TTK_DEPLOYER_PRIVATE_KEY), source: 'env TTK_DEPLOYER_PRIVATE_KEY' };
  const file = env.TTK_DEPLOYER_KEY_FILE ? path.resolve(env.TTK_DEPLOYER_KEY_FILE) : keyFileDefault;
  if (fs.existsSync(file)) return { key: parsePrivateKey(fs.readFileSync(file, 'utf8')), source: `file ${file}` };
  throw new Error('NO_DEPLOYER_KEY: set TTK_DEPLOYER_PRIVATE_KEY or TTK_DEPLOYER_KEY_FILE');
}

/**
 * @param {object} opts
 * @param {string} opts.networkKey key of NETWORKS (ignored when opts.network is given - used by tests with a local chain)
 * @param {object} [opts.network] {label, chainId(bigint), mainnet, explorer, faucets}
 * @param {string} opts.rpcUrl
 * @param {boolean} opts.broadcast  false = read-only plan, true = send the deployment transaction
 * @param {string} [opts.privateKey] required if broadcast; optional for plan (used only to show deployer address/balance)
 * @param {boolean} [opts.confirmMainnet]
 * @param {string} [opts.artifactPath]
 * @param {boolean} [opts.writeReceipt=true]
 * @param {(msg:string)=>void} [opts.log]
 */
export async function runDeploy(opts) {
  const net = opts.network || NETWORKS[opts.networkKey];
  if (!net) throw new Error('UNKNOWN_NETWORK');
  const log = opts.log || console.log;
  const artifactPath = opts.artifactPath || DEFAULT_ARTIFACT_PATH;
  if (!fs.existsSync(artifactPath)) throw new Error(`ARTIFACT_MISSING at ${artifactPath} - run "npm run compile"`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  if (net.mainnet && opts.broadcast && !opts.confirmMainnet) {
    throw new Error(`MAINNET_REFUSED: broadcasting to ${net.label} requires ${MAINNET_CONFIRM_FLAG}`);
  }

  const provider = new ethers.JsonRpcProvider(opts.rpcUrl, undefined, { batchMaxCount: 1 });
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== net.chainId) {
      throw new Error(`CHAIN_MISMATCH: expected ${net.chainId}, RPC reports ${network.chainId}. Nothing was sent.`);
    }
    log(`Network:           ${net.label} (chainId ${network.chainId}) via ${maskUrl(opts.rpcUrl)}`);

    let wallet = null;
    if (opts.privateKey) wallet = new ethers.Wallet(opts.privateKey, provider);
    if (opts.broadcast && !wallet) throw new Error('NO_DEPLOYER_KEY');

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet || provider);
    const deployTx = await factory.getDeployTransaction();
    const fee = await provider.getFeeData();
    const maxFeePerGas = fee.maxFeePerGas || fee.gasPrice;
    if (!maxFeePerGas) throw new Error('NO_FEE_DATA_FROM_RPC');

    let gasUnits;
    let gasSource = 'eth_estimateGas';
    try {
      gasUnits = await provider.estimateGas({ ...deployTx, from: wallet?.address });
    } catch (err) {
      if (opts.broadcast) throw new Error(`GAS_ESTIMATE_FAILED: ${err.shortMessage || err.code || 'rpc error'}`);
      // Plan only: estimate without a sender (no funded deployer yet).
      gasUnits = await provider.estimateGas({ data: deployTx.data });
      gasSource = 'eth_estimateGas (no sender)';
    }
    const gasLimit = (gasUnits * 120n) / 100n;
    const costWei = gasLimit * maxFeePerGas;
    log(`Gas estimate:      ${gasUnits} units (${gasSource}), limit ${gasLimit}`);
    log(`Max cost:          ${ethers.formatEther(costWei)} ETH`);

    let balance = null;
    if (wallet) {
      balance = await provider.getBalance(wallet.address);
      log(`Deployer address:  ${wallet.address}`);
      log(`Deployer balance:  ${ethers.formatEther(balance)} ETH`);
    }

    const plan = {
      timestamp: new Date().toISOString(), network: net.label, chainId: Number(net.chainId), contract: 'TetrakisToken', symbol: 'TTK',
      totalSupply: '1,000,000,000 TTK (10^27 wei, fixed, no mint)',
      allocations: { [BASTERIX]: '1,000,000 TTK', [TREASURY]: '999,000,000 TTK' },
      deployerAddress: wallet?.address || null,
      deployerBalanceWei: balance === null ? null : balance.toString(),
      estimatedGasUnits: gasUnits.toString(), maxCostWei: costWei.toString(),
      bytecodeSha256: artifact.bytecodeSha256, runtimeKeccak256: artifact.runtimeKeccak256
    };

    const enough = balance !== null && balance >= costWei;
    if (!opts.broadcast) {
      plan.status = wallet ? (enough ? 'PLAN_READY_FUNDED' : 'PLAN_AWAITING_GAS_FUNDING') : 'PLAN_NO_DEPLOYER_KEY_SUPPLIED';
      log(`STATUS: ${plan.status} (dry-run, nothing sent)`);
      if (wallet && !enough) {
        log(`Fund ${wallet.address} with at least ${ethers.formatEther(costWei)} ETH on ${net.label}.`);
        for (const f of net.faucets) log(`  faucet: ${f}`);
      }
      if (opts.writeReceipt !== false) writeJson(`deploy-plan-${opts.networkKey || 'custom'}.json`, plan);
      return { plan };
    }

    if (!enough) {
      throw new Error(`INSUFFICIENT_GAS_FUNDS: deployer ${wallet.address} has ${ethers.formatEther(balance)} ETH, needs ~${ethers.formatEther(costWei)} ETH`);
    }

    log('Broadcasting deployment transaction...');
    const contract = await factory.deploy({ gasLimit });
    const tx = contract.deploymentTransaction();
    log(`Transaction hash:  ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('DEPLOYMENT_REVERTED');
    const address = await contract.getAddress();
    log(`DEPLOYED: TetrakisToken at ${address} (block ${receipt.blockNumber})`);

    const verification = await verifyWithRetry(opts.rpcUrl, {
      address, transactionHash: tx.hash, chainId: net.chainId, expectedRuntimeHash: artifact.runtimeKeccak256, expectInitialAllocation: true
    }, log);
    log(`VERIFIED on-chain: ${verification.name}/${verification.symbol}, supply ${verification.totalSupply}, treasury ${verification.treasuryBalance}, basterix ${verification.basterixBalance}, runtime ${verification.runtimeHash}`);
    const live = { ...verification, deployer: wallet.address, explorer: net.explorer ? `${net.explorer}/address/${address}` : null };
    if (opts.writeReceipt !== false) writeJson(`deployed-receipt-${opts.networkKey || 'custom'}.json`, live);
    return { plan, receipt: live, address };
  } finally {
    provider.destroy();
  }
}

/**
 * Verifies through a FRESH provider (the deploying provider caches a stale block number) and retries
 * while a load-balanced public RPC node has not yet caught up with the block containing the deployment.
 */
async function verifyWithRetry(rpcUrl, options, log, attempts = 15, delayMs = 2000) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    const verifier = new ethers.JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1 });
    try {
      return await verifyTetrakis(verifier, options);
    } catch (err) {
      lastError = err;
      if (!['NO_DEPLOYED_CONTRACT', 'RECEIPT_NEWER_THAN_VERIFICATION_BLOCK', 'DEPLOYMENT_RECEIPT_MISMATCH'].includes(err.message)) throw err;
      log(`Waiting for RPC node to index the deployment (${i}/${attempts}, ${err.message})...`);
      await new Promise(r => setTimeout(r, delayMs));
    } finally {
      verifier.destroy();
    }
  }
  throw lastError;
}

function writeJson(name, data) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  const target = path.join(BUILD_DIR, name);
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${target}`);
}

export async function cli(networkKey, argv, env = process.env) {
  if (argv.includes('--help')) {
    console.log(`Usage: node scripts/deploy-${networkKey}.mjs [--broadcast]${NETWORKS[networkKey].mainnet ? ' ' + MAINNET_CONFIRM_FLAG : ''}\n` +
      'Key: env TTK_DEPLOYER_PRIVATE_KEY, or file TTK_DEPLOYER_KEY_FILE (default .secrets/tetrakis-treasury.json). Never printed.\n' +
      `RPC: env ${NETWORKS[networkKey].rpcEnv} (default ${NETWORKS[networkKey].defaultRpc}).`);
    return 0;
  }
  const net = NETWORKS[networkKey];
  const broadcast = argv.includes('--broadcast');
  if (net.mainnet && broadcast && !argv.includes(MAINNET_CONFIRM_FLAG)) {
    console.error(`MAINNET_REFUSED: broadcasting to ${net.label} requires ${MAINNET_CONFIRM_FLAG}`);
    return 1;
  }
  let privateKey;
  try { privateKey = loadDeployerKey(env).key; } catch (err) {
    if (broadcast) { console.error(err.message); return 1; }
    console.log('(no deployer key found - plan is read-only without balance check)');
  }
  try {
    await runDeploy({
      networkKey, rpcUrl: env[net.rpcEnv] || net.defaultRpc, broadcast, privateKey,
      confirmMainnet: argv.includes(MAINNET_CONFIRM_FLAG)
    });
    return 0;
  } catch (err) {
    // Messages above are built from codes only; they never include key material or RPC URLs.
    console.error(`DEPLOY_FAILED: ${err.message}`);
    return 1;
  }
}
