const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const l = await prisma.license.findMany();
  console.log(JSON.stringify(l, null, 2));
}
run().catch(console.error).finally(()=>prisma.$disconnect());
