const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fix() {
    const res = await prisma.signal.updateMany({
        where: { status: { in: ['EXECUTED', 'PENDING'] } },
        data: { status: 'CLOSED' }
    });
    console.log(`Fechados ${res.count} sinais.`);
}
fix();
