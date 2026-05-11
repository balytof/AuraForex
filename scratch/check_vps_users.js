const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ select: { email: true } });
    console.log('USUÁRIOS NO VPS:', JSON.stringify(users));
}

main().finally(() => prisma.$disconnect());
