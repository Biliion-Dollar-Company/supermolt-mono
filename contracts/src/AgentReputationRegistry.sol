// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentReputationRegistry
 * @dev ERC-8004 compliant Agent Reputation Registry
 * Stores and manages feedback for AI agents
 */
contract AgentReputationRegistry {
    
    struct Feedback {
        address client;          // Address of the client giving feedback
        int128 value;           // Feedback value (can be negative)
        uint8 decimals;         // Number of decimal places
        string tag1;            // First categorization tag
        string tag2;            // Second categorization tag
        string feedbackURI;     // URI to detailed feedback
        uint64 timestamp;       // When feedback was given
        bool revoked;           // Whether feedback has been revoked
    }

    // agentId => client => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private _feedback;
    
    // agentId => client => feedback count
    mapping(uint256 => mapping(address => uint64)) private _feedbackCount;

    // Events
    event NewFeedback(
        uint256 indexed agentId,
        address indexed client,
        uint64 indexed feedbackIndex,
        int128 value,
        uint8 decimals,
        string tag1,
        string tag2,
        string feedbackURI
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed client,
        uint64 indexed feedbackIndex
    );

    /**
     * @dev Give feedback for an agent
     * @param agentId The ID of the agent
     * @param value The feedback value (can be negative for poor performance)
     * @param decimals Number of decimal places for the value
     * @param tag1 First categorization tag (e.g., "trading", "liquidity")
     * @param tag2 Second categorization tag (e.g., "speed", "accuracy")
     * @param feedbackURI URI to detailed feedback data
     * @return feedbackIndex The index of the feedback
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 decimals,
        string memory tag1,
        string memory tag2,
        string memory feedbackURI
    ) external returns (uint64) {
        require(decimals <= 18, "Decimals too high");
        
        uint64 feedbackIndex = _feedbackCount[agentId][msg.sender]++;
        
        _feedback[agentId][msg.sender][feedbackIndex] = Feedback({
            client: msg.sender,
            value: value,
            decimals: decimals,
            tag1: tag1,
            tag2: tag2,
            feedbackURI: feedbackURI,
            timestamp: uint64(block.timestamp),
            revoked: false
        });

        emit NewFeedback(
            agentId,
            msg.sender,
            feedbackIndex,
            value,
            decimals,
            tag1,
            tag2,
            feedbackURI
        );

        return feedbackIndex;
    }

    /**
     * @dev Revoke previously given feedback
     * @param agentId The ID of the agent
     * @param feedbackIndex The index of the feedback to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage feedback = _feedback[agentId][msg.sender][feedbackIndex];
        require(feedback.client == msg.sender, "Not feedback owner");
        require(!feedback.revoked, "Already revoked");
        
        feedback.revoked = true;

        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @dev Get specific feedback
     * @param agentId The ID of the agent
     * @param client The address of the client who gave feedback
     * @param feedbackIndex The index of the feedback
     * @return The feedback struct
     */
    function getFeedback(
        uint256 agentId,
        address client,
        uint64 feedbackIndex
    ) external view returns (Feedback memory) {
        return _feedback[agentId][client][feedbackIndex];
    }

    /**
     * @dev Get the number of feedback entries from a specific client
     * @param agentId The ID of the agent
     * @param client The address of the client
     * @return The number of feedback entries
     */
    function getFeedbackCount(uint256 agentId, address client) external view returns (uint64) {
        return _feedbackCount[agentId][client];
    }

    /**
     * @dev Get aggregated reputation summary for an agent from specified clients
     * @param agentId The ID of the agent
     * @param clients Array of client addresses to include in summary
     * @return totalValue Sum of all non-revoked feedback values
     * @return count Number of non-revoked feedback entries
     * @return averageValue Average feedback value (scaled by 1e18)
     */
    function getSummary(
        uint256 agentId,
        address[] memory clients
    ) external view returns (
        int256 totalValue,
        uint256 count,
        int256 averageValue
    ) {
        totalValue = 0;
        count = 0;

        for (uint256 i = 0; i < clients.length; i++) {
            address client = clients[i];
            uint64 feedbackCount = _feedbackCount[agentId][client];

            for (uint64 j = 0; j < feedbackCount; j++) {
                Feedback storage feedback = _feedback[agentId][client][j];
                
                if (!feedback.revoked) {
                    // Scale value to 18 decimals for aggregation
                    int256 scaledValue = int256(feedback.value) * int256(10 ** (18 - feedback.decimals));
                    totalValue += scaledValue;
                    count++;
                }
            }
        }

        if (count > 0) {
            averageValue = totalValue / int256(count);
        } else {
            averageValue = 0;
        }

        return (totalValue, count, averageValue);
    }

    /**
     * @dev Get all feedback from a specific client for an agent
     * @param agentId The ID of the agent
     * @param client The address of the client
     * @return Array of all feedback from that client
     */
    function getClientFeedback(
        uint256 agentId,
        address client
    ) external view returns (Feedback[] memory) {
        uint64 count = _feedbackCount[agentId][client];
        Feedback[] memory result = new Feedback[](count);

        for (uint64 i = 0; i < count; i++) {
            result[i] = _feedback[agentId][client][i];
        }

        return result;
    }

    /**
     * @dev Get feedback filtered by tags
     * @param agentId The ID of the agent
     * @param clients Array of client addresses
     * @param tag Search for this tag in either tag1 or tag2
     * @return Filtered array of feedback matching the tag
     */
    function getFeedbackByTag(
        uint256 agentId,
        address[] memory clients,
        string memory tag
    ) external view returns (Feedback[] memory) {
        // First pass: count matching feedback
        uint256 matchCount = 0;
        for (uint256 i = 0; i < clients.length; i++) {
            address client = clients[i];
            uint64 feedbackCount = _feedbackCount[agentId][client];

            for (uint64 j = 0; j < feedbackCount; j++) {
                Feedback storage feedback = _feedback[agentId][client][j];
                if (!feedback.revoked) {
                    if (
                        keccak256(bytes(feedback.tag1)) == keccak256(bytes(tag)) ||
                        keccak256(bytes(feedback.tag2)) == keccak256(bytes(tag))
                    ) {
                        matchCount++;
                    }
                }
            }
        }

        // Second pass: collect matching feedback
        Feedback[] memory result = new Feedback[](matchCount);
        uint256 resultIndex = 0;

        for (uint256 i = 0; i < clients.length; i++) {
            address client = clients[i];
            uint64 feedbackCount = _feedbackCount[agentId][client];

            for (uint64 j = 0; j < feedbackCount; j++) {
                Feedback storage feedback = _feedback[agentId][client][j];
                if (!feedback.revoked) {
                    if (
                        keccak256(bytes(feedback.tag1)) == keccak256(bytes(tag)) ||
                        keccak256(bytes(feedback.tag2)) == keccak256(bytes(tag))
                    ) {
                        result[resultIndex++] = feedback;
                    }
                }
            }
        }

        return result;
    }
}
