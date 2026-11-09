// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/TetrakisToken.sol";

/**
 * @title Deploy Script for TetrakisToken
 * @notice Deploys TetrakisToken to Base with configurable initial supply
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url https://mainnet.base.org \
 *     --private-key $DEPLOYER_PK \
 *     --broadcast \
 *     --verify
 *
 * For testnet:
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url https://sepolia.base.org \
 *     --private-key $DEPLOYER_PK \
 *     --broadcast
 */
contract DeployScript is Script {
    // Initial supply: 5,000,000 TTK (50% of hard cap)
    // Change this in the script or pass via env
    uint256 constant INITIAL_SUPPLY = 5_000_000 * 10 ** 18;

    function run() external {
        // Deployer is derived from --private-key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TetrakisToken
        TetrakisToken ttk = new TetrakisToken(deployer, INITIAL_SUPPLY);

        vm.stopBroadcast();

        // Log deployment info
        console.log("=== Tetrakis Token Deployed ===");
        console.log("Contract address:", address(ttk));
        console.log("Owner (deployer):", deployer);
        console.log("Initial supply:", INITIAL_SUPPLY);
        console.log("Hard cap:", ttk.HARD_CAP());
        console.log("Chain ID:", block.chainid);
        console.log("================================");

        // Verify on Basescan
        // forge verify-contract <address> TetrakisToken --chain-id 8453
    }
}
