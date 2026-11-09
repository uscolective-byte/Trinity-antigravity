// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Tetrakis Token ($TTK)
 * @author Trinity AI OS
 * @notice ERC-20 token with hard cap, burnable, and ERC-2612 Permit (gasless approvals)
 * @dev Built on OpenZeppelin Contracts 5.x
 *
 * Features:
 *   - Standard ERC-20 (transfer, approve, transferFrom)
 *   - Hard cap: 10,000,000 TTK (never exceeds)
 *   - ERC-2612 Permit (EIP-712 typed data — gasless approvals)
 *   - Burnable (holders can burn their own tokens)
 *   - Ownable (owner can mint up to cap, renounce ownership)
 *   - EIP-2612 domain separator for Base chain
 *
 * Network: Base (Chain ID 8453)
 * Compiler: solc 0.8.20+, optimizer enabled (200 runs)
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TetrakisToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    // ── Constants ──────────────────────────────────────────────
    /// @notice Maximum total supply: 10,000,000 TTK (with 18 decimals)
    uint256 public constant HARD_CAP = 10_000_000 * 10 ** 18;

    /// @notice Tokens already minted (tracks total ever minted, not burned)
    uint256 public totalMinted;

    // ── Events ─────────────────────────────────────────────────
    event Minted(address indexed to, uint256 amount, uint256 totalMinted);
    event CapApproaching(uint256 remaining);

    // ── Constructor ───────────────────────────────────────────
    /**
     * @param initialOwner   Address that receives ownership (can mint)
     * @param initialSupply  Initial tokens minted to initialOwner (≤ HARD_CAP)
     */
    constructor(
        address initialOwner,
        uint256 initialSupply
    ) ERC20("Tetrakis", "TTK") ERC20Permit("Tetrakis") Ownable(initialOwner) {
        require(initialOwner != address(0), "Owner cannot be zero address");
        require(initialSupply <= HARD_CAP, "Initial supply exceeds hard cap");

        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply);
            totalMinted = initialSupply;
            emit Minted(initialOwner, initialSupply, totalMinted);
        }
    }

    // ── Minting (respecting hard cap) ─────────────────────────
    /**
     * @notice Mint tokens to an address. Only owner. Respects HARD_CAP.
     * @param to     Recipient address
     * @param amount Amount in wei (1 TTK = 10^18 wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(totalMinted + amount <= HARD_CAP, "Mint would exceed hard cap");

        _mint(to, amount);
        totalMinted += amount;

        emit Minted(to, amount, totalMinted);

        // Warn when approaching cap
        uint256 remaining = HARD_CAP - totalMinted;
        if (remaining <= HARD_CAP / 20) { // 5% remaining
            emit CapApproaching(remaining);
        }
    }

    /**
     * @notice Batch mint to multiple addresses. Only owner.
     * @param recipients Array of recipient addresses
     * @param amounts    Array of amounts (must match recipients length)
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Array length mismatch");

        uint256 totalToMint = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalToMint += amounts[i];
        }
        require(totalMinted + totalToMint <= HARD_CAP, "Batch mint exceeds hard cap");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Zero address in recipients");
            _mint(recipients[i], amounts[i]);
        }
        totalMinted += totalToMint;
        emit Minted(address(0), totalToMint, totalMinted);
    }

    // ── Views ─────────────────────────────────────────────────
    /**
     * @notice Remaining mintable supply
     */
    function remainingMintable() external view returns (uint256) {
        return HARD_CAP - totalMinted;
    }

    /**
     * @notice Decimals (ERC-20 standard: 18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    // ── Safety ─────────────────────────────────────────────────
    /**
     * @notice Renounce ownership (no more minting possible after this)
     * @dev Once renounced, the hard cap is permanently enforced
     */
    function renounceOwnership() public override onlyOwner {
        super.renounceOwnership();
    }
}
