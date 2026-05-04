const prisma = require('../db');

async function check() {
    console.log("--- USER SETTINGS ---");
    const settings = await prisma.userSettings.findMany();
    console.log(JSON.stringify(settings, null, 2));
    
    console.log("--- SYSTEM SETTINGS ---");
    const sys = await prisma.systemSettings.findMany();
    console.log(JSON.stringify(sys, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
