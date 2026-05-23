const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, walletBalance: true }});
  const pamm = await prisma.pammAccount.findMany();
  console.log("Users:", users);
  console.log("PAMM:", pamm);
}
main().finally(() => prisma.$disconnect());
