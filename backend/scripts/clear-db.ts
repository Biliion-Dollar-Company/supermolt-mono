import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Clearing database...\n');

  try {
    // Delete in order to avoid foreign key constraints
    console.log('Deleting votes...');
    const votes = await prisma.vote.deleteMany();
    console.log(`✅ Deleted ${votes.count} votes`);

    console.log('Deleting vote proposals...');
    const voteProposals = await prisma.voteProposal.deleteMany();
    console.log(`✅ Deleted ${voteProposals.count} vote proposals`);

    console.log('Deleting agent messages...');
    const messages = await prisma.agentMessage.deleteMany();
    console.log(`✅ Deleted ${messages.count} messages`);

    console.log('Deleting conversations...');
    const conversations = await prisma.agentConversation.deleteMany();
    console.log(`✅ Deleted ${conversations.count} conversations`);

    console.log('Deleting positions...');
    const positions = await prisma.agentPosition.deleteMany();
    console.log(`✅ Deleted ${positions.count} positions`);

    console.log('Deleting webhook events...');
    const webhooks = await prisma.webhookEvent.deleteMany();
    console.log(`✅ Deleted ${webhooks.count} webhook events`);

    console.log('Deleting agent stats...');
    const stats = await prisma.agentStats.deleteMany();
    console.log(`✅ Deleted ${stats.count} agent stats`);

    console.log('Deleting copy trades...');
    const copyTrades = await prisma.copyTrade.deleteMany();
    console.log(`✅ Deleted ${copyTrades.count} copy trades`);

    console.log('Deleting feed activity...');
    const feedActivity = await prisma.feedActivity.deleteMany();
    console.log(`✅ Deleted ${feedActivity.count} feed activities`);

    console.log('Deleting trade feedback...');
    const feedback = await prisma.tradeFeedback.deleteMany();
    console.log(`✅ Deleted ${feedback.count} trade feedbacks`);

    console.log('Deleting paper trades...');
    const paperTrades = await prisma.paperTrade.deleteMany();
    console.log(`✅ Deleted ${paperTrades.count} paper trades`);

    console.log('Deleting agents...');
    const agents = await prisma.tradingAgent.deleteMany();
    console.log(`✅ Deleted ${agents.count} agents`);

    console.log('\n✨ Database cleared successfully!\n');
    console.log('Ready for fresh end-to-end test.');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
