const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const provider = await prisma.provider.findFirst();
    console.log('Provider:', provider);
    
    if (!provider) return console.log('No provider');
    
    const clients = await prisma.clientSubscription.findMany({
      where: { providerId: provider.id }
    });
    console.log('Clients length:', clients.length);
    
    let totalGasDeposited = 0;
    for (let c of clients) {
      totalGasDeposited += (c.totalGasPaid || 0);
    }
    console.log('Total deposited:', totalGasDeposited);
    
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { type: "PROVIDER" }
    });
    console.log('Withdrawals length:', withdrawals.length);
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
