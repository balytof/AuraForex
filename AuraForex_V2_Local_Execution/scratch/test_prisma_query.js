const prisma = require('./db');

async function main() {
  console.log('Testing Prisma findMany query...');
  const users = await prisma.user.findMany({
    include: {
      licenses: { orderBy: { expiresAt: 'desc' }, take: 1, include: { plan: true } },
      connections: { take: 1 },
      settings: true
    }
  });
  console.log(`✅ Success! Found ${users.length} users.`);
  console.log('Sample user structure:', JSON.stringify(users[0], null, 2));
}

main()
  .catch(e => {
    console.error('❌ Prisma Query Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
