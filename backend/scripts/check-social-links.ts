import { db } from '../src/lib/db';

async function checkSocials() {
  const agents = await db.tradingAgent.findMany({
    select: {
      name: true,
      displayName: true,
      twitterHandle: true,
      discord: true,
      telegram: true,
      website: true,
      totalTrades: true,
    },
    orderBy: { totalTrades: 'desc' }
  });
  
  const withTwitter = agents.filter(a => a.twitterHandle);
  const withDiscord = agents.filter(a => a.discord);
  const withTelegram = agents.filter(a => a.telegram);
  const withWebsite = agents.filter(a => a.website);
  const withAnySocial = agents.filter(a => a.twitterHandle || a.discord || a.telegram || a.website);
  
  console.log('\n📱 Social Account Links Summary\n');
  console.log(`Total Agents: ${agents.length}`);
  console.log(`With Twitter: ${withTwitter.length}`);
  console.log(`With Discord: ${withDiscord.length}`);
  console.log(`With Telegram: ${withTelegram.length}`);
  console.log(`With Website: ${withWebsite.length}`);
  console.log(`With ANY social: ${withAnySocial.length}`);
  console.log(`\nPercentage with socials: ${((withAnySocial.length / agents.length) * 100).toFixed(1)}%`);
  
  console.log('\n✅ Agents with Twitter Linked:\n');
  withTwitter.forEach(a => {
    const name = a.displayName || a.name;
    console.log(`  • ${name} → @${a.twitterHandle} (${a.totalTrades} trades)`);
  });
  
  if (withDiscord.length > 0) {
    console.log('\n💬 Agents with Discord:\n');
    withDiscord.forEach(a => {
      const name = a.displayName || a.name;
      console.log(`  • ${name} → ${a.discord}`);
    });
  }
  
  if (withTelegram.length > 0) {
    console.log('\n📲 Agents with Telegram:\n');
    withTelegram.forEach(a => {
      const name = a.displayName || a.name;
      console.log(`  • ${name} → ${a.telegram}`);
    });
  }
  
  if (withWebsite.length > 0) {
    console.log('\n🌐 Agents with Website:\n');
    withWebsite.forEach(a => {
      const name = a.displayName || a.name;
      console.log(`  • ${name} → ${a.website}`);
    });
  }
  
  const noSocials = agents.filter(a => !a.twitterHandle && !a.discord && !a.telegram && !a.website);
  console.log(`\n❌ Agents with NO socials: ${noSocials.length}\n`);
  noSocials.forEach(a => {
    const name = a.displayName || a.name;
    console.log(`  • ${name} (${a.totalTrades} trades)`);
  });
  
  process.exit(0);
}

checkSocials();
