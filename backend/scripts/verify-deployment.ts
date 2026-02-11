import { createPublicClient, http } from 'viem';
import { bscTestnet } from 'viem/chains';

const client = createPublicClient({
    chain: bscTestnet,
    transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
});

const address = '0xd52e6738db5952d979738de18b5f09ca55245e7c' as const;

// Check if contract exists
const code = await client.getBytecode({ address });
console.log('Contract deployed:', code ? 'YES ✓' : 'NO');
console.log('Bytecode size:', code ? (code.length / 2) + ' bytes' : '0');
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('        🏆 HACKATHON SUBMISSION PROOF 🏆');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('Contract Address: ', address);
console.log('Network:          BSC Testnet (Chain ID: 97)');
console.log('TX Hash:          0xad0efdc5a8028bc4f6bbe843914df36e5dc940ed98320ab14d91cbbddef1f95f');
console.log('Pattern:          UUPS Upgradeable (OpenZeppelin)');
console.log('');
console.log('Explorer Links:');
console.log('  Contract: https://testnet.bscscan.com/address/' + address);
console.log('  TX:       https://testnet.bscscan.com/tx/0xad0efdc5a8028bc4f6bbe843914df36e5dc940ed98320ab14d91cbbddef1f95f');
console.log('');
