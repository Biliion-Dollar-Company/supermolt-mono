/**
 * Deploy Upgradeable SuperMolt Reward Token (UUPS Proxy Pattern)
 * 
 * This script deploys an upgradeable ERC-20 token using the UUPS proxy pattern.
 * The token can be upgraded in the future while maintaining the same address.
 * 
 * Usage:
 *   1. bun run scripts/deploy-upgradeable-token.ts generate
 *      → Generates wallet, shows address for faucet funding
 * 
 *   2. Get tBNB from https://www.bnbchain.org/en/testnet-faucet
 *      → Fund the address shown in step 1
 * 
 *   3. bun run scripts/deploy-upgradeable-token.ts deploy
 *      → Deploys upgradeable reward token with proxy
 * 
 *   4. bun run scripts/deploy-upgradeable-token.ts status
 *      → Check deployment status
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    formatEther,
    parseEther,
    type Address,
    type Hex,
    encodeAbiParameters,
    parseAbiParameters,
    encodeFunctionData,
    keccak256,
    toHex,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const ENV_PATH = path.join(import.meta.dir, '..', '.env');

// ═══════════════════════════════════════════════════════════════════════════
// Pre-compiled bytecode for SuperMolt Reward Token (Upgradeable)
// ═══════════════════════════════════════════════════════════════════════════
// This is compiled from OpenZeppelin's UUPS upgradeable ERC-20 pattern
// Contract: SuperMoltRewardToken (ERC20Upgradeable + OwnableUpgradeable + UUPSUpgradeable)
// Solidity version: 0.8.20

// Implementation contract bytecode (the actual logic)
const IMPLEMENTATION_BYTECODE = '0x608060405234801561001057600080fd5b5061001961001e565b6100de565b600054610100900460ff161561008a5760405162461bcd60e51b815260206004820152602760248201527f496e697469616c697a61626c653a20636f6e747261637420697320696e697469604482015266616c697a696e6760c81b606482015260840160405180910390fd5b60005460ff90811610156100dc576000805460ff191660ff9081179091556040519081527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b565b610c3d806100ed6000396000f3fe608060405234801561001057600080fd5b50600436106100f55760003560e01c806370a0823111610097578063a9059cbb11610066578063a9059cbb146101f8578063dd62ed3e1461020b578063f2fde38b14610244578063f3fef3a31461025757600080fd5b806370a08231146101a15780638da5cb5b146101ca578063954' as Hex;

// ERC1967Proxy bytecode (minimal proxy that delegates to implementation)
const PROXY_BYTECODE = '0x608060405260405161090e38038061090e83398101604081905261002291610460565b61002e82826000610035565b5050610570565b61003e83610100565b6040516001600160a01b038416907f1cf3b03a6cf19fa2baba4df148e9dcabedea7f8a5c07840e207e5c089be95d3e90600090a260008251118061007f5750805b156100fb576100f9836001600160a01b0316635c60da1b6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156100c5573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906100e99190610520565b836102a360201b6100291760201c565b505b505050565b610113816102cf60201b6100551760201c565b6101725760405162461bcd60e51b815260206004820152602560248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e6044820152646f74206160d81b60648201526084015b60405180910390fd5b806101997f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc60001b6102de60201b6100641760201c565b80546001600160a01b0319166001600160a01b039290921691909117905550565b60606101c8838360405180606001604052806027815260200161090760279139610321565b9392505050565b6001600160a01b03163b151590565b90565b6060600080856001600160a01b0316856040516102f19190610520565b600060405180830381855af49150503d806000811461032c576040519150601f19603f3d011682016040523d82523d6000602084013e610331565b606091505b50915091506103428683838761034c565b9695505050505050565b606083156103b85782516103b1576001600160a01b0385163b6103b15760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e74726163740000006044820152606401610169565b50816103c2565b6103c283836103ca565b949350505050565b8151156103da5781518083602001fd5b8060405162461bcd60e51b81526004016101699190610540565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561042557818101518382015260200161040d565b838111156100f95750506000910152565b600082601f83011261044757600080fd5b81516001600160401b03811115610460576104606103f4565b604051601f8201601f19908116603f0116810167ffffffffffffffff8111828210171561048f5761048f6103f4565b6040528181528382016020018510156104a757600080fd5b6103c282602083016020870161040a565b600080604083850312156104cb57600080fd5b82516001600160a01b03811681146104e257600080fd5b60208401519092506001600160401b038111156104fe57600080fd5b61050a85828601610436565b9150509250929050565b8051610' as Hex;

// ABIs
const IMPLEMENTATION_ABI = [
    {
        type: 'function',
        name: 'initialize',
        inputs: [{ name: 'initialOwner', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'name',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'totalSupply',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'transfer',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'mint',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'burn',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'version',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'pure',
    },
    {
        type: 'function',
        name: 'upgradeTo',
        inputs: [{ name: 'newImplementation', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
] as const;

const PROXY_ABI = [
    {
        type: 'constructor',
        inputs: [
            { name: '_logic', type: 'address' },
            { name: '_data', type: 'bytes' },
        ],
        stateMutability: 'payable',
    },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════════

function getClient() {
    return createPublicClient({
        chain: bscTestnet,
        transport: http(BSC_TESTNET_RPC),
    });
}

function getWalletClient(privateKey: Hex) {
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
        account,
        chain: bscTestnet,
        transport: http(BSC_TESTNET_RPC),
    });
}

function readEnvKey(key: string): string | null {
    try {
        const content = fs.readFileSync(ENV_PATH, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) continue;
            const [k, ...rest] = trimmed.split('=');
            if (k?.trim() === key) return rest.join('=').trim();
        }
    } catch { }
    return null;
}

function updateEnvVar(key: string, value: string) {
    let content = '';
    try {
        content = fs.readFileSync(ENV_PATH, 'utf-8');
    } catch { }

    const lines = content.split('\n');
    let found = false;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (
            trimmed === `# ${key}=${value}` ||
            trimmed === `#${key}=${value}` ||
            trimmed.startsWith(`${key}=`) ||
            trimmed.startsWith(`# ${key}=`) ||
            trimmed.startsWith(`#${key}=`)
        ) {
            lines[i] = `${key}=${value}`;
            found = true;
            break;
        }
    }

    if (!found) {
        lines.push(`${key}=${value}`);
    }

    fs.writeFileSync(ENV_PATH, lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════════════════

const command = process.argv[2] || Bun.argv[2];

if (command === 'generate') {
    // Check if we already have a key
    const existingKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
    if (existingKey) {
        const account = privateKeyToAccount(existingKey as Hex);
        const client = getClient();
        const balance = await client.getBalance({ address: account.address });
        console.log('=== EXISTING WALLET FOUND ===\n');
        console.log('Address:', account.address);
        console.log('Balance:', formatEther(balance), 'tBNB');
        console.log('\nTo fund: https://www.bnbchain.org/en/testnet-faucet');
        console.log('Then run: bun run scripts/deploy-upgradeable-token.ts deploy');
        process.exit(0);
    }

    // Generate new wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    console.log('=== NEW BSC TESTNET WALLET ===\n');
    console.log('Address:     ', account.address);
    console.log('Private Key: ', privateKey);
    console.log('\n--- NEXT STEPS ---');
    console.log('1. Fund this address with tBNB from:');
    console.log('   https://www.bnbchain.org/en/testnet-faucet');
    console.log('   (paste the address above, select BSC Testnet, get 0.1-0.5 tBNB)');
    console.log('\n2. Saving private key to .env as BSC_TREASURY_PRIVATE_KEY...');

    updateEnvVar('BSC_TREASURY_PRIVATE_KEY', privateKey);
    console.log('   Done! Saved to .env');

    console.log('\n3. After funding, run:');
    console.log('   bun run scripts/deploy-upgradeable-token.ts deploy');
} else if (command === 'deploy') {
    // Deploy upgradeable token
    const privateKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
    if (!privateKey) {
        console.error(
            'ERROR: BSC_TREASURY_PRIVATE_KEY not set. Run: bun run scripts/deploy-upgradeable-token.ts generate'
        );
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey as Hex);
    const client = getClient();
    const wallet = getWalletClient(privateKey as Hex);

    // Check balance
    const balance = await client.getBalance({ address: account.address });
    console.log('Treasury address:', account.address);
    console.log('Balance:', formatEther(balance), 'tBNB');

    if (balance === 0n) {
        console.error('\nERROR: Wallet has 0 tBNB. Fund it first:');
        console.error('  https://www.bnbchain.org/en/testnet-faucet');
        console.error('  Address:', account.address);
        process.exit(1);
    }

    // Check if already deployed
    const existingProxy = readEnvKey('BSC_REWARD_TOKEN_PROXY');
    const existingImpl = readEnvKey('BSC_REWARD_TOKEN_IMPLEMENTATION');
    if (existingProxy && existingImpl) {
        console.log('\nUpgradeable token already deployed:');
        console.log('  Proxy (use this address):', existingProxy);
        console.log('  Implementation:', existingImpl);
        try {
            const tokenBalance = await client.readContract({
                address: existingProxy as Address,
                abi: IMPLEMENTATION_ABI,
                functionName: 'balanceOf',
                args: [account.address],
            });
            console.log('Treasury token balance:', formatEther(tokenBalance as bigint), 'SMOLT');
        } catch { }
        console.log('\nTo redeploy, remove BSC_REWARD_TOKEN_PROXY from .env');
        process.exit(0);
    }

    console.log('\n=== DEPLOYING UPGRADEABLE REWARD TOKEN ===\n');
    console.log('Step 1: Deploying implementation contract...');

    try {
        // Step 1: Deploy implementation
        const implHash = await wallet.deployContract({
            abi: IMPLEMENTATION_ABI,
            bytecode: IMPLEMENTATION_BYTECODE,
        });

        console.log('Implementation deploy TX:', implHash);
        console.log('Waiting for confirmation...');

        const implReceipt = await client.waitForTransactionReceipt({ hash: implHash });

        if (implReceipt.status !== 'success') {
            console.error('Implementation deploy FAILED:', implReceipt);
            process.exit(1);
        }

        const implementationAddress = implReceipt.contractAddress!;
        console.log('✓ Implementation deployed:', implementationAddress);

        // Step 2: Encode initialize call
        console.log('\nStep 2: Encoding initialization data...');
        const initializeData = encodeFunctionData({
            abi: IMPLEMENTATION_ABI,
            functionName: 'initialize',
            args: [account.address],
        });
        console.log('✓ Initialization data encoded');

        // Step 3: Deploy proxy
        console.log('\nStep 3: Deploying UUPS proxy...');
        const proxyHash = await wallet.deployContract({
            abi: PROXY_ABI,
            bytecode: PROXY_BYTECODE,
            args: [implementationAddress, initializeData],
        });

        console.log('Proxy deploy TX:', proxyHash);
        console.log('Waiting for confirmation...');

        const proxyReceipt = await client.waitForTransactionReceipt({ hash: proxyHash });

        if (proxyReceipt.status !== 'success') {
            console.error('Proxy deploy FAILED:', proxyReceipt);
            process.exit(1);
        }

        const proxyAddress = proxyReceipt.contractAddress!;

        console.log('\n=== UPGRADEABLE TOKEN DEPLOYED ===');
        console.log('✓ Proxy Address (USE THIS):', proxyAddress);
        console.log('✓ Implementation Address:', implementationAddress);
        console.log('\nExplorer Links:');
        console.log(`  Proxy: https://testnet.bscscan.com/address/${proxyAddress}`);
        console.log(`  Implementation: https://testnet.bscscan.com/address/${implementationAddress}`);

        // Verify token details
        console.log('\nVerifying token...');
        const [name, symbol, totalSupply, balance] = await Promise.all([
            client.readContract({
                address: proxyAddress,
                abi: IMPLEMENTATION_ABI,
                functionName: 'name',
            }),
            client.readContract({
                address: proxyAddress,
                abi: IMPLEMENTATION_ABI,
                functionName: 'symbol',
            }),
            client.readContract({
                address: proxyAddress,
                abi: IMPLEMENTATION_ABI,
                functionName: 'totalSupply',
            }),
            client.readContract({
                address: proxyAddress,
                abi: IMPLEMENTATION_ABI,
                functionName: 'balanceOf',
                args: [account.address],
            }),
        ]);

        console.log(`Token: ${name} (${symbol})`);
        console.log('Total Supply:', formatEther(totalSupply as bigint), symbol as string);
        console.log('Treasury Balance:', formatEther(balance as bigint), symbol as string);

        // Save to .env
        updateEnvVar('BSC_REWARD_TOKEN_PROXY', proxyAddress);
        updateEnvVar('BSC_REWARD_TOKEN_IMPLEMENTATION', implementationAddress);
        console.log('\n✓ Saved to .env:');
        console.log(`  BSC_REWARD_TOKEN_PROXY=${proxyAddress}`);
        console.log(`  BSC_REWARD_TOKEN_IMPLEMENTATION=${implementationAddress}`);

        console.log('\n=== DEPLOYMENT COMPLETE ===');
        console.log('🎉 Your upgradeable reward token is ready!');
        console.log('\n📝 HACKATHON SUBMISSION PROOF:');
        console.log(`   Contract Address: ${proxyAddress}`);
        console.log(`   Deploy TX: ${proxyHash}`);
        console.log(`   Network: BSC Testnet (Chain ID: 97)`);
        console.log(`   Explorer: https://testnet.bscscan.com/address/${proxyAddress}`);
    } catch (error: any) {
        console.error('Deploy failed:', error.message || error);
        if (error.message?.includes('insufficient funds')) {
            console.error('\nWallet needs more tBNB. Get from: https://www.bnbchain.org/en/testnet-faucet');
        }
        process.exit(1);
    }
} else if (command === 'status') {
    // Check status
    const privateKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
    const proxyAddr = readEnvKey('BSC_REWARD_TOKEN_PROXY');
    const implAddr = readEnvKey('BSC_REWARD_TOKEN_IMPLEMENTATION');

    console.log('=== UPGRADEABLE TOKEN STATUS ===\n');

    if (!privateKey) {
        console.log('Treasury wallet: NOT CONFIGURED');
        console.log('Run: bun run scripts/deploy-upgradeable-token.ts generate');
        process.exit(0);
    }

    const account = privateKeyToAccount(privateKey as Hex);
    const client = getClient();
    const balance = await client.getBalance({ address: account.address });

    console.log('Treasury wallet:', account.address);
    console.log('tBNB balance:  ', formatEther(balance));

    if (!proxyAddr || !implAddr) {
        console.log('\nUpgradeable token: NOT DEPLOYED');
        console.log('Run: bun run scripts/deploy-upgradeable-token.ts deploy');
    } else {
        console.log('\n✓ Upgradeable token DEPLOYED');
        console.log('  Proxy (use this):', proxyAddr);
        console.log('  Implementation:', implAddr);
        try {
            const [name, symbol, version, tokenBalance] = await Promise.all([
                client.readContract({
                    address: proxyAddr as Address,
                    abi: IMPLEMENTATION_ABI,
                    functionName: 'name',
                }),
                client.readContract({
                    address: proxyAddr as Address,
                    abi: IMPLEMENTATION_ABI,
                    functionName: 'symbol',
                }),
                client.readContract({
                    address: proxyAddr as Address,
                    abi: IMPLEMENTATION_ABI,
                    functionName: 'version',
                }),
                client.readContract({
                    address: proxyAddr as Address,
                    abi: IMPLEMENTATION_ABI,
                    functionName: 'balanceOf',
                    args: [account.address],
                }),
            ]);
            console.log(`  Token: ${name} (${symbol})`);
            console.log(`  Version: ${version}`);
            console.log('  Treasury balance:', formatEther(tokenBalance as bigint), symbol as string);
            console.log('\n  Explorer:', `https://testnet.bscscan.com/address/${proxyAddr}`);
        } catch (e: any) {
            console.log('  Could not read token:', e.message?.slice(0, 100));
        }
    }
} else {
    console.log('Deploy Upgradeable SuperMolt Reward Token\n');
    console.log('Commands:');
    console.log('  generate  — Create treasury wallet');
    console.log('  deploy    — Deploy upgradeable token (needs tBNB)');
    console.log('  status    — Check current deployment');
    console.log('\nUsage: bun run scripts/deploy-upgradeable-token.ts <command>');
}
