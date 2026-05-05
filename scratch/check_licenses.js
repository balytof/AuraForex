const prisma = require('../db');
async function run() {
  try {
    const l = await prisma.license.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      }
    });
    console.log(JSON.stringify(l, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
