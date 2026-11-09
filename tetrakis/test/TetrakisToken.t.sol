// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/TetrakisToken.sol";

contract TetrakisTokenTest is Test {
    TetrakisToken ttk;
    address owner = address(0xA11CE);
    address alice = address(0xA11CE1);
    address bob = address(0xB0B);

    function setUp() public {
        vm.deal(owner, 1 ether);
        ttk = new TetrakisToken(owner, 1_000_000 * 10 ** 18); // 1M initial
    }

    function test_InitialState() public {
        assertEq(ttk.name(), "Tetrakis");
        assertEq(ttk.symbol(), "TTK");
        assertEq(ttk.decimals(), 18);
        assertEq(ttk.totalSupply(), 1_000_000 * 10 ** 18);
        assertEq(ttk.totalMinted(), 1_000_000 * 10 ** 18);
        assertEq(ttk.balanceOf(owner), 1_000_000 * 10 ** 18);
    }

    function test_HardCap() public {
        assertEq(ttk.HARD_CAP(), 10_000_000 * 10 ** 18);
        assertEq(ttk.remainingMintable(), 9_000_000 * 10 ** 18);
    }

    function test_Mint() public {
        vm.prank(owner);
        ttk.mint(alice, 500_000 * 10 ** 18);
        assertEq(ttk.balanceOf(alice), 500_000 * 10 ** 18);
        assertEq(ttk.totalMinted(), 1_500_000 * 10 ** 18);
    }

    function test_RevertMintExceedsCap() public {
        vm.startPrank(owner);
        // Try to mint more than remaining
        uint256 remaining = ttk.remainingMintable();
        vm.expectRevert("Mint would exceed hard cap");
        ttk.mint(alice, remaining + 1);
        vm.stopPrank();
    }

    function test_RevertNonOwnerMint() public {
        vm.prank(alice);
        vm.expectRevert();
        ttk.mint(alice, 1000);
    }

    function test_Burn() public {
        vm.startPrank(owner);
        ttk.transfer(alice, 1000 * 10 ** 18);
        vm.stopPrank();

        vm.prank(alice);
        ttk.burn(500 * 10 ** 18);

        assertEq(ttk.balanceOf(alice), 500 * 10 ** 18);
        // totalSupply decreased, but totalMinted stays same
        assertEq(ttk.totalSupply(), 1_000_000 * 10 ** 18 - 500 * 10 ** 18);
        assertEq(ttk.totalMinted(), 1_000_000 * 10 ** 18);
    }

    function test_BatchMint() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = address(0xCAFE);

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100_000 * 10 ** 18;
        amounts[1] = 200_000 * 10 ** 18;
        amounts[2] = 300_000 * 10 ** 18;

        vm.prank(owner);
        ttk.batchMint(recipients, amounts);

        assertEq(ttk.balanceOf(alice), 100_000 * 10 ** 18);
        assertEq(ttk.balanceOf(bob), 200_000 * 10 ** 18);
        assertEq(ttk.balanceOf(address(0xCAFE)), 300_000 * 10 ** 18);
        assertEq(ttk.totalMinted(), 1_600_000 * 10 ** 18);
    }

    function test_Transfer() public {
        vm.prank(owner);
        ttk.transfer(alice, 1000 * 10 ** 18);
        assertEq(ttk.balanceOf(alice), 1000 * 10 ** 18);
        assertEq(ttk.balanceOf(owner), 1_000_000 * 10 ** 18 - 1000 * 10 ** 18);
    }

    function test_Permit() public {
        uint256 ownerPK = 0xA11CE_PK; // placeholder
        // Permit testing requires proper key derivation
        // In production, use forge's vm.sign for EIP-712
        // This is a placeholder for the test structure
    }

    function test_RenounceOwnership() public {
        vm.prank(owner);
        ttk.renounceOwnership();
        assertEq(ttk.owner(), address(0));

        // Minting should now fail
        vm.expectRevert();
        ttk.mint(alice, 1000);
    }
}
