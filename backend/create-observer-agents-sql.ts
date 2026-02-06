/**
 * Generate SQL to create 5 Observer Agents
 * Run this SQL directly in Railway database
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';

const OBSERVER_AGENTS = [
  {
    name: 'Agent Alpha',
    persona: 'Conservative Value Investor',
    strategy: 'Risk-averse, focuses on fundamentals and liquidity',
    focusAreas: ['holder_concentration', 'liquidity_depth', 'smart_money', 'risk_metrics'],
    emoji: '🛡️',
    traits: ['cautious', 'analytical', 'risk-focused'],
  },
  {
    name: 'Agent Beta',
    persona: 'Momentum Trader',
    strategy: 'Aggressive, loves volatility and quick flips',
    focusAreas: ['price_momentum', 'volume_spikes', 'social_sentiment', 'trend_following'],
    emoji: '🚀',
    traits: ['aggressive', 'hype-driven', 'fast-moving'],
  },
  {
    name: 'Agent Gamma',
    persona: 'Data Scientist',
    strategy: 'Pure numbers, statistical analysis and patterns',
    focusAreas: ['historical_patterns', 'correlation', 'volatility', 'probability'],
    emoji: '📊',
    traits: ['analytical', 'data-driven', 'mathematical'],
  },
  {
    name: 'Agent Delta',
    persona: 'Contrarian',
    strategy: 'Devil\'s advocate, questions hype, finds red flags',
    focusAreas: ['contract_analysis', 'team_verification', 'scam_detection', 'fud'],
    emoji: '🔍',
    traits: ['skeptical', 'cautious', 'critical'],
  },
  {
    name: 'Agent Epsilon',
    persona: 'Whale Watcher',
    strategy: 'Follows smart money and large wallet movements',
    focusAreas: ['whale_movements', 'smart_wallets', 'connected_wallets', 'insider_activity'],
    emoji: '🐋',
    traits: ['social', 'network-focused', 'copycat'],
  },
];

console.log('-- SQL to Create 5 Observer Agents');
console.log('-- Run this in Railway PostgreSQL database\n');
console.log('BEGIN;\n');

for (const agentData of OBSERVER_AGENTS) {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const secretKey = bs58.encode(keypair.secretKey);
  const id = `obs_${crypto.randomBytes(8).toString('hex')}`;
  
  const config = JSON.stringify({
    persona: agentData.persona,
    strategy: agentData.strategy,
    focusAreas: agentData.focusAreas,
    emoji: agentData.emoji,
    traits: agentData.traits,
    role: 'observer',
    observing: '9U5PtsCxkma37wwMRmPLeLVqwGHvHMs7fyLaL47ovmTn',
    secretKey: secretKey,
  }).replace(/'/g, "''"); // Escape single quotes for SQL

  console.log(`-- ${agentData.emoji} ${agentData.name}`);
  console.log(`INSERT INTO "TradingAgent" (`);
  console.log(`  "id", "userId", "archetypeId", "name", "status", "paperBalance", "config", "createdAt", "updatedAt"`);
  console.log(`) VALUES (`);
  console.log(`  '${id}',`);
  console.log(`  '${publicKey}',`);
  console.log(`  'observer',`);
  console.log(`  '${agentData.name}',`);
  console.log(`  'ACTIVE',`);
  console.log(`  0,`);
  console.log(`  '${config}'::jsonb,`);
  console.log(`  NOW(),`);
  console.log(`  NOW()`);
  console.log(`);\n`);
}

console.log('COMMIT;\n');
console.log('-- ✅ Run the above SQL in Railway to create observer agents');
