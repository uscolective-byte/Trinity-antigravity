#!/usr/bin/env node
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTOMATION_AND_OPS_SCRIPTS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul verify-tetrakis.mjs (scripts/verify-tetrakis.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
// Read-only independent chain verification. No signer, private keys, or broadcasts.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Prefer the repo-root ethers; fall back to the one installed for the token package
// so the owner only needs `npm ci` inside contracts/tetrakis to run this verifier.
const here = dirname(fileURLToPath(import.meta.url));
let ethersLib;
try { ethersLib = await import('ethers'); } catch {
  ethersLib = await import(pathToFileURL(resolve(here, '../contracts/tetrakis/node_modules/ethers/lib.esm/index.js')).href);
}
const { Contract, JsonRpcProvider, getAddress, keccak256 } = ethersLib;

export const TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';
export const BASTERIX = '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4';
export const SUPPLY = 1_000_000_000n * 10n ** 18n;
export const BASTERIX_ALLOCATION = 1_000_000n * 10n ** 18n;
export const TREASURY_ALLOCATION = 999_000_000n * 10n ** 18n;
const DEFAULT_ARTIFACT = resolve(here, '../contracts/tetrakis/build/TetrakisToken.json');
const ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

export async function verifyTetrakis(provider, options, tokenFactory = (address, rpc) => new Contract(address, ABI, rpc)) {
  const address = getAddress(options.address);
  const treasury = getAddress(options.treasury || TREASURY);
  const basterix = getAddress(options.basterix || BASTERIX);
  const expectedChain = BigInt(options.chainId || 84532);
  const network = await provider.getNetwork();
  if (network.chainId !== expectedChain) throw new Error('CHAIN_MISMATCH');
  // Pin all contract reads to one confirmed block rather than mixing latest states.
  const blockNumber = await provider.getBlockNumber();
  const code = await provider.getCode(address, blockNumber);
  if (!/^0x[0-9a-f]+$/i.test(code) || code.length <= 2) throw new Error('NO_DEPLOYED_CONTRACT');
  const runtimeHash = keccak256(code);
  if (options.expectedRuntimeHash && runtimeHash.toLowerCase() !== options.expectedRuntimeHash.toLowerCase()) {
    throw new Error('RUNTIME_BYTECODE_MISMATCH');
  }
  const token = tokenFactory(address, provider);
  const at = { blockTag: blockNumber };
  const [name, symbol, decimals, totalSupply, treasuryBalance, basterixBalance] = await Promise.all([
    token.name(at), token.symbol(at), token.decimals(at), token.totalSupply(at), token.balanceOf(treasury, at), token.balanceOf(basterix, at)
  ]);
  if (name !== 'Tetrakis' || symbol !== 'TTK' || decimals !== 18n || totalSupply !== SUPPLY) {
    throw new Error('TOKEN_METADATA_OR_SUPPLY_MISMATCH');
  }
  // Initial allocation (valid only before any transfer): 1,000,000 TTK Basterix + 999,000,000 TTK Treasury.
  if (options.expectInitialAllocation && (treasuryBalance !== TREASURY_ALLOCATION || basterixBalance !== BASTERIX_ALLOCATION)) {
    throw new Error('INITIAL_ALLOCATION_MISMATCH');
  }
  let transaction = null;
  if (options.transactionHash) {
    const receipt = await provider.getTransactionReceipt(options.transactionHash);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress || getAddress(receipt.contractAddress) !== address) {
      throw new Error('DEPLOYMENT_RECEIPT_MISMATCH');
    }
    if (receipt.blockNumber > blockNumber) throw new Error('RECEIPT_NEWER_THAN_VERIFICATION_BLOCK');
    transaction = { hash: receipt.hash, blockNumber: receipt.blockNumber, status: receipt.status };
  }
  return {
    ok: true, chainId: Number(network.chainId), network: expectedChain === 84532n ? 'Base Sepolia TESTNET' : expectedChain === 8453n ? 'Base MAINNET' : 'explicitly selected network',
    contractAddress: address, treasury, basterix, blockNumber, runtimeHash,
    bytecodeMatched: Boolean(options.expectedRuntimeHash),
    name, symbol, decimals: Number(decimals), totalSupply: totalSupply.toString(), treasuryBalance: treasuryBalance.toString(), basterixBalance: basterixBalance.toString(),
    initialAllocationChecked: Boolean(options.expectInitialAllocation), transaction,
    checkedAt: new Date().toISOString(),
    limitation: 'Metadata alone does not establish source-code security, private-key control, price, liquidity, or economic value.'
  };
}

async function main(args) {
  if (args.includes('--help')) {
    console.log('Read-only: node scripts/verify-tetrakis.mjs --address <contract> [--rpc <url>] [--chain-id 84532] [--artifact <json>] [--transaction <hash>] [--expect-initial-allocation]\n' +
      'Env fallbacks: TTK_CONTRACT_ADDRESS, TTK_DEPLOY_TX, BASE_SEPOLIA_RPC (or BASE_MAINNET_RPC with --chain-id 8453).\n' +
      'Without --artifact the compiled contracts/tetrakis/build/TetrakisToken.json runtime bytecode is compared (pass --no-artifact to skip).');
    return;
  }
  const options = {};
  const keys = { '--address': 'address', '--rpc': 'rpc', '--chain-id': 'chainId', '--artifact': 'artifact', '--transaction': 'transactionHash' };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--expect-initial-allocation') { options.expectInitialAllocation = true; continue; }
    if (key === '--no-artifact') { options.noArtifact = true; continue; }
    if (!keys[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('INVALID_ARGUMENTS');
    options[keys[key]] = args[++i];
  }
  options.address = options.address || process.env.TTK_CONTRACT_ADDRESS;
  options.transactionHash = options.transactionHash || process.env.TTK_DEPLOY_TX;
  if (!options.address) throw new Error('CONTRACT_ADDRESS_REQUIRED');
  if (!options.artifact && !options.noArtifact) options.artifact = DEFAULT_ARTIFACT;
  if (options.artifact) {
    const artifact = JSON.parse(readFileSync(resolve(options.artifact), 'utf8'));
    const runtime = typeof artifact.deployedBytecode === 'string' ? artifact.deployedBytecode : artifact.deployedBytecode?.object;
    if (!runtime || !/^(0x)?[0-9a-f]+$/i.test(runtime)) throw new Error('ARTIFACT_RUNTIME_BYTECODE_REQUIRED');
    options.expectedRuntimeHash = keccak256(runtime.startsWith('0x') ? runtime : '0x' + runtime);
  }
  const mainnet = BigInt(options.chainId || 84532) === 8453n;
  const rpc = options.rpc || (mainnet ? process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org' : process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org');
  const provider = new JsonRpcProvider(rpc, undefined, { batchMaxCount: 1 });
  try { console.log(JSON.stringify(await verifyTetrakis(provider, options), null, 2)); }
  finally { provider.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((err) => {
    // Avoid printing RPC URLs/errors that may contain provider credentials: only our own upper-case codes are shown.
    const code = /^[A-Z_]+$/.test(String(err?.message)) ? err.message : undefined;
    console.error(JSON.stringify({ ok: false, error: 'VERIFICATION_FAILED', code, hint: 'Check chain, contract, receipt and local runtime artifact. No transaction was sent.' }));
    process.exitCode = 1;
  });
}
