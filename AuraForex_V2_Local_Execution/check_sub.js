
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'balytof@gmail.com' } });
    if(user) {
        const sub = await prisma.clientSubscription.findFirst({ where: { userId: user.id } });
        console.log("Sub:", sub);
    }
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
