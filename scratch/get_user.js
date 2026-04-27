const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst();
  if (user) {
    console.log('USER_EMAIL:', user.email);
  } else {
    console.log('No user found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
