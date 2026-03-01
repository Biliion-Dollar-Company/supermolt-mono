// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentReputationRegistry
 * @dev Track performance metrics and community feedback for AI agents
 */
contract AgentReputationRegistry is Ownable {
    struct AgentReputation {
        uint256 totalTrades;
        uint256 successfulTrades;
        int256 pnlBasisPoints;  // 10000 = 100%
        uint256 feedbackCount;
        uint256 totalRating;
        uint256 lastUpdated;
    }

    struct Feedback {
        address reviewer;
        uint8 rating;  // 1-5 stars
        string comment;
        uint256 timestamp;
    }

    mapping(bytes32 => AgentReputation) public reputations;
    mapping(bytes32 => Feedback[]) private agentFeedback;
    mapping(bytes32 => mapping(address => bool)) public hasReviewed;

    event PerformanceUpdated(
        bytes32 indexed agentId,
        uint256 totalTrades,
        uint256 successfulTrades,
        int256 pnlBasisPoints
    );
    event FeedbackSubmitted(
        bytes32 indexed agentId,
        address indexed reviewer,
        uint8 rating,
        string comment
    );

    constructor() Ownable(msg.sender) {}

    function updatePerformance(
        bytes32 agentId,
        uint256 totalTrades,
        uint256 successfulTrades,
        int256 pnlBasisPoints
    ) external onlyOwner {
        require(totalTrades >= successfulTrades, "Invalid trades");

        reputations[agentId] = AgentReputation({
            totalTrades: totalTrades,
            successfulTrades: successfulTrades,
            pnlBasisPoints: pnlBasisPoints,
            feedbackCount: reputations[agentId].feedbackCount,
            totalRating: reputations[agentId].totalRating,
            lastUpdated: block.timestamp
        });

        emit PerformanceUpdated(agentId, totalTrades, successfulTrades, pnlBasisPoints);
    }

    function submitFeedback(
        bytes32 agentId,
        uint8 rating,
        string memory comment
    ) external {
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        require(!hasReviewed[agentId][msg.sender], "Already reviewed");

        agentFeedback[agentId].push(Feedback({
            reviewer: msg.sender,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp
        }));

        reputations[agentId].feedbackCount++;
        reputations[agentId].totalRating += rating;
        hasReviewed[agentId][msg.sender] = true;

        emit FeedbackSubmitted(agentId, msg.sender, rating, comment);
    }

    function getWinRate(bytes32 agentId) public view returns (uint256) {
        if (reputations[agentId].totalTrades == 0) return 0;
        return (reputations[agentId].successfulTrades * 10000) / reputations[agentId].totalTrades;
    }

    function getAverageRating(bytes32 agentId) public view returns (uint256) {
        if (reputations[agentId].feedbackCount == 0) return 0;
        return reputations[agentId].totalRating / reputations[agentId].feedbackCount;
    }

    function getFeedback(bytes32 agentId) external view returns (Feedback[] memory) {
        return agentFeedback[agentId];
    }
}
