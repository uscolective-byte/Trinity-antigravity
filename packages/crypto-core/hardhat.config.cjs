// Hardhat project that tests the CANONICAL Tetrakis ($TTK) contract.
// Source of truth: contracts/tetrakis/TetrakisToken.sol (contracts/TetrakisToken.sol here is a verified copy,
// see test/source-sync.test.cjs). Deployment to Base Sepolia/Mainnet is done by contracts/tetrakis/scripts/*,
// so no network credentials are configured here.
require("@nomicfoundation/hardhat-chai-matchers");

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { evmVersion: "shanghai", optimizer: { enabled: true, runs: 200 } },
  },
};
