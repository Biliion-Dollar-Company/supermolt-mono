import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:ydYVOWqevKGRXHNDaBajlmxbjhYxDECg@caboose.proxy.rlwy.net:16739/railway',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  // Get latest conversations
  const conversations = await client.query(`
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
    LIMIT 3
  `);
  
  console.log('\n📊 LATEST CONVERSATIONS:\n');
  conversations.rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.topic}`);
    console.log(`   Token: ${row.tokenMint || 'N/A'}`);
    console.log(`   Messages: ${row.message_count}`);
    console.log(`   Created: ${new Date(row.createdAt).toLocaleString()}`);
    console.log('');
  });
  
  if (conversations.rows.length > 0) {
    const latestId = conversations.rows[0].id;
    
    // Get messages from latest conversation
    const messages = await client.query(`
      SELECT 
        m."createdAt",
        a."agentId",
        a.config->>'name' as agent_name,
        m.text
      FROM "AgentMessage" m
      JOIN "TradingAgent" a ON m."agentId" = a."agentId"
      WHERE m."conversationId" = $1
      ORDER BY m."createdAt"
    `, [latestId]);
    
    console.log('\n💬 AGENT MESSAGES (Latest Conversation):\n');
    messages.rows.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.agent_name || msg.agentId}`);
      console.log(`   ${msg.text}`);
      console.log('');
    });
  }
  
  await client.end();
}

main().catch(console.error);
