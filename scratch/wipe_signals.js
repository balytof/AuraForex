const prisma = require('../db');

async function wipe() {
    const deleted = await prisma.signal.deleteMany({});
    console.log('Deleted signals:', deleted.count);
}

wipe().catch(console.error).finally(() => prisma.$disconnect());
