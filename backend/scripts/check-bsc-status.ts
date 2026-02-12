
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const USDC_ADDRESS = process.env.BSC_REWARD_TOKEN_ADDRESS || '0x64544969ed7EBf5f083679233325356EbE738930';
const PRIVATE_KEY = process.env.BSC_TREASURY_PRIVATE_KEY;

const ERC20_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
]);

async function checkStatus() {
    console.log('🔍 Checking BSC Treasury Status...');
    console.log('-----------------------------------');
    console.log(`Network: BSC Testnet`);
    console.log(`RPC: ${RPC_URL}`);
    console.log(`Token: ${USDC_ADDRESS}`);

    if (!PRIVATE_KEY) {
        console.error('❌ BSC_TREASURY_PRIVATE_KEY not set in .env');
        return;
    }

    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    console.log(`Treasury Wallet: ${account.address}`);

    const client = createPublicClient({
        chain: bscTestnet,
        transport: http(RPC_URL),
    });

    try {
        // Check Native BNB Balance
        const bnbBalance = await client.getBalance({ address: account.address });
        console.log(`\n💰 Native Balance: ${formatUnits(bnbBalance, 18)} tBNB`);
        if (bnbBalance === 0n) {
            console.log('⚠️  WARNING: You need tBNB for gas fees!');
        }

        // Check USDC Balance
        const [balance, decimals, symbol] = await Promise.all([
            client.readContract({
                address: USDC_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [account.address],
            }),
            client.readContract({
                address: USDC_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'decimals',
            }),
            client.readContract({
                address: USDC_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'symbol',
            }),
        ]);

        const formattedBalance = formatUnits(balance, decimals);
        console.log(`💰 Token Balance:  ${formattedBalance} ${symbol}`);

        if (Number(formattedBalance) < 200) {
            console.log('\n⚠️  LOW BALANCE: Base epoch allocation is typically 200 USDC.');
            console.log('   You might need to mint more testnet tokens.');
        } else {
            console.log('\n✅  Sufficient balance for rewards!');
        }

    } catch (error) {
        console.error('❌ Error fetching balance:', error);
    }
}

checkStatus();
