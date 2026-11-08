#!/usr/bin/env node
/**
 * Tetrakis ($TTK) - Base Sepolia TESTNET deployer (default, safe network).
 *   node scripts/deploy-base-sepolia.mjs              -> read-only plan (also: --dry-run)
 *   node scripts/deploy-base-sepolia.mjs --broadcast  -> real testnet deployment
 * Deployer key: env TTK_DEPLOYER_PRIVATE_KEY or file TTK_DEPLOYER_KEY_FILE (never printed/committed).
 * The script aborts if the RPC is not chainId 84532, so it can never touch mainnet.
 */
import { cli } from './lib/deploy-core.mjs';
process.exitCode = await cli('base-sepolia', process.argv.slice(2));
