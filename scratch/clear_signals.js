const prisma = require('../db');

async function main() {
  const deleted = await prisma.signal.deleteMany({
    where: { status: 'PENDING' }
  });
  console.log(`✅ ${deleted.count} sinais pendentes antigos foram removidos.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
