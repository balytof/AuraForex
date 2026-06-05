require('dotenv').config();
const prisma = require('./db');

async function resetGas() {
  const provider = await prisma.provider.findFirst();
  if (provider) {
    await prisma.provider.update({
      where: { id: provider.id },
      data: {
        totalGasEarned: 0
      }
    });
    console.log("Gas resetted for provider");
  }
}

resetGas().catch(console.error).finally(() => process.exit(0));
