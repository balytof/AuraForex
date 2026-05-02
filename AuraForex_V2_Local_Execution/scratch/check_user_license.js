const prisma = require('../db');

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'cliente@auraforex.com' },
    include: { licenses: true }
  });
  console.log(JSON.stringify(user, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
