import { db } from '../src/lib/db';

async function main() {
  const count = await db.newsItem.count();
  console.log(`📰 Total news items in database: ${count}`);

  const items = await db.newsItem.findMany({
    take: 3,
    select: {
      id: true,
      title: true,
      published: true,
    },
  });

  console.log('\n📋 First 3 news items:');
  items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.title} (published: ${item.published})`);
  });
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
