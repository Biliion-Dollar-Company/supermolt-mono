
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, formatUnits } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const USDC_ADDRESS = process.env.BSC_REWARD_TOKEN_ADDRESS || '0x64544969ed7EBf5f083679233325356EbE738930';
const PRIVATE_KEY = process.env.BSC_TREASURY_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error('❌ BSC_TREASURY_PRIVATE_KEY not set');
    process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const client = createPublicClient({ chain: bscTestnet, transport: http(RPC_URL) });
const wallet = createWalletClient({ account, chain: bscTestnet, transport: http(RPC_URL) });

const MINT_ABI = parseAbi([
    'function mint(uint256 amount) public',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
]);

async function mintTokens() {
    console.log('🔄 Attempting to mint 100,000 USDC on BSC Testnet...');
    console.log(`Wallet: ${account.address}`);

    try {
        const decimals = await client.readContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: MINT_ABI,
            functionName: 'decimals',
        });

        const amountToMint = parseUnits('100000', decimals);

        const hash = await wallet.writeContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: MINT_ABI,
            functionName: 'mint',
            args: [amountToMint],
        });

        console.log(`✅ Mint transaction sent: https://testnet.bscscan.com/tx/${hash}`);
        console.log('⏳ Waiting for confirmation...');

        await client.waitForTransactionReceipt({ hash });

        const newBalance = await client.readContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: MINT_ABI,
            functionName: 'balanceOf',
            args: [account.address],
        });

        console.log(`🎉 Success! New Balance: ${formatUnits(newBalance, decimals)} USDC`);

    } catch (error) {
        console.error('❌ Minting failed:', error);
        console.log('Note: Some testnet tokens require a specific mint function signature or are protected.');
    }
}

mintTokens();
