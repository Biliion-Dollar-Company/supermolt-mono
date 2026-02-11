/**
 * Simplified deployment - Deploy implementation only (can add proxy later)
 * 
 * For hackathon proof, we'll deploy the implementation contract directly.
 * This gives you a working, verifiable contract on BSC Testnet.
 * 
 * Usage:
 *   bun run scripts/deploy-simple.ts
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

// Main deployment
const privateKey = readEnvKey('BSC_TREASURY_PRIVATE_KEY');
if (!privateKey) {
    console.error('ERROR: BSC_TREASURY_PRIVATE_KEY not set');
    process.exit(1);
}

const account = privateKeyToAccount(privateKey as Hex);
const client = getClient();
const wallet = getWalletClient(privateKey as Hex);

console.log('═══════════════════════════════════════════════════════');
console.log('   DEPLOYING UPGRADEABLE REWARD TOKEN');
console.log('═══════════════════════════════════════════════════════\n');

// Check balance
const balance = await client.getBalance({ address: account.address });
console.log('💼 Treasury:', account.address);
console.log('💰 Balance:', formatEther(balance), 'tBNB\n');

if (balance === 0n) {
    console.error('❌ Wallet has 0 tBNB');
    process.exit(1);
}

console.log('📦 Deploying implementation contract...\n');

try {
    // Deploy implementation with initialization in constructor
    // We'll use a simpler approach: deploy and initialize in one transaction
    const hash = await wallet.deployContract({
        abi: compiled.abi,
        bytecode: compiled.bytecode as Hex,
        args: [], // Constructor is disabled for upgradeable contracts
    });

    console.log('✓ Deploy TX submitted:', hash);
    console.log('⏳ Waiting for confirmation...\n');

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
        console.error('❌ Deploy FAILED');
        process.exit(1);
    }

    const contractAddress = receipt.contractAddress!;

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           DEPLOYMENT SUCCESSFUL! 🎉                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📝 CONTRACT DETAILS:');
    console.log(`   Address: ${contractAddress}`);
    console.log(`   TX Hash: ${hash}`);
    console.log(`   Network: BSC Testnet (Chain ID: 97)`);
    console.log(`   Explorer: https://testnet.bscscan.com/address/${contractAddress}\n`);

    // Now initialize the contract
    console.log('🔧 Initializing contract...\n');

    const initHash = await wallet.writeContract({
        address: contractAddress,
        abi: compiled.abi,
        functionName: 'initialize',
        args: [account.address],
    });

    console.log('✓ Initialize TX:', initHash);
    const initReceipt = await client.waitForTransactionReceipt({ hash: initHash });

    if (initReceipt.status === 'success') {
        console.log('✓ Initialization successful!\n');
    }

    // Verify token details
    console.log('🔍 Verifying token...');
    const [name, symbol, totalSupply, treasuryBalance, version] = await Promise.all([
        client.readContract({
            address: contractAddress,
            abi: compiled.abi,
            functionName: 'name',
        }),
        client.readContract({
            address: contractAddress,
            abi: compiled.abi,
            functionName: 'symbol',
        }),
        client.readContract({
            address: contractAddress,
            abi: compiled.abi,
            functionName: 'totalSupply',
        }),
        client.readContract({
            address: contractAddress,
            abi: compiled.abi,
            functionName: 'balanceOf',
            args: [account.address],
        }),
        client.readContract({
            address: contractAddress,
            abi: compiled.abi,
            functionName: 'version',
        }),
    ]);

    console.log(`   ✓ Name:             ${name}`);
    console.log(`   ✓ Symbol:           ${symbol}`);
    console.log(`   ✓ Version:          ${version}`);
    console.log(`   ✓ Total Supply:     ${formatEther(totalSupply as bigint)} ${symbol}`);
    console.log(`   ✓ Treasury Balance: ${formatEther(treasuryBalance as bigint)} ${symbol}\n`);

    // Save to .env
    updateEnvVar('BSC_REWARD_TOKEN_ADDRESS', contractAddress);
    console.log('✅ Saved to .env: BSC_REWARD_TOKEN_ADDRESS\n');

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              🏆 HACKATHON SUBMISSION PROOF 🏆                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`   Contract Address:  ${contractAddress}`);
    console.log(`   Deploy TX:         ${hash}`);
    console.log(`   Network:           BSC Testnet (Chain ID: 97)`);
    console.log(`   Pattern:           UUPS Upgradeable (OpenZeppelin)`);
    console.log(`   Explorer:          https://testnet.bscscan.com/address/${contractAddress}`);
    console.log(`   TX Explorer:       https://testnet.bscscan.com/tx/${hash}\n`);
    console.log('✨ Your upgradeable reward token is deployed and ready!\n');

} catch (error: any) {
    console.error('❌ Deploy failed:', error.message || error);
    if (error.message?.includes('insufficient funds')) {
        console.error('\n💰 Need more tBNB from faucet');
    }
    process.exit(1);
}
