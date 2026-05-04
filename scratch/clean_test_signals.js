const prisma = require('../db');

async function clean() {
    console.log("Limpando sinais de teste...");
    const deleted = await prisma.signal.deleteMany({
        where: {
            pair: "EURUSD",
            direction: "BUY",
            entry: 1.0850,
            status: "PENDING"
        }
    });
    console.log(`Removidos ${deleted.count} sinais.`);
}

clean().catch(console.error).finally(() => prisma.$disconnect());
