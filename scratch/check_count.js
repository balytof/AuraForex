const prisma = require('../db');

async function check() {
    const count = await prisma.signal.count();
    console.log('Signal count:', count);
}

check().catch(console.error).finally(() => prisma.$disconnect());
