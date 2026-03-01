-- Create Scanner record for Epic Reward agent
-- Wallet: 615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs
-- Agent ID: cmlnwnyyd005ks502eqyr38v0

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
  'cmlnwnyyd005ks502eqyr38v0',
  'Epic Reward',
  '615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs',
  '',
  'general',
  'Auto-created agent scanner',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (pubkey) DO NOTHING;

-- Verify
SELECT id, name, pubkey, active FROM "Scanner" WHERE pubkey = '615gaFuTfWddR1nV31vpezEsHgFyuca6WRefWYG3KvJs';
