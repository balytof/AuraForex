const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setCent() {
    const user = await prisma.user.findFirst({ where: { email: 'aurafx1@gmail.com' } });
    if (!user) {
        console.log("User not found");
        return;
    }
    
    await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: { isCentAccount: true },
        create: { userId: user.id, isCentAccount: true }
    });
    
    console.log("Cent account enabled for user", user.email);
}

setCent().catch(console.error).finally(() => process.exit(0));
