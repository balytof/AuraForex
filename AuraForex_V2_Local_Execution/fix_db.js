const prisma = require('./db');
async function fix() {
    const res = await prisma.signal.updateMany({
        where: { status: { in: ['EXECUTED', 'PENDING'] } },
        data: { status: 'CLOSED' }
    });
    console.log(`Fechados ${res.count} sinais.`);
    process.exit(0);
}
fix();
