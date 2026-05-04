const prisma = require('../db');

async function check() {
    const users = await prisma.user.findMany();
    console.log(JSON.stringify(users, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
