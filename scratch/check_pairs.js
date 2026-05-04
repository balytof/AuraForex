const prisma = require('../db');

async function check() {
    console.log("--- USER SETTINGS (FILTERED) ---");
    const settings = await prisma.userSettings.findMany();
    settings.forEach(s => {
        console.log(`User: ${s.userId}, Pairs: ${s.activePairs}`);
    });
}

check().catch(console.error).finally(() => prisma.$disconnect());
