const prisma = require('./db');

async function main() {
    console.log('--- ÚLTIMOS 10 SINAIS (QUALQUER STATUS) ---');
    const signals = await prisma.signal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(signals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
