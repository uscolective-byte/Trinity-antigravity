import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { startLocalEvm } from './local-evm.mjs';
import { parsePrivateKey, loadDeployerKey, runDeploy, NETWORKS, MAINNET_CONFIRM_FLAG } from '../scripts/lib/deploy-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const verifyScript = path.resolve(here, '../../../scripts/verify-tetrakis.mjs');
const SUPPLY = 1_000_000_000n * 10n ** 18n;
const LOCAL = { label: 'local anvil', chainId: 31337n, mainnet: false, explorer: '', faucets: [] };
const quiet = () => {};

describe('deployer key handling', () => {
  const fresh = ethers.Wallet.createRandom();
  const hex = fresh.privateKey;

  test('accepts 0x hex, bare hex and JSON keystore shapes', () => {
    assert.equal(parsePrivateKey(hex), hex);
    assert.equal(parsePrivateKey(hex.slice(2)), hex);
    assert.equal(parsePrivateKey(JSON.stringify({ wallet: { private_key: hex } })), hex);
    assert.equal(parsePrivateKey(JSON.stringify({ privateKey: hex })), hex);
  });

  test('rejects empty, malformed and key-less JSON input without echoing the input', () => {
    for (const bad of ['', '   ', '0x1234', 'not-a-key', '{"address":"0x1"}', '{bad json']) {
      assert.throws(() => parsePrivateKey(bad), err => !String(err.message).includes(bad.trim() || '\u0000'));
    }
  });

  test('env key wins over key file; missing everything throws NO_DEPLOYER_KEY', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttk-key-'));
    const other = ethers.Wallet.createRandom();
    const file = path.join(dir, 'k.json');
    fs.writeFileSync(file, JSON.stringify({ privateKey: other.privateKey }));
    try {
      assert.equal(loadDeployerKey({ TTK_DEPLOYER_PRIVATE_KEY: hex, TTK_DEPLOYER_KEY_FILE: file }, path.join(dir, 'none')).key, hex);
      assert.equal(loadDeployerKey({ TTK_DEPLOYER_KEY_FILE: file }, path.join(dir, 'none')).key, other.privateKey);
      assert.throws(() => loadDeployerKey({}, path.join(dir, 'none')), /NO_DEPLOYER_KEY/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('deployment flow on a real local EVM (anvil)', () => {
  let connection; let funder; let provider;
  before(async () => {
    connection = await startLocalEvm();
    provider = new ethers.JsonRpcProvider(connection.url, 31337, { staticNetwork: true });
    funder = (await provider.listAccounts())[0];
  });
  after(async () => { provider?.destroy(); await connection?.close(); });

  test('network table: Sepolia is chain 84532 and flagged non-mainnet; mainnet is 8453 and flagged', () => {
    assert.equal(NETWORKS['base-sepolia'].chainId, 84532n);
    assert.equal(NETWORKS['base-sepolia'].mainnet, false);
    assert.equal(NETWORKS['base-mainnet'].chainId, 8453n);
    assert.equal(NETWORKS['base-mainnet'].mainnet, true);
  });

  test('refuses to run when RPC chain differs from the selected network, sending nothing', async () => {
    const wallet = ethers.Wallet.createRandom();
    await assert.rejects(
      runDeploy({ network: { ...LOCAL, chainId: 84532n }, rpcUrl: connection.url, broadcast: true, privateKey: wallet.privateKey, writeReceipt: false, log: quiet }),
      /CHAIN_MISMATCH/
    );
  });

  test('mainnet broadcast is refused without the explicit confirmation flag (before any RPC call)', async () => {
    const wallet = ethers.Wallet.createRandom();
    await assert.rejects(
      runDeploy({ networkKey: 'base-mainnet', rpcUrl: 'http://127.0.0.1:1', broadcast: true, privateKey: wallet.privateKey, writeReceipt: false, log: quiet }),
      new RegExp('MAINNET_REFUSED.*' + MAINNET_CONFIRM_FLAG)
    );
  });

  test('plan for an unfunded deployer reports AWAITING_GAS_FUNDING and sends no transaction', async () => {
    const wallet = ethers.Wallet.createRandom();
    const { plan } = await runDeploy({ network: LOCAL, rpcUrl: connection.url, broadcast: false, privateKey: wallet.privateKey, writeReceipt: false, log: quiet });
    assert.equal(plan.status, 'PLAN_AWAITING_GAS_FUNDING');
    assert.equal(plan.deployerAddress, wallet.address);
    assert.equal(await provider.getTransactionCount(wallet.address), 0);
  });

  test('broadcast with an unfunded deployer fails with INSUFFICIENT_GAS_FUNDS and deploys nothing', async () => {
    const wallet = ethers.Wallet.createRandom();
    await assert.rejects(
      runDeploy({ network: LOCAL, rpcUrl: connection.url, broadcast: true, privateKey: wallet.privateKey, writeReceipt: false, log: quiet }),
      /INSUFFICIENT_GAS_FUNDS|GAS_ESTIMATE_FAILED/
    );
    assert.equal(await provider.getTransactionCount(wallet.address), 0);
  });

  test('funded deployer deploys the token; supply is fixed 1B and split 1M/999M; receipt carries no secret', async () => {
    const wallet = ethers.Wallet.createRandom();
    await (await funder.sendTransaction({ to: wallet.address, value: ethers.parseEther('1') })).wait();
    const lines = [];
    const result = await runDeploy({ network: LOCAL, rpcUrl: connection.url, broadcast: true, privateKey: wallet.privateKey, writeReceipt: false, log: m => lines.push(m) });

    assert.match(result.address, /^0x[0-9a-fA-F]{40}$/);
    const abi = ['function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)'];
    const token = new ethers.Contract(result.address, abi, provider);
    assert.equal(await token.totalSupply(), SUPPLY);
    assert.equal(await token.balanceOf('0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4'), 1_000_000n * 10n ** 18n);
    assert.equal(await token.balanceOf('0x4d308452a96D7dAbFd2f33d92677A3a2724f387e'), 999_000_000n * 10n ** 18n);
    assert.equal(await token.balanceOf(wallet.address), 0n, 'deployer only pays gas and receives no TTK');

    const serialized = JSON.stringify(result.receipt) + lines.join('\n');
    assert.ok(!serialized.includes(wallet.privateKey) && !serialized.includes(wallet.privateKey.slice(2)), 'private key must never be printed or stored');
    assert.equal(result.receipt.ok, true);
    assert.equal(result.receipt.bytecodeMatched, true);

    // Independent verification through the public CLI, address given by env var (as the owner would do).
    const cli = spawnSync(process.execPath, [verifyScript, '--chain-id', '31337', '--rpc', connection.url, '--expect-initial-allocation', '--transaction', result.receipt.transaction.hash], {
      env: { ...process.env, TTK_CONTRACT_ADDRESS: result.address }, encoding: 'utf8'
    });
    assert.equal(cli.status, 0, cli.stderr);
    const out = JSON.parse(cli.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.contractAddress, result.address);
    assert.equal(out.bytecodeMatched, true);
    assert.equal(out.totalSupply, SUPPLY.toString());
  });

  test('verify CLI fails for an address with no contract and requires an address', async () => {
    const empty = spawnSync(process.execPath, [verifyScript, '--chain-id', '31337', '--rpc', connection.url, '--address', ethers.Wallet.createRandom().address], { encoding: 'utf8' });
    assert.equal(empty.status, 1);
    assert.equal(JSON.parse(empty.stderr).code, 'NO_DEPLOYED_CONTRACT');
    const env = { ...process.env }; delete env.TTK_CONTRACT_ADDRESS;
    const none = spawnSync(process.execPath, [verifyScript, '--chain-id', '31337', '--rpc', connection.url], { encoding: 'utf8', env });
    assert.equal(none.status, 1);
    assert.equal(JSON.parse(none.stderr).code, 'CONTRACT_ADDRESS_REQUIRED');
  });
});
