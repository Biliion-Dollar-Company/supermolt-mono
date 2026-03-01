// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentIdentityRegistry
 * @dev Register AI agents with immutable on-chain identities
 */
contract AgentIdentityRegistry is Ownable {
    struct AgentIdentity {
        address owner;
        string metadataURI;      // IPFS hash
        string strategyArchetype; // "Liquidity Sniper", "Momentum", etc.
        uint256 registeredAt;
        bool isActive;
    }

    mapping(bytes32 => AgentIdentity) public agents;
    mapping(address => bytes32[]) public ownerAgents;

    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        string metadataURI,
        string strategyArchetype
    );
    event AgentUpdated(bytes32 indexed agentId, string metadataURI);
    event AgentDeactivated(bytes32 indexed agentId);

    constructor() Ownable(msg.sender) {}

    function registerAgent(
        bytes32 agentId,
        string memory metadataURI,
        string memory strategyArchetype
    ) external {
        require(agents[agentId].registeredAt == 0, "Agent already exists");
        require(bytes(metadataURI).length > 0, "Metadata URI required");
        require(bytes(strategyArchetype).length > 0, "Strategy archetype required");

        agents[agentId] = AgentIdentity({
            owner: msg.sender,
            metadataURI: metadataURI,
            strategyArchetype: strategyArchetype,
            registeredAt: block.timestamp,
            isActive: true
        });

        ownerAgents[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, metadataURI, strategyArchetype);
    }

    function updateMetadata(bytes32 agentId, string memory newMetadataURI) external {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        require(agents[agentId].isActive, "Agent deactivated");
        require(bytes(newMetadataURI).length > 0, "Metadata URI required");

        agents[agentId].metadataURI = newMetadataURI;
        emit AgentUpdated(agentId, newMetadataURI);
    }

    function deactivateAgent(bytes32 agentId) external {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        require(agents[agentId].isActive, "Already deactivated");

        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId);
    }

    function getOwnerAgents(address owner) external view returns (bytes32[] memory) {
        return ownerAgents[owner];
    }
}
