/**
 * Tetrakis ($TTK) Official ERC-20 Smart Contract SDK
 * Trinity Sovereign Autonomous Architecture
 * Author: Basterix (Root Architect)
 */

import { Contract, ContractFactory } from 'ethers';
import artifact from './build/TetrakisToken.json' with { type: 'json' };

export const TETRAKIS_NAME = 'Tetrakis';
export const TETRAKIS_SYMBOL = 'TTK';
export const TETRAKIS_DECIMALS = 18;
export const TETRAKIS_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const OFFICIAL_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';

export const ABI = artifact.abi;
export const BYTECODE = artifact.bytecode;
export const DEPLOYED_BYTECODE = artifact.deployedBytecode;
export const RUNTIME_KECCAK256 = '0x5db6aa4e0b155cc4eb54b45ce1ecde5ec0feb55c12e4fc75153b1615c5c9652c';

export function getTetrakisContract(address, signerOrProvider) {
  return new Contract(address, ABI, signerOrProvider);
}

export function getTetrakisFactory(signer) {
  return new ContractFactory(ABI, BYTECODE, signer);
}

export default {
  name: TETRAKIS_NAME,
  symbol: TETRAKIS_SYMBOL,
  decimals: TETRAKIS_DECIMALS,
  totalSupply: TETRAKIS_TOTAL_SUPPLY,
  treasury: OFFICIAL_TREASURY,
  abi: ABI,
  bytecode: BYTECODE,
  runtimeKeccak256: RUNTIME_KECCAK256,
  getContract: getTetrakisContract,
  getFactory: getTetrakisFactory
};
