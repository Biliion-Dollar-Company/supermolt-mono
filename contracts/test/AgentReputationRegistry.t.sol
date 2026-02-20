// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentReputationRegistry.sol";

contract AgentReputationRegistryTest is Test {
    AgentReputationRegistry public registry;
    
    address public client1 = address(1);
    address public client2 = address(2);
    address public client3 = address(3);

    uint256 constant AGENT_ID = 1;

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

    function setUp() public {
        registry = new AgentReputationRegistry();
    }

    function testGiveFeedback() public {
        vm.prank(client1);
        
        vm.expectEmit(true, true, true, true);
        emit NewFeedback(AGENT_ID, client1, 0, 85, 0, "trading", "accuracy", "ipfs://feedback1");
        
        uint64 index = registry.giveFeedback(
            AGENT_ID,
            85,
            0,
            "trading",
            "accuracy",
            "ipfs://feedback1"
        );

        assertEq(index, 0);
    }

    function testGiveMultipleFeedback() public {
        vm.prank(client1);
        uint64 index1 = registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        uint64 index2 = registry.giveFeedback(AGENT_ID, 85, 0, "trading", "accuracy", "ipfs://f2");
        
        assertEq(index1, 0);
        assertEq(index2, 1);
    }

    function testGiveFeedbackWithDecimals() public {
        vm.prank(client1);
        // 8.5 with 1 decimal = value 85, decimals 1
        uint64 index = registry.giveFeedback(AGENT_ID, 85, 1, "performance", "roi", "ipfs://f1");
        
        AgentReputationRegistry.Feedback memory feedback = registry.getFeedback(AGENT_ID, client1, index);
        assertEq(feedback.value, 85);
        assertEq(feedback.decimals, 1);
    }

    function testGiveNegativeFeedback() public {
        vm.prank(client1);
        // Negative feedback for poor performance
        uint64 index = registry.giveFeedback(AGENT_ID, -50, 0, "trading", "loss", "ipfs://bad");
        
        AgentReputationRegistry.Feedback memory feedback = registry.getFeedback(AGENT_ID, client1, index);
        assertEq(feedback.value, -50);
    }

    function testRevokeFeedback() public {
        vm.prank(client1);
        uint64 index = registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        vm.expectEmit(true, true, true, false);
        emit FeedbackRevoked(AGENT_ID, client1, index);
        
        registry.revokeFeedback(AGENT_ID, index);
        
        AgentReputationRegistry.Feedback memory feedback = registry.getFeedback(AGENT_ID, client1, index);
        assertTrue(feedback.revoked);
    }

    function testRevokeFeedbackFailsIfNotOwner() public {
        vm.prank(client1);
        uint64 index = registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client2); // Different client
        vm.expectRevert("Not feedback owner");
        registry.revokeFeedback(AGENT_ID, index);
    }

    function testRevokeFeedbackFailsIfAlreadyRevoked() public {
        vm.prank(client1);
        uint64 index = registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        registry.revokeFeedback(AGENT_ID, index);
        
        vm.prank(client1);
        vm.expectRevert("Already revoked");
        registry.revokeFeedback(AGENT_ID, index);
    }

    function testGetFeedbackCount() public {
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 85, 0, "trading", "accuracy", "ipfs://f2");
        
        assertEq(registry.getFeedbackCount(AGENT_ID, client1), 2);
        assertEq(registry.getFeedbackCount(AGENT_ID, client2), 0);
    }

    function testGetSummary() public {
        // Client1 gives 2 feedback
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 80, 0, "trading", "accuracy", "ipfs://f2");
        
        // Client2 gives 1 feedback
        vm.prank(client2);
        registry.giveFeedback(AGENT_ID, 85, 0, "trading", "roi", "ipfs://f3");
        
        address[] memory clients = new address[](2);
        clients[0] = client1;
        clients[1] = client2;
        
        (int256 totalValue, uint256 count, int256 averageValue) = registry.getSummary(AGENT_ID, clients);
        
        // Total: 90 + 80 + 85 = 255 (scaled to 18 decimals)
        // Count: 3
        // Average: 255 / 3 = 85
        assertEq(count, 3);
        assertEq(totalValue, 255 * 1e18);
        assertEq(averageValue, 85 * 1e18);
    }

    function testGetSummaryExcludesRevokedFeedback() public {
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        uint64 index = registry.giveFeedback(AGENT_ID, 80, 0, "trading", "accuracy", "ipfs://f2");
        
        // Revoke second feedback
        vm.prank(client1);
        registry.revokeFeedback(AGENT_ID, index);
        
        address[] memory clients = new address[](1);
        clients[0] = client1;
        
        (int256 totalValue, uint256 count, int256 averageValue) = registry.getSummary(AGENT_ID, clients);
        
        // Only first feedback counts
        assertEq(count, 1);
        assertEq(totalValue, 90 * 1e18);
        assertEq(averageValue, 90 * 1e18);
    }

    function testGetSummaryHandlesDecimals() public {
        // 8.5 rating (value 85, decimals 1)
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 85, 1, "trading", "roi", "ipfs://f1");
        
        // 9.2 rating (value 92, decimals 1)
        vm.prank(client2);
        registry.giveFeedback(AGENT_ID, 92, 1, "trading", "roi", "ipfs://f2");
        
        address[] memory clients = new address[](2);
        clients[0] = client1;
        clients[1] = client2;
        
        (int256 totalValue, uint256 count, int256 averageValue) = registry.getSummary(AGENT_ID, clients);
        
        // Total: 8.5 + 9.2 = 17.7 (scaled to 18 decimals)
        // Average: 17.7 / 2 = 8.85
        assertEq(count, 2);
        assertEq(totalValue, 177 * 1e17); // 17.7 * 1e18
        assertEq(averageValue, 885 * 1e16); // 8.85 * 1e18
    }

    function testGetClientFeedback() public {
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 85, 0, "trading", "accuracy", "ipfs://f2");
        
        AgentReputationRegistry.Feedback[] memory feedback = registry.getClientFeedback(AGENT_ID, client1);
        
        assertEq(feedback.length, 2);
        assertEq(feedback[0].value, 90);
        assertEq(feedback[1].value, 85);
    }

    function testGetFeedbackByTag() public {
        vm.prank(client1);
        registry.giveFeedback(AGENT_ID, 90, 0, "trading", "speed", "ipfs://f1");
        
        vm.prank(client2);
        registry.giveFeedback(AGENT_ID, 85, 0, "analysis", "accuracy", "ipfs://f2");
        
        vm.prank(client3);
        registry.giveFeedback(AGENT_ID, 88, 0, "trading", "roi", "ipfs://f3");
        
        address[] memory clients = new address[](3);
        clients[0] = client1;
        clients[1] = client2;
        clients[2] = client3;
        
        AgentReputationRegistry.Feedback[] memory tradingFeedback = registry.getFeedbackByTag(
            AGENT_ID,
            clients,
            "trading"
        );
        
        assertEq(tradingFeedback.length, 2);
        assertEq(tradingFeedback[0].value, 90);
        assertEq(tradingFeedback[1].value, 88);
    }

    function testFeedbackDecimalsRevert() public {
        vm.prank(client1);
        vm.expectRevert("Decimals too high");
        registry.giveFeedback(AGENT_ID, 90, 19, "trading", "speed", "ipfs://f1");
    }
}
