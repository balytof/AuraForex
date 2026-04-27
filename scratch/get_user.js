const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient({ accelerateUrl: process.env.DATABASE_URL });
async function main() {
  const user = await prisma.user.findFirst();
  if (user) {
    console.log('USER_EMAIL:', user.email);
  } else {
    console.log('No user found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
