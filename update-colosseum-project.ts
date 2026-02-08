#!/usr/bin/env bun
/**
 * Update Colosseum Agent Hackathon Project
 */

import { readFileSync } from 'fs';

// Load credentials from .env.colosseum
const envFile = readFileSync('.env.colosseum', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  if (line.startsWith('#') || !line.includes('=')) return;
  const [key, ...valueParts] = line.split('=');
  env[key.trim()] = valueParts.join('=').trim();
});

const AGENT_ID = env.COLOSSEUM_AGENT_ID;
const API_KEY = env.COLOSSEUM_API_KEY;

// Project details
const PROJECT = {
  name: 'SuperRouter / SuperMolt',
  description: `Super Router is a Solana-native multi-agent trading infrastructure where autonomous AI agents trade SOL/USDC using real-time market intelligence and earn on-chain rewards based on provable performance.

Super Molt (Moltbook for AI trading bots) extends Super Router (our advanced trading bot) into an open agent network where users register agents via wallet sign-in, deploy Skill.md-compatible strategies, and compete in shared USDC reward epochs governed by Solana smart contracts.

Agents execute trades through Jupiter while consuming live websocket data across liquidity, OHLC, wallet clustering, and attention signals. Performance is tracked on an on-chain leaderboard, where profit, win-rate, and consistency determine epoch reward distribution.

Core Features Demonstrated:
• Agent registration + Solana wallet abstraction
• Autonomous SOL/USDC trading agents
• skill.md-compatible agent skills
• Multi-agent execution + coordination
• On-chain leaderboard + reputation tracking
• Epoch-based USDC reward pool smart contract
• On-chain proof of performance + reward distribution

All agents initially start with the backend skill.md infrastructure of Super Router but can also be configured with their own trading/reasoning strategies.`,
  github: 'https://github.com/Biliion-Dollar-Company/supermolt-mono',
  website: 'https://www.supermolt.xyz/',
  demo_video: '', // Optional
  tags: ['trading', 'ai-agents', 'defi', 'jupiter', 'usdc', 'solana'],
};

console.log('🏛️  Colosseum Agent Hackathon - Project Update');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`Agent: ${env.COLOSSEUM_AGENT_NAME}`);
console.log(`Agent ID: ${AGENT_ID}`);
console.log(`API Key: ${API_KEY.slice(0, 20)}...\n`);

// Try different API endpoints
const POSSIBLE_ENDPOINTS = [
  'https://api.colosseum.com',
  'https://colosseum.com/api',
  'https://arena.colosseum.org/api',
  'https://api.arena.colosseum.org',
];

async function tryUpdateProject(baseUrl: string) {
  const endpoints = [
    `${baseUrl}/agents/${AGENT_ID}`,
    `${baseUrl}/v1/agents/${AGENT_ID}`,
    `${baseUrl}/hackathon/agents/${AGENT_ID}`,
    `${baseUrl}/agent-hackathon/agents/${AGENT_ID}`,
  ];

  for (const url of endpoints) {
    try {
      console.log(`\n🔍 Trying: ${url}`);
      
      // Try GET first to see if endpoint exists
      const getRes = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json',
        },
      });

      console.log(`   GET ${getRes.status} ${getRes.statusText}`);

      if (getRes.status === 200) {
        console.log(`   ✅ Endpoint found!`);
        const data = await getRes.json();
        console.log(`   Current data:`, JSON.stringify(data, null, 2).slice(0, 200));
      }

      if (getRes.status === 200 || getRes.status === 404) {
        // Try PATCH to update
        console.log(`   Attempting PATCH...`);
        const patchRes = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(PROJECT),
        });

        console.log(`   PATCH ${patchRes.status} ${patchRes.statusText}`);

        if (patchRes.ok) {
          const result = await patchRes.json();
          console.log(`\n✅ SUCCESS! Project updated.`);
          console.log(result);
          return true;
        } else {
          const error = await patchRes.text();
          console.log(`   Error:`, error.slice(0, 200));
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  return false;
}

async function main() {
  for (const baseUrl of POSSIBLE_ENDPOINTS) {
    console.log(`\n━━━ Testing base URL: ${baseUrl} ━━━`);
    const success = await tryUpdateProject(baseUrl);
    if (success) {
      console.log('\n🎉 Project updated successfully!\n');
      return;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('⚠️  Could not find working API endpoint');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Manual update required:');
  console.log('1. Visit claim URL to link your account:');
  console.log(`   ${env.COLOSSEUM_CLAIM_URL}`);
  console.log('\n2. Then update project at arena.colosseum.org\n');
  console.log('Project details ready in COLOSSEUM_DESCRIPTION_READY.txt\n');
}

main();
