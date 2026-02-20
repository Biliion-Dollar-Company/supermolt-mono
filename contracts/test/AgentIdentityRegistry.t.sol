// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentIdentityRegistry.sol";

contract AgentIdentityRegistryTest is Test {
    AgentIdentityRegistry public registry;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    uint256 internal newWalletPrivateKey = 0xA11CE;
    address public newWallet;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentWalletChanged(uint256 indexed agentId, address indexed oldWallet, address indexed newWallet);
    event AgentMetadataUpdated(uint256 indexed agentId, string key, string value);

    function setUp() public {
        newWallet = vm.addr(newWalletPrivateKey);
        vm.prank(owner);
        registry = new AgentIdentityRegistry();
    }

    function testRegisterAgent() public {
        vm.prank(user1);
        
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(1, user1, "ipfs://agent1");
        
        uint256 agentId = registry.register("ipfs://agent1");
        
        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), user1);
        assertEq(registry.tokenURI(agentId), "ipfs://agent1");
    }

    function testRegisterMultipleAgents() public {
        vm.prank(user1);
        uint256 agent1 = registry.register("ipfs://agent1");
        
        vm.prank(user2);
        uint256 agent2 = registry.register("ipfs://agent2");
        
        assertEq(agent1, 1);
        assertEq(agent2, 2);
        assertEq(registry.ownerOf(agent1), user1);
        assertEq(registry.ownerOf(agent2), user2);
    }

    function testSetAgentWallet() public {
        // Register agent
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        // Get EIP-712 domain separator and nonce
        bytes32 domainSeparator = registry.getDomainSeparator();
        uint256 nonce = registry.getNonce(agentId);

        // Create EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("WalletChange(uint256 agentId,address newWallet,uint256 nonce)"),
                agentId,
                newWallet,
                nonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Set wallet
        vm.prank(user1);
        vm.expectEmit(true, true, true, false);
        emit AgentWalletChanged(agentId, address(0), newWallet);
        
        registry.setAgentWallet(agentId, newWallet, signature);

        // Verify
        assertEq(registry.getAgentWallet(agentId), newWallet);
    }

    function testSetAgentWalletFailsWithInvalidSignature() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        bytes memory invalidSignature = abi.encodePacked(bytes32(0), bytes32(0), uint8(0));

        vm.prank(user1);
        vm.expectRevert(); // ECDSA throws custom error
        registry.setAgentWallet(agentId, newWallet, invalidSignature);
    }

    function testSetAgentWalletFailsIfNotOwner() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        bytes32 domainSeparator = registry.getDomainSeparator();
        uint256 nonce = registry.getNonce(agentId);

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("WalletChange(uint256 agentId,address newWallet,uint256 nonce)"),
                agentId,
                newWallet,
                nonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user2); // Different user
        vm.expectRevert("Not agent owner");
        registry.setAgentWallet(agentId, newWallet, signature);
    }

    function testSetMetadata() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit AgentMetadataUpdated(agentId, "category", "trading");
        
        registry.setMetadata(agentId, "category", "trading");

        assertEq(registry.getMetadata(agentId, "category"), "trading");
    }

    function testSetMetadataFailsForReservedKey() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        vm.prank(user1);
        vm.expectRevert("Use setAgentWallet for agentWallet");
        registry.setMetadata(agentId, "agentWallet", "0x123");
    }

    function testSetMetadataFailsIfNotOwner() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        vm.prank(user2);
        vm.expectRevert("Not agent owner");
        registry.setMetadata(agentId, "category", "trading");
    }

    function testGetMetadata() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        vm.startPrank(user1);
        registry.setMetadata(agentId, "version", "1.0");
        registry.setMetadata(agentId, "type", "sniper");
        vm.stopPrank();

        assertEq(registry.getMetadata(agentId, "version"), "1.0");
        assertEq(registry.getMetadata(agentId, "type"), "sniper");
    }

    function testNonceIncrementsOnWalletChange() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1");

        uint256 initialNonce = registry.getNonce(agentId);
        assertEq(initialNonce, 0);

        // Set wallet once
        bytes32 domainSeparator = registry.getDomainSeparator();
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("WalletChange(uint256 agentId,address newWallet,uint256 nonce)"),
                agentId,
                newWallet,
                initialNonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        registry.setAgentWallet(agentId, newWallet, signature);

        // Check nonce incremented
        assertEq(registry.getNonce(agentId), 1);
    }
}
