const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.signal.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'CANCELLED' }
  });
  console.log(`Cleared ${result.count} pending bad signals.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
