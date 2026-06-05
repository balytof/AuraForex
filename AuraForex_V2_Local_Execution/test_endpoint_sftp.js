
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'PROVIDER' } });
    if (!admin) {
       console.log("No provider found");
       return;
    }
    console.log("Found provider user:", admin.email);
    
    // Simulate what the stats endpoint does:
    const provider = await prisma.provider.findFirst({ where: { userId: admin.id } });
    console.log("Provider record:", provider);
    
    if(!provider) {
       console.log("No provider record for this user!");
       return;
    }

    const clients = await prisma.clientSubscription.findMany({
      where: { providerId: provider.id }
    });
    console.log("Clients:", clients);
    
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
