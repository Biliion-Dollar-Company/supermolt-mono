/**
 * Get wallet address from agent's secretKey
 */
import { Keypair } from '@solana/web3.js';
import { db as prisma } from '../src/lib/db';
import bs58 from 'bs58';

async function main() {
  const agentId = process.argv[2] || 'obs_2d699d1509105cd0'; // Alpha by default
  
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, config: true }
  });

  if (!agent) {
    console.error('❌ Agent not found:', agentId);
    process.exit(1);
  }

  const config = agent.config as any;
  const secretKey = config.secretKey;

  if (!secretKey) {
    console.error('❌ Agent has no secretKey in config');
    process.exit(1);
  }

  // Decode base58 secret key
  const keypair = Keypair.fromSecretKey(
    bs58.decode(secretKey)
  );

  console.log('\n🔑 Agent Wallet Info:');
  console.log('  Agent:', agent.name);
  console.log('  ID:', agent.id);
  console.log('  Wallet:', keypair.publicKey.toBase58());
  console.log('\n💰 Fund this wallet to make this agent the active trader!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
