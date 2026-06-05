require('dotenv').config();
const prisma = require('./db');

async function syncGas() {
  const providers = await prisma.provider.findMany();
  for (const provider of providers) {
    // If availableGas is out of sync
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { userId: provider.userId, type: 'PROVIDER' }
    });
    
    let totalPendingAndApproved = 0;
    for (const w of withdrawals) {
      if (w.status === 'PENDING' || w.status === 'APPROVED') {
        totalPendingAndApproved += w.amount;
      }
    }
    
    const correctAvailableGas = provider.totalGasEarned - totalPendingAndApproved;
    
    if (provider.availableGas !== correctAvailableGas) {
      console.log(`Fixing provider ${provider.id}: expected ${correctAvailableGas}, got ${provider.availableGas}`);
      await prisma.provider.update({
        where: { id: provider.id },
        data: { availableGas: correctAvailableGas }
      });
    }
  }
  console.log("Done");
}

syncGas().catch(console.error).finally(() => process.exit(0));
