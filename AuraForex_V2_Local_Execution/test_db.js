const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const s = await prisma.userSettings.findFirst();
    console.log("DB SETTINGS:", s);
}

main().catch(console.error).finally(() => process.exit(0));
