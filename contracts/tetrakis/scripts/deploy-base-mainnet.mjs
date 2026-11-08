#!/usr/bin/env node
/**
 * Tetrakis ($TTK) - Base MAINNET deployer. REAL MONEY, IRREVERSIBLE.
 * Without --broadcast it is a read-only plan. A live deployment additionally needs
 * the explicit flag --i-understand-mainnet-is-irreversible. Do not run without the owner's approval.
 */
import { cli } from './lib/deploy-core.mjs';
process.exitCode = await cli('base-mainnet', process.argv.slice(2));
