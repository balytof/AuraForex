const prisma = require('./db');

async function main() {
    console.log('--- SINAIS PENDENTES ---');
    const signals = await prisma.signal.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(signals, null, 2));

    console.log('\n--- LICENÇAS ATIVAS ---');
    const licenses = await prisma.license.findMany({
        where: { status: 'ACTIVE' },
        include: { user: { select: { email: true } } }
    });
    console.log(JSON.stringify(licenses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
