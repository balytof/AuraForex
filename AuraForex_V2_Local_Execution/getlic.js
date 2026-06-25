require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@auraforex.com' }
  });
  console.log('LICENSE:', user ? user.licenseKey : 'Not found');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
