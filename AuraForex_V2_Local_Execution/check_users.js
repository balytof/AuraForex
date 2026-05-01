const prisma = require('./db');

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true
    }
  });
  console.log('Users found:', JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
