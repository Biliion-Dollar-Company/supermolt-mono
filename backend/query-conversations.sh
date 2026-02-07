#!/bin/bash
export DATABASE_URL="postgresql://postgres:ydYVOWqevKGRXHNDaBajlmxbjhYxDECg@caboose.proxy.rlwy.net:16739/railway"

# Query latest conversation with messages
psql "$DATABASE_URL" << 'SQL'
SELECT 
  c.id,
  c.topic,
  c."tokenMint",
  c."createdAt",
  COUNT(m.id) as message_count
FROM "AgentConversation" c
LEFT JOIN "AgentMessage" m ON c.id = m."conversationId"
GROUP BY c.id
ORDER BY c."createdAt" DESC
LIMIT 3;

\echo ''
\echo '=== LATEST CONVERSATION MESSAGES ==='
\echo ''

SELECT 
  m."createdAt",
  a."agentId",
  a.config->>'name' as agent_name,
  SUBSTRING(m.text, 1, 100) as message_preview
FROM "AgentMessage" m
JOIN "TradingAgent" a ON m."agentId" = a."agentId"
WHERE m."conversationId" = (
  SELECT id FROM "AgentConversation" ORDER BY "createdAt" DESC LIMIT 1
)
ORDER BY m."createdAt"
LIMIT 5;
SQL
