const prisma = require('../db');

async function check() {
    const signals = await prisma.signal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(signals, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
