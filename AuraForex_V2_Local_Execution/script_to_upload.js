
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'balytof@gmail.com' } });
    if(user) {
       const admin = await prisma.user.findUnique({ where: { email: 'admin@auratrade.ai' } });
       if(admin) {
           const provider = await prisma.provider.findFirst({ where: { userId: admin.id } });
           if(provider) {
               const sub = await prisma.clientSubscription.findFirst({ where: { userId: user.id } });
               if(sub) {
                   await prisma.clientSubscription.update({
                       where: { id: sub.id },
                       data: { totalGasPaid: 10 }
                   });
                   console.log("Updated balytof sub totalGasPaid to 10");
               } else {
                   await prisma.clientSubscription.create({
                       data: {
                           userId: user.id,
                           providerId: provider.id,
                           totalGasPaid: 10,
                           status: "ACTIVE"
                       }
                   });
                   console.log("Created balytof sub with totalGasPaid 10");
               }
           }
       }
    }
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
