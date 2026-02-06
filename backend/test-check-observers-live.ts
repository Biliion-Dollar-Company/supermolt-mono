#!/usr/bin/env bun
/**
 * Check Observer System Live Status
 * - Query database for observer agents
 * - Check for any conversations created by observers
 * - Check for SuperRouter trades detected
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function checkObserversLive() {
  console.log('🔍 Checking Observer System Status (Railway Production)\n');

  try {
    // 1. Check observer agents
    console.log('1️⃣ Observer Agents in Database:');
    const observers = await db.tradingAgent.findMany({
      where: {
        config: {
          path: ['role'],
          equals: 'observer'
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        config: true
      }
    });

    if (observers.length === 0) {
      console.log('   ❌ No observer agents found!');
    } else {
      console.log(`   ✅ Found ${observers.length} observer agents:`);
      observers.forEach(obs => {
        const config = obs.config as any;
        console.log(`      - ${config.emoji} ${obs.name} (${obs.status})`);
        console.log(`        ID: ${obs.id}`);
        console.log(`        Persona: ${config.persona}`);
        console.log(`        Observing: ${config.observing}`);
      });
    }

    // 2. Check for conversations
    console.log('\n2️⃣ Conversations Created:');
    const conversations = await db.agentConversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 5
        }
      }
    });

    if (conversations.length === 0) {
      console.log('   ❌ No conversations found yet');
      console.log('   💡 This means observer analysis has not been triggered');
    } else {
      console.log(`   ✅ Found ${conversations.length} conversations:`);
      conversations.forEach(conv => {
        console.log(`\n   📝 Conversation ${conv.id.slice(0, 8)}...`);
        console.log(`      Topic: ${conv.topic}`);
        console.log(`      Token: ${conv.tokenMint || 'N/A'}`);
        console.log(`      Created: ${conv.createdAt.toISOString()}`);
        console.log(`      Messages: ${conv.messages.length}`);
        
        if (conv.messages.length > 0) {
          conv.messages.forEach((msg, idx) => {
            const content = msg.content.slice(0, 100);
            console.log(`         ${idx + 1}. ${msg.agentId.slice(0, 12)}...: ${content}...`);
          });
        }
      });
    }

    // 3. Check for trades from SuperRouter wallet
    console.log('\n3️⃣ SuperRouter Trades Detected:');
    const superRouterWallet = '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn';
    const srTrades = await db.trade.findMany({
      where: {
        walletAddress: superRouterWallet
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        tokenMint: true,
        timestamp: true,
        txSignature: true
      }
    });

    if (srTrades.length === 0) {
      console.log(`   ❌ No trades from SuperRouter wallet yet`);
      console.log(`   💡 Observer analysis triggers on first SR trade detected`);
    } else {
      console.log(`   ✅ Found ${srTrades.length} SuperRouter trades:`);
      srTrades.forEach(trade => {
        console.log(`      - ${trade.type} @ ${trade.timestamp.toISOString()}`);
        console.log(`        Token: ${trade.tokenMint.slice(0, 12)}...`);
        console.log(`        TX: ${trade.txSignature.slice(0, 12)}...`);
      });
    }

    // 4. Summary
    console.log('\n📊 Summary:');
    console.log(`   Observers: ${observers.length} active`);
    console.log(`   Conversations: ${conversations.length} created`);
    console.log(`   SR Trades: ${srTrades.length} detected`);

    if (observers.length === 5 && conversations.length === 0 && srTrades.length === 0) {
      console.log('\n✅ System Ready: Observers configured, waiting for first SuperRouter trade');
    } else if (observers.length === 5 && srTrades.length > 0 && conversations.length === 0) {
      console.log('\n⚠️  Issue: Observers exist, trades detected, but no conversations created');
      console.log('    💡 Check webhook handler logs for observer trigger');
    } else if (conversations.length > 0) {
      console.log('\n🎉 System Active: Observer analysis successfully triggered!');
    }

  } catch (error) {
    console.error('❌ Error checking observer system:', error);
  } finally {
    await db.$disconnect();
  }
}

checkObserversLive();
