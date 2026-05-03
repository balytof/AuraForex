const prisma = require('../db');

async function main() {
  const deleted = await prisma.signal.deleteMany({});
  console.log(`✅ ${deleted.count} sinais totais foram removidos da base de dados.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
