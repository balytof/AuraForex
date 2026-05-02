const prisma = require('../db');

async function main() {
  const signals = await prisma.signal.findMany({
    where: { status: 'PENDING' }
  });
  console.log(JSON.stringify(signals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
