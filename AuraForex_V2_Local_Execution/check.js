const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const settings = await prisma.systemSettings.findFirst();
  console.log('Friday Block Hour:', settings.fridayBlockHour);
}
main().finally(() => prisma.$disconnect());
