
import { analyzeSuperRouterTrade } from '../src/services/agent-analyzer';
import { llmService } from '../src/services/llm.service';

interface MockTrade {
    signature: string;
    walletAddress: string;
    tokenMint: string;
    tokenSymbol: string;
    action: 'BUY' | 'SELL';
    amount: number;
    timestamp: Date;
}

async function runTest() {
    console.log('🚀 Testing Narrative Intelligence (Local)...');

    // Check if LLM is configured
    console.log('LLM Configured:', llmService.isConfigured);

    // Mock Event: SuperRouter BUYS $TURTLE
    const mockTrade: MockTrade = {
        signature: 'test_sig_' + Date.now(),
        walletAddress: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
        tokenMint: 'TurtleCoinMintAddress123',
        tokenSymbol: 'TURTLE',
        action: 'BUY',
        amount: 5.5,
        timestamp: new Date()
    };

    // Mock Data: High Mindshare + Bezos Tweet Context
    const mockData = {
        holders: 1250,
        liquidity: 85000,
        volume24h: 320000,
        priceChange24h: 45.2,
        marketCap: 450000,
        smartMoneyFlow: 'IN' as const,
        tweetCount: 15, // High velocity
        recentTweets: [
            "Jeff Bezos just posted a picture of a turtle! $TURTLE is the play!",
            "OMG did you see the Amazon turtle tweet? Sending it.",
            "Accumulating $TURTLE before the masses wake up. Narrative is huge.",
            "Turtle power! 🐢🚀 #Solana"
        ]
    };

    console.log('\n--- INPUT DATA ---');
    console.log(`Symbol: $${mockTrade.tokenSymbol}`);
    console.log(`Context: "${mockData.recentTweets[0]}"`);
    console.log('------------------\n');

    try {
        const analysis = await analyzeSuperRouterTrade(mockTrade, mockData);

        console.log('\n--- AGENT OUTPUT ---');
        analysis.forEach(a => {
            console.log(`\n${a.emoji} ${a.agentName} (${a.sentiment}):`);
            console.log(`"${a.message}"`);
            console.log(`[Confidence: ${a.confidence}%]`);
        });
        console.log('\n--------------------');

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

runTest();
