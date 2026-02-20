// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title AgentIdentityRegistry
 * @dev ERC-8004 compliant Agent Identity Registry
 * Extends ERC-721 with URIStorage for agent identity management
 */
contract AgentIdentityRegistry is ERC721URIStorage, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // EIP-712 Domain Separator
    bytes32 private constant DOMAIN_TYPEHASH = 
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    
    bytes32 private constant WALLET_CHANGE_TYPEHASH = 
        keccak256("WalletChange(uint256 agentId,address newWallet,uint256 nonce)");

    bytes32 private immutable DOMAIN_SEPARATOR;

    // Counter for agent IDs
    uint256 private _nextAgentId;

    // Mapping from agentId to agent wallet address
    mapping(uint256 => address) private _agentWallets;

    // Mapping from agentId to metadata key-value pairs
    mapping(uint256 => mapping(string => string)) private _agentMetadata;

    // Nonce for EIP-712 signature replay protection
    mapping(uint256 => uint256) private _nonces;

    // Events
    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentWalletChanged(uint256 indexed agentId, address indexed oldWallet, address indexed newWallet);
    event AgentMetadataUpdated(uint256 indexed agentId, string key, string value);

    constructor() ERC721("AgentIdentity", "AGNT") Ownable(msg.sender) {
        _nextAgentId = 1;
        
        // Initialize EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("AgentIdentityRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Register a new agent and mint an NFT
     * @param agentURI The metadata URI for the agent
     * @return agentId The ID of the newly registered agent
     */
    function register(string memory agentURI) external returns (uint256) {
        uint256 agentId = _nextAgentId++;
        
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        
        emit AgentRegistered(agentId, msg.sender, agentURI);
        
        return agentId;
    }

    /**
     * @dev Set the agent wallet address with EIP-712 signature verification
     * @param agentId The ID of the agent
     * @param newWallet The new wallet address
     * @param signature The EIP-712 signature from the new wallet
     */
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        bytes memory signature
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        require(newWallet != address(0), "Invalid wallet address");

        // Verify EIP-712 signature
        uint256 nonce = _nonces[agentId]++;
        bytes32 structHash = keccak256(
            abi.encode(
                WALLET_CHANGE_TYPEHASH,
                agentId,
                newWallet,
                nonce
            )
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address signer = ECDSA.recover(digest, signature);
        require(signer == newWallet, "Invalid signature");

        address oldWallet = _agentWallets[agentId];
        _agentWallets[agentId] = newWallet;

        // Store as metadata
        _agentMetadata[agentId]["agentWallet"] = addressToString(newWallet);

        emit AgentWalletChanged(agentId, oldWallet, newWallet);
    }

    /**
     * @dev Get the agent wallet address
     * @param agentId The ID of the agent
     * @return The wallet address
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    /**
     * @dev Set metadata for an agent
     * @param agentId The ID of the agent
     * @param key The metadata key
     * @param value The metadata value
     */
    function setMetadata(uint256 agentId, string memory key, string memory value) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        require(keccak256(bytes(key)) != keccak256(bytes("agentWallet")), "Use setAgentWallet for agentWallet");

        _agentMetadata[agentId][key] = value;
        emit AgentMetadataUpdated(agentId, key, value);
    }

    /**
     * @dev Get metadata for an agent
     * @param agentId The ID of the agent
     * @param key The metadata key
     * @return The metadata value
     */
    function getMetadata(uint256 agentId, string memory key) external view returns (string memory) {
        return _agentMetadata[agentId][key];
    }

    /**
     * @dev Get the current nonce for an agent (for EIP-712 signing)
     * @param agentId The ID of the agent
     * @return The current nonce
     */
    function getNonce(uint256 agentId) external view returns (uint256) {
        return _nonces[agentId];
    }

    /**
     * @dev Get the domain separator for EIP-712
     * @return The domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }

    /**
     * @dev Helper function to convert address to string
     */
    function addressToString(address addr) private pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);
        bytes memory alphabet = "0123456789abcdef";
        
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        
        return string(str);
    }
}
