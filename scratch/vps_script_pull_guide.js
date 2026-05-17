const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSettings.findFirst();
  if (settings && settings.installationGuide) {
    fs.writeFileSync('/root/guide_out.html', settings.installationGuide);
    console.log('Saved guide to /root/guide_out.html');
  } else {
    console.log('No guide found in DB');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
