#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Creating 5 Observer Agents...\n');

    const sqlFile = path.join(__dirname, 'observer-agents-create.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    try {
        // Execute the SQL
        await prisma.$executeRawUnsafe(sql);

        console.log('✅ SQL executed successfully!\n');

        // Verify the agents were created
        const agents = await prisma.tradingAgent.findMany({
            where: {
                archetypeId: 'observer'
            },
            select: {
                id: true,
                name: true,
                status: true,
                config: true
            }
        });

        console.log(`✅ Found ${agents.length} observer agents:\n`);

        agents.forEach((agent: any) => {
            const config = agent.config as any;
            console.log(`${config.emoji} ${agent.name} - ${config.persona}`);
            console.log(`   Status: ${agent.status}`);
            console.log(`   ID: ${agent.id}\n`);
        });

        console.log('🎉 Observer agents created successfully!');

    } catch (error) {
        console.error('❌ Error executing SQL:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
