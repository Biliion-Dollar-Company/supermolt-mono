/**
 * Fix: Create Scanner record for Epic Reward agent
 * This should have been created during SIWS registration but wasn't
 */

const AGENT_ID = 'cmlnwnyyd005ks502eqyr38v0';
const WALLET = '615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs';
const NAME = 'Epic Reward';

async function fixScanner() {
  try {
    console.log('🔧 Creating Scanner record for Epic Reward...\n');
    
    const response = await fetch('https://sr-mobile-production.up.railway.app/auth/agent/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: AGENT_ID,
        action: 'create_scanner'
      })
    });
    
    // Actually, we need to do this via database. Let me use a SQL approach instead.
    console.log('⚠️  This needs to be run via Railway CLI or dashboard SQL console\n');
    console.log('Copy-paste this SQL into Railway:\n');
    console.log('---');
    console.log(`
INSERT INTO "Scanner" (
  id,
  "agentId",
  name,
  pubkey,
  "privateKey",
  strategy,
  description,
  active,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  '${AGENT_ID}',
  '${NAME}',
  '${WALLET}',
  '',
  'general',
  'Auto-created agent scanner',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (pubkey) DO UPDATE SET
  "agentId" = EXCLUDED."agentId",
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  "updatedAt" = NOW();
    `.trim());
    console.log('---\n');
    console.log('After running, check: https://sr-mobile-production.up.railway.app/api/leaderboard');
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

fixScanner();
