// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentValidationRegistry
 * @dev Cryptographic strategy validation with validator consensus
 */
contract AgentValidationRegistry is Ownable {
    struct StrategyProof {
        string proofURI;              // IPFS hash of proof bundle
        bytes32 strategyHash;         // SHA-256 of strategy code
        uint256 sharpeRatio;          // Risk-adjusted return (scaled 100x)
        uint256 maxDrawdown;          // Max % loss (basis points)
        uint256 submittedAt;
        uint256 validatorApprovals;
        uint256 validatorRejections;
        bool isValidated;
    }

    mapping(bytes32 => StrategyProof) public proofs;
    mapping(address => bool) public validators;
    mapping(bytes32 => mapping(address => bool)) public hasValidated;
    
    uint256 public constant QUORUM = 2;  // 2 out of 3 validators required

    event ProofSubmitted(
        bytes32 indexed agentId,
        string proofURI,
        bytes32 strategyHash,
        uint256 sharpeRatio,
        uint256 maxDrawdown
    );
    event ProofValidated(
        bytes32 indexed agentId,
        address indexed validator,
        bool approved
    );
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    modifier onlyValidator() {
        require(validators[msg.sender], "Not a validator");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Owner is automatically a validator
        validators[msg.sender] = true;
    }

    function submitProof(
        bytes32 agentId,
        string memory strategyProofURI,
        bytes32 strategyHash,
        uint256 sharpeRatio,
        uint256 maxDrawdown
    ) external {
        require(bytes(strategyProofURI).length > 0, "Proof URI required");
        require(strategyHash != bytes32(0), "Strategy hash required");
        require(proofs[agentId].submittedAt == 0, "Proof already exists");

        proofs[agentId] = StrategyProof({
            proofURI: strategyProofURI,
            strategyHash: strategyHash,
            sharpeRatio: sharpeRatio,
            maxDrawdown: maxDrawdown,
            submittedAt: block.timestamp,
            validatorApprovals: 0,
            validatorRejections: 0,
            isValidated: false
        });

        emit ProofSubmitted(agentId, strategyProofURI, strategyHash, sharpeRatio, maxDrawdown);
    }

    function validateProof(bytes32 agentId, bool approved) external onlyValidator {
        require(proofs[agentId].submittedAt > 0, "Proof not found");
        require(!hasValidated[agentId][msg.sender], "Already validated");
        require(!proofs[agentId].isValidated, "Already validated");

        hasValidated[agentId][msg.sender] = true;

        if (approved) {
            proofs[agentId].validatorApprovals++;
            if (proofs[agentId].validatorApprovals >= QUORUM) {
                proofs[agentId].isValidated = true;
            }
        } else {
            proofs[agentId].validatorRejections++;
        }

        emit ProofValidated(agentId, msg.sender, approved);
    }

    function addValidator(address validator) external onlyOwner {
        require(!validators[validator], "Already a validator");
        validators[validator] = true;
        emit ValidatorAdded(validator);
    }

    function removeValidator(address validator) external onlyOwner {
        require(validators[validator], "Not a validator");
        validators[validator] = false;
        emit ValidatorRemoved(validator);
    }
}
