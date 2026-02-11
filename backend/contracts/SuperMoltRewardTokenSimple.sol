// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SuperMoltRewardTokenSimple
 * @notice Simple ERC-20 reward token (non-upgradeable, ready to use)
 */
contract SuperMoltRewardTokenSimple is ERC20, Ownable {
    constructor() ERC20("SuperMolt Reward", "SMOLT") Ownable(msg.sender) {
        // Mint 1,000,000 SMOLT to deployer (treasury)
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }

    /**
     * @notice Mint new tokens (only owner)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Get version
     */
    function version() external pure returns (string memory) {
        return "1.0.0-simple";
    }
}
