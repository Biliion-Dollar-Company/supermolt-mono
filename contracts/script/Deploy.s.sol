// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentIdentityRegistry.sol";
import "../src/AgentReputationRegistry.sol";
import "../src/AgentValidationRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the three registries
        AgentIdentityRegistry identityRegistry = new AgentIdentityRegistry();
        console.log("AgentIdentityRegistry deployed at:", address(identityRegistry));

        AgentReputationRegistry reputationRegistry = new AgentReputationRegistry();
        console.log("AgentReputationRegistry deployed at:", address(reputationRegistry));

        AgentValidationRegistry validationRegistry = new AgentValidationRegistry();
        console.log("AgentValidationRegistry deployed at:", address(validationRegistry));

        vm.stopBroadcast();

        // Output deployment info in JSON format for easy parsing
        console.log("\n=== DEPLOYMENT INFO ===");
        console.log('{"identityRegistry":"', vm.toString(address(identityRegistry)), '",');
        console.log('"reputationRegistry":"', vm.toString(address(reputationRegistry)), '",');
        console.log('"validationRegistry":"', vm.toString(address(validationRegistry)), '"}');
    }
}
