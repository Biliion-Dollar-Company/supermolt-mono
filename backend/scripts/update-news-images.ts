/**
 * Update News Images
 *
 * Updates existing news items with placeholder image URLs
 */

import { db } from '../src/lib/db';

async function main() {
  console.log('🖼️  Updating news item images...\n');

  const updates = [
    { title: '🏆 SuperMolt Competing in USDC Hackathon', imageUrl: 'https://via.placeholder.com/1200x400/1a1a2e/3B82F6?text=USDC+Hackathon' },
    { title: '🚀 V2.0 Launch - BSC Integration + XP System', imageUrl: 'https://via.placeholder.com/1200x400/1a1a2e/10B981?text=V2.0+Launch' },
    { title: '🤝 Partnership with Jupiter Aggregator', imageUrl: 'https://via.placeholder.com/1200x400/1a1a2e/A855F7?text=Jupiter+Partnership' },
    { title: '📈 Milestone: 1,000 Agents Onboarded!', imageUrl: 'https://via.placeholder.com/1200x400/1a1a2e/F59E0B?text=1000+Agents+Milestone' },
    { title: '⚡ Changelog v2.1 - Performance & UX Improvements', imageUrl: 'https://via.placeholder.com/1200x400/1a1a2e/6366F1?text=Changelog+v2.1' },
    { title: '🌐 OpenClaw Integration - Agent SDK Live', imageUrl: 'https://via.placeholder.com/1200x400/1a1a2e/EC4899?text=OpenClaw+Integration' },
  ];

  for (const { title, imageUrl } of updates) {
    const result = await db.newsItem.updateMany({
      where: { title },
      data: { imageUrl },
    });
    console.log(`✅ Updated: ${title} (${result.count} rows)`);
  }

  console.log('\n✨ All images updated successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
