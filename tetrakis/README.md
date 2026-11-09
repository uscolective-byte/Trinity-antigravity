# Tetrakis Token ($TTK) — Real, Deployable Smart Contract

## Overview

Production-ready ERC-20 token contract for the Tetrakis ($TTK) token on Base (L2).

| Property | Value |
|---|---|
| Name | Tetrakis |
| Symbol | TTK |
| Decimals | 18 |
| Hard Cap | 10,000,000 TTK (10M × 10¹⁸) |
| Chain | Base (Chain ID 8453) |
| Standard | ERC-20 + ERC-2612 (Permit) + ERC-20Burnable + Ownable |
| License | MIT |

## Features

- **Hard Cap Enforcement** — `totalMinted` can never exceed 10,000,000 TTK. Even if tokens are burned, the cap is on total ever-minted, not circulating supply.
- **ERC-2612 Permit** — Gasless approvals via EIP-712 typed data signatures. Users can approve spending without a separate on-chain transaction.
- **Burnable** — Any holder can burn their own tokens (`burn()`), or burn approved tokens (`burnFrom()`).
- **Batch Mint** — Owner can mint to multiple addresses in one transaction (`batchMint()`).
- **Ownable** — Owner can mint and transfer ownership. `renounceOwnership()` permanently locks minting.
- **Cap Warning** — Emits `CapApproaching` event when <5% of supply remains mintable.

## Files

```
tetrakis/
├── contracts/
│   └── TetrakisToken.sol          # Solidity smart contract (OpenZeppelin 5.x)
├── abi/
│   └── TetrakisTokenABI.json      # Full ABI (277 lines, all functions + events)
├── src/
│   └── ttk-contract.js            # JS/TS interface for Worker integration
├── foundry.toml                   # Foundry config
├── script/
│   └── Deploy.s.sol               # Deployment script
└── README.md                      # This file
```

## Deploy with Foundry

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# 3. Set up remappings (foundry.toml already configured)
# remappings = ["@openzeppelin/=lib/openzeppelin-contracts/"]

# 4. Compile
forge build

# 5. Deploy to Base mainnet
# Replace with your deployer private key and initial supply
export DEPLOYER_PK="your-private-key"
export INITIAL_SUPPLY="5000000000000000000000000"  # 5,000,000 TTK (50% of cap)

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PK \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# 6. Verify on Basescan (if not auto-verified)
forge verify-contract <CONTRACT_ADDRESS> TetrakisToken \
  --chain-id 8453 \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Deploy with Hardhat (alternative)

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network base
```

## Worker Integration (Trinity)

The `src/ttk-contract.js` file provides read-only RPC helpers that work directly from the Trinity Worker without ethers.js:

```javascript
import { getTTKBalance, getTTKTotalSupply, formatTTK, TETRAKIS_CONFIG } from './tetrakis/src/ttk-contract.js';

// After deployment, set the contract address
const TTK_CONTRACT = "0x..."; // Your deployed contract address

// Get balance
const balanceWei = await getTTKBalance(TTK_CONTRACT, userWallet);
const balanceTTK = formatTTK(balanceWei);
// → "5000.0000"

// Get total supply
const supply = await getTTKTotalSupply(TTK_CONTRACT);
// → "5000000000000000000000000" (5M TTK in wei)
```

## ABI Usage (frontend, ethers.js, viem)

```javascript
import { ethers } from "ethers";
import TTK_ABI from "./tetrakis/abi/TetrakisTokenABI.json";

const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const ttk = new ethers.Contract(CONTRACT_ADDRESS, TTK_ABI, provider);

// Read
const balance = await ttk.balanceOf(userAddress);
const supply = await ttk.totalSupply();
const remaining = await ttk.remainingMintable();

// Write (requires signer)
const tx = await ttk.connect(signer).transfer(recipient, amount);
await tx.wait();

// ERC-2612 Permit (gasless approval)
const deadline = Math.floor(Date.now() / 1000) + 3600;
const sig = await signer.signTypedData(domain, types, values);
await ttk.permit(owner, spender, value, deadline, sig.v, sig.r, sig.s);
```

## Security Notes

- **Audit required** — This contract is generated code. Have it professionally audited before mainnet deployment with real value.
- **Test on Base Sepolia first** — Deploy to testnet (Chain ID 84532, RPC: `https://sepolia.base.org`) and verify all functions.
- **Renounce ownership** — After minting is complete, call `renounceOwnership()` to permanently disable minting. This makes the token fully decentralized.
- **Hard cap is on `totalMinted`, not `totalSupply`** — Burning tokens reduces `totalSupply` but does NOT free up mintable supply. This is intentional to prevent re-inflation.
- **OpenZeppelin 5.x** — Uses the latest audited OpenZeppelin contracts. Ensure your `forge install` pulls v5.x.

## Token Registration (Post-Deployment)

After deploying and verifying on Basescan:

1. **Update token metadata** on Basescan (logo, website, description)
2. **Submit to token lists**: Coinbase Token List, Uniswap Default Token List (GitHub PRs)
3. **Add to Trinity D1**: Update `TETRAKIS_CONFIG.contractAddress` in the Worker

## Disclaimer

This is open-source smart contract code, not financial advice. Token deployment, liquidity provision, and exchange listing involve financial risk. Conduct your own research, get a professional audit, and comply with applicable regulations.
