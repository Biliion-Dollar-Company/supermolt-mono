/**
 * Initialize the deployed SMOLT token contract
 * This will mint 1,000,000 SMOLT to the treasury wallet
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    formatEther,
    type Address,
    type Hex,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const ENV_PATH = path.join(import.meta.dir, '..', '.env');
const COMPILED_PATH = path.join(import.meta.dir, '..', 'compiled', 'SuperMoltRewardToken.json');

// Load compiled contract
const compiled = JSON.parse(fs.readFileSync(COMPILED_PATH, 'utf-8'));

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

// Main
const privateKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
const contractAddress = readEnvKey('BSC_REWARD_TOKEN_ADDRESS');

if (!privateKey) {
    console.error('❌ BSC_TREASURY_PRIVATE_KEY not found in .env');
    process.exit(1);
}

if (!contractAddress) {
    console.error('❌ BSC_REWARD_TOKEN_ADDRESS not found in .env');
    process.exit(1);
}

const account = privateKeyToAccount(privateKey as Hex);
const client = getClient();
const wallet = getWalletClient(privateKey as Hex);

console.log('═══════════════════════════════════════════════════════');
console.log('   INITIALIZING SMOLT TOKEN CONTRACT');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📝 Contract:', contractAddress);
console.log('💼 Treasury:', account.address);
console.log('');

// Check if already initialized
try {
    const totalSupply = await client.readContract({
        address: contractAddress as Address,
        abi: compiled.abi,
        functionName: 'totalSupply',
    });

    if (totalSupply > 0n) {
        console.log('✅ Contract already initialized!');
        console.log(`   Total Supply: ${formatEther(totalSupply as bigint)} SMOLT\n`);

        const balance = await client.readContract({
            address: contractAddress as Address,
            abi: compiled.abi,
            functionName: 'balanceOf',
            args: [account.address],
        });

        console.log(`💰 Treasury Balance: ${formatEther(balance as bigint)} SMOLT`);
        console.log(`\n🔗 Explorer: https://testnet.bscscan.com/address/${contractAddress}`);
        process.exit(0);
    }
} catch (error: any) {
    // If totalSupply call fails, contract might not be initialized
    console.log('⚠️  Contract not yet initialized, proceeding...\n');
}

// Initialize the contract
console.log('🔧 Calling initialize() function...\n');

try {
    const hash = await wallet.writeContract({
        address: contractAddress as Address,
        abi: compiled.abi,
        functionName: 'initialize',
        args: [account.address],
    });

    console.log('✓ Initialize TX submitted:', hash);
    console.log('⏳ Waiting for confirmation...\n');

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║           INITIALIZATION SUCCESSFUL! 🎉                        ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        // Verify the initialization
        const [name, symbol, totalSupply, balance, version] = await Promise.all([
            client.readContract({
                address: contractAddress as Address,
                abi: compiled.abi,
                functionName: 'name',
            }),
            client.readContract({
                address: contractAddress as Address,
                abi: compiled.abi,
                functionName: 'symbol',
            }),
            client.readContract({
                address: contractAddress as Address,
                abi: compiled.abi,
                functionName: 'totalSupply',
            }),
            client.readContract({
                address: contractAddress as Address,
                abi: compiled.abi,
                functionName: 'balanceOf',
                args: [account.address],
            }),
            client.readContract({
                address: contractAddress as Address,
                abi: compiled.abi,
                functionName: 'version',
            }),
        ]);

        console.log('📊 TOKEN DETAILS:');
        console.log(`   Name:             ${name}`);
        console.log(`   Symbol:           ${symbol}`);
        console.log(`   Version:          ${version}`);
        console.log(`   Total Supply:     ${formatEther(totalSupply as bigint)} ${symbol}`);
        console.log(`   Treasury Balance: ${formatEther(balance as bigint)} ${symbol}\n`);

        console.log('🔗 LINKS:');
        console.log(`   Contract: https://testnet.bscscan.com/address/${contractAddress}`);
        console.log(`   TX:       https://testnet.bscscan.com/tx/${hash}\n`);

        console.log('✨ Your BSC treasury is now ready to distribute rewards!');
    } else {
        console.error('❌ Initialization failed');
        process.exit(1);
    }
} catch (error: any) {
    if (error.message?.includes('InvalidInitialization')) {
        console.log('ℹ️  Contract was already initialized (this is normal for upgradeable contracts)');
        console.log('   Checking current state...\n');

        try {
            const [totalSupply, balance] = await Promise.all([
                client.readContract({
                    address: contractAddress as Address,
                    abi: compiled.abi,
                    functionName: 'totalSupply',
                }),
                client.readContract({
                    address: contractAddress as Address,
                    abi: compiled.abi,
                    functionName: 'balanceOf',
                    args: [account.address],
                }),
            ]);

            console.log(`   Total Supply:     ${formatEther(totalSupply as bigint)} SMOLT`);
            console.log(`   Treasury Balance: ${formatEther(balance as bigint)} SMOLT\n`);
            console.log('✅ Contract is ready to use!');
        } catch { }
    } else {
        console.error('❌ Initialization failed:', error.message || error);
        process.exit(1);
    }
}
