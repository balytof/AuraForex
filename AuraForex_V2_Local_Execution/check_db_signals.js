const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Last 5 signals:", signals);
}

main().catch(console.error).finally(() => prisma.$disconnect());
