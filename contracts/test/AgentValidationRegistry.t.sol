// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentValidationRegistry.sol";

contract AgentValidationRegistryTest is Test {
    AgentValidationRegistry public registry;
    
    address public requester = address(1);
    address public validator1 = address(2);
    address public validator2 = address(3);

    uint256 constant AGENT_ID = 1;

    event ValidationRequested(
        bytes32 indexed requestHash,
        address indexed validator,
        uint256 indexed agentId,
        address requester,
        string requestURI
    );

    event ValidationResponded(
        bytes32 indexed requestHash,
        address indexed validator,
        uint256 indexed agentId,
        uint8 response,
        string responseURI
    );

    function setUp() public {
        registry = new AgentValidationRegistry();
    }

    function testValidationRequest() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        
        vm.expectEmit(true, true, true, true);
        emit ValidationRequested(requestHash, validator1, AGENT_ID, requester, "ipfs://request1");
        
        bytes32 returnedHash = registry.validationRequest(
            validator1,
            AGENT_ID,
            "ipfs://request1",
            requestHash
        );

        assertEq(returnedHash, requestHash);
        assertTrue(registry.validationExists(requestHash));
    }

    function testValidationRequestDetails() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        AgentValidationRegistry.ValidationRequest memory req = registry.getValidation(requestHash);
        
        assertEq(req.requester, requester);
        assertEq(req.validator, validator1);
        assertEq(req.agentId, AGENT_ID);
        assertEq(req.requestURI, "ipfs://request1");
        assertEq(req.requestHash, requestHash);
        assertEq(uint8(req.response), uint8(AgentValidationRegistry.ValidationResponse.Pending));
    }

    function testValidationRequestFailsForDuplicate() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        vm.prank(requester);
        vm.expectRevert("Request already exists");
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
    }

    function testValidationRequestFailsForZeroAddress() public {
        bytes32 requestHash = keccak256(abi.encodePacked(address(0), AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        vm.expectRevert("Invalid validator address");
        registry.validationRequest(address(0), AGENT_ID, "ipfs://request1", requestHash);
    }

    function testValidationResponseApproved() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        vm.prank(validator1);
        
        vm.expectEmit(true, true, true, true);
        emit ValidationResponded(
            requestHash,
            validator1,
            AGENT_ID,
            uint8(AgentValidationRegistry.ValidationResponse.Approved),
            "ipfs://response1"
        );
        
        registry.validationResponse(
            requestHash,
            uint8(AgentValidationRegistry.ValidationResponse.Approved),
            "ipfs://response1"
        );
        
        AgentValidationRegistry.ValidationRequest memory req = registry.getValidation(requestHash);
        assertEq(uint8(req.response), uint8(AgentValidationRegistry.ValidationResponse.Approved));
        assertEq(req.responseURI, "ipfs://response1");
    }

    function testValidationResponseRejected() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        vm.prank(validator1);
        registry.validationResponse(
            requestHash,
            uint8(AgentValidationRegistry.ValidationResponse.Rejected),
            "ipfs://rejected"
        );
        
        AgentValidationRegistry.ValidationResponse status = registry.getValidationStatus(requestHash);
        assertEq(uint8(status), uint8(AgentValidationRegistry.ValidationResponse.Rejected));
    }

    function testValidationResponseFailsIfNotValidator() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        vm.prank(validator2); // Different validator
        vm.expectRevert("Not the validator");
        registry.validationResponse(
            requestHash,
            uint8(AgentValidationRegistry.ValidationResponse.Approved),
            "ipfs://response1"
        );
    }

    function testValidationResponseFailsIfAlreadyResponded() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        vm.prank(validator1);
        registry.validationResponse(
            requestHash,
            uint8(AgentValidationRegistry.ValidationResponse.Approved),
            "ipfs://response1"
        );
        
        vm.prank(validator1);
        vm.expectRevert("Already responded");
        registry.validationResponse(
            requestHash,
            uint8(AgentValidationRegistry.ValidationResponse.Rejected),
            "ipfs://changed"
        );
    }

    function testValidationResponseFailsForInvalidResponse() public {
        bytes32 requestHash = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", requestHash);
        
        vm.prank(validator1);
        vm.expectRevert("Invalid response");
        registry.validationResponse(requestHash, 4, "ipfs://invalid"); // 4 is out of range
    }

    function testGetAgentValidations() public {
        bytes32 hash1 = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(1)));
        bytes32 hash2 = keccak256(abi.encodePacked(validator1, AGENT_ID, "ipfs://request2", uint256(2)));
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request1", hash1);
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://request2", hash2);
        
        bytes32[] memory hashes = registry.getAgentValidations(AGENT_ID, validator1);
        
        assertEq(hashes.length, 2);
        assertEq(hashes[0], hash1);
        assertEq(hashes[1], hash2);
    }

    function testGenerateRequestHash() public view {
        bytes32 hash = registry.generateRequestHash(
            validator1,
            AGENT_ID,
            "ipfs://request1",
            12345
        );
        
        bytes32 expected = keccak256(
            abi.encodePacked(validator1, AGENT_ID, "ipfs://request1", uint256(12345))
        );
        
        assertEq(hash, expected);
    }

    function testGetValidationStats() public {
        // Create multiple validation requests
        bytes32 hash1 = registry.generateRequestHash(validator1, AGENT_ID, "ipfs://r1", 1);
        bytes32 hash2 = registry.generateRequestHash(validator1, AGENT_ID, "ipfs://r2", 2);
        bytes32 hash3 = registry.generateRequestHash(validator2, AGENT_ID, "ipfs://r3", 3);
        bytes32 hash4 = registry.generateRequestHash(validator2, AGENT_ID, "ipfs://r4", 4);
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://r1", hash1);
        
        vm.prank(requester);
        registry.validationRequest(validator1, AGENT_ID, "ipfs://r2", hash2);
        
        vm.prank(requester);
        registry.validationRequest(validator2, AGENT_ID, "ipfs://r3", hash3);
        
        vm.prank(requester);
        registry.validationRequest(validator2, AGENT_ID, "ipfs://r4", hash4);
        
        // Respond to some
        vm.prank(validator1);
        registry.validationResponse(hash1, uint8(AgentValidationRegistry.ValidationResponse.Approved), "ipfs://approved");
        
        vm.prank(validator1);
        registry.validationResponse(hash2, uint8(AgentValidationRegistry.ValidationResponse.Rejected), "ipfs://rejected");
        
        vm.prank(validator2);
        registry.validationResponse(hash3, uint8(AgentValidationRegistry.ValidationResponse.NeedsInfo), "ipfs://needsinfo");
        
        // Leave hash4 pending
        
        address[] memory validators = new address[](2);
        validators[0] = validator1;
        validators[1] = validator2;
        
        (
            uint256 approvedCount,
            uint256 rejectedCount,
            uint256 pendingCount,
            uint256 needsInfoCount
        ) = registry.getValidationStats(AGENT_ID, validators);
        
        assertEq(approvedCount, 1);
        assertEq(rejectedCount, 1);
        assertEq(pendingCount, 1);
        assertEq(needsInfoCount, 1);
    }

    function testValidationRequestDoesNotExist() public view {
        bytes32 fakeHash = keccak256("fake");
        assertFalse(registry.validationExists(fakeHash));
    }
}
