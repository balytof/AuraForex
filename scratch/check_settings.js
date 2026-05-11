const prisma = require('../db');

async function main() {
  try {
    const settings = await prisma.systemSettings.findFirst();
    console.log('Current System Settings:', JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error fetching settings:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
