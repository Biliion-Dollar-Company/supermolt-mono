// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentValidationRegistry
 * @dev ERC-8004 compliant Agent Validation Registry
 * Manages validation requests and responses for AI agents
 */
contract AgentValidationRegistry {
    
    enum ValidationResponse {
        Pending,      // 0: Validation not yet provided
        Approved,     // 1: Validation approved
        Rejected,     // 2: Validation rejected
        NeedsInfo     // 3: More information needed
    }

    struct ValidationRequest {
        address requester;           // Who requested the validation
        address validator;           // Who should validate
        uint256 agentId;            // Agent being validated
        string requestURI;          // URI to validation request details
        bytes32 requestHash;        // Hash of the request for verification
        uint64 timestamp;           // When request was made
        ValidationResponse response; // Validator's response
        string responseURI;         // URI to validation response details
        uint64 responseTimestamp;   // When response was provided
    }

    // requestHash => ValidationRequest
    mapping(bytes32 => ValidationRequest) private _validations;

    // agentId => validator => array of request hashes
    mapping(uint256 => mapping(address => bytes32[])) private _agentValidations;

    // Events
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

    /**
     * @dev Create a validation request
     * @param validator The address of the validator
     * @param agentId The ID of the agent to validate
     * @param requestURI URI containing validation request details
     * @param requestHash Hash of the request (for verification and uniqueness)
     * @return The request hash
     */
    function validationRequest(
        address validator,
        uint256 agentId,
        string memory requestURI,
        bytes32 requestHash
    ) external returns (bytes32) {
        require(validator != address(0), "Invalid validator address");
        require(_validations[requestHash].timestamp == 0, "Request already exists");
        
        _validations[requestHash] = ValidationRequest({
            requester: msg.sender,
            validator: validator,
            agentId: agentId,
            requestURI: requestURI,
            requestHash: requestHash,
            timestamp: uint64(block.timestamp),
            response: ValidationResponse.Pending,
            responseURI: "",
            responseTimestamp: 0
        });

        _agentValidations[agentId][validator].push(requestHash);

        emit ValidationRequested(
            requestHash,
            validator,
            agentId,
            msg.sender,
            requestURI
        );

        return requestHash;
    }

    /**
     * @dev Provide a validation response
     * @param requestHash Hash of the validation request
     * @param response The validation response (0=Pending, 1=Approved, 2=Rejected, 3=NeedsInfo)
     * @param responseURI URI containing validation response details
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string memory responseURI
    ) external {
        ValidationRequest storage validation = _validations[requestHash];
        
        require(validation.timestamp != 0, "Request does not exist");
        require(validation.validator == msg.sender, "Not the validator");
        require(validation.response == ValidationResponse.Pending, "Already responded");
        require(response <= uint8(ValidationResponse.NeedsInfo), "Invalid response");

        validation.response = ValidationResponse(response);
        validation.responseURI = responseURI;
        validation.responseTimestamp = uint64(block.timestamp);

        emit ValidationResponded(
            requestHash,
            msg.sender,
            validation.agentId,
            response,
            responseURI
        );
    }

    /**
     * @dev Get validation request details
     * @param requestHash The hash of the validation request
     * @return The validation request struct
     */
    function getValidation(bytes32 requestHash) 
        external 
        view 
        returns (ValidationRequest memory) 
    {
        return _validations[requestHash];
    }

    /**
     * @dev Get all validation requests for an agent from a specific validator
     * @param agentId The ID of the agent
     * @param validator The address of the validator
     * @return Array of request hashes
     */
    function getAgentValidations(uint256 agentId, address validator) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return _agentValidations[agentId][validator];
    }

    /**
     * @dev Get the status of a validation
     * @param requestHash The hash of the validation request
     * @return response The validation response enum value
     */
    function getValidationStatus(bytes32 requestHash) 
        external 
        view 
        returns (ValidationResponse) 
    {
        return _validations[requestHash].response;
    }

    /**
     * @dev Check if a validation request exists
     * @param requestHash The hash of the validation request
     * @return True if the request exists
     */
    function validationExists(bytes32 requestHash) external view returns (bool) {
        return _validations[requestHash].timestamp != 0;
    }

    /**
     * @dev Generate a validation request hash
     * @param validator The validator address
     * @param agentId The agent ID
     * @param requestURI The request URI
     * @param nonce A unique nonce to prevent collisions
     * @return The generated hash
     */
    function generateRequestHash(
        address validator,
        uint256 agentId,
        string memory requestURI,
        uint256 nonce
    ) external pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                validator,
                agentId,
                requestURI,
                nonce
            )
        );
    }

    /**
     * @dev Get validation statistics for an agent
     * @param agentId The agent ID
     * @param validators Array of validator addresses to check
     * @return approvedCount Number of approved validations
     * @return rejectedCount Number of rejected validations
     * @return pendingCount Number of pending validations
     * @return needsInfoCount Number of validations needing more info
     */
    function getValidationStats(
        uint256 agentId,
        address[] memory validators
    ) external view returns (
        uint256 approvedCount,
        uint256 rejectedCount,
        uint256 pendingCount,
        uint256 needsInfoCount
    ) {
        for (uint256 i = 0; i < validators.length; i++) {
            bytes32[] storage hashes = _agentValidations[agentId][validators[i]];
            
            for (uint256 j = 0; j < hashes.length; j++) {
                ValidationResponse response = _validations[hashes[j]].response;
                
                if (response == ValidationResponse.Approved) {
                    approvedCount++;
                } else if (response == ValidationResponse.Rejected) {
                    rejectedCount++;
                } else if (response == ValidationResponse.Pending) {
                    pendingCount++;
                } else if (response == ValidationResponse.NeedsInfo) {
                    needsInfoCount++;
                }
            }
        }

        return (approvedCount, rejectedCount, pendingCount, needsInfoCount);
    }
}
