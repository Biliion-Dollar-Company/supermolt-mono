// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SuperMoltRewardToken
 * @notice Upgradeable ERC-20 reward token for SuperMolt arena
 * @dev Uses UUPS proxy pattern for upgradeability
 */
contract SuperMoltRewardToken is 
    Initializable, 
    ERC20Upgradeable, 
    OwnableUpgradeable, 
    UUPSUpgradeable 
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param initialOwner Address that will own the contract and receive initial supply
     */
    function initialize(address initialOwner) public initializer {
        __ERC20_init("SuperMolt Reward", "SMOLT");
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();

        // Mint 1,000,000 SMOLT to the treasury (initial owner)
        _mint(initialOwner, 1_000_000 * 10**decimals());
    }

    /**
     * @notice Mint new tokens (only owner can call)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount of tokens to burn (in wei, 18 decimals)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Required by UUPS pattern - authorizes upgrades
     * @dev Only owner can upgrade the implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get the current version of the contract
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
