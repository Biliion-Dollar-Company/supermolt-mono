
import { db } from '../src/lib/db';
import { generateUniqueName } from '../src/lib/name-generator';

async function migrateNames() {
    console.log('🚀 Starting name migration for boring agents...');

    // Find all agents with default names (starting with "Agent-")
    const boringAgents = await db.tradingAgent.findMany({
        where: {
            name: {
                startsWith: 'Agent-',
            },
        },
    });

    console.log(`Found ${boringAgents.length} agents with boring names.`);

    let updatedCount = 0;

    for (const agent of boringAgents) {
        // Generate a new funny unique name
        const newName = await generateUniqueName(async (n) => {
            const exists = await db.tradingAgent.findFirst({ where: { name: n } });
            return !!exists;
        });

        // Update the agent
        await db.tradingAgent.update({
            where: { id: agent.id },
            data: { name: newName },
        });

        // Also update the Scanner record if it has the old name
        await db.scanner.updateMany({
            where: { agentId: agent.id, name: agent.name },
            data: { name: newName },
        });

        console.log(`✅ Renamed "${agent.name}" -> "${newName}"`);
        updatedCount++;
    }

    console.log(`\n🎉 Migration complete! Updated ${updatedCount} agents.`);
    process.exit(0);
}

migrateNames().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
