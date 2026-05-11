const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Pegar o admin
    const admin = await prisma.user.findUnique({ where: { email: 'admin@auratradebots.com' } });
    if (!admin) {
        console.log('❌ Admin não encontrado.');
        return;
    }

    // 2. Criar um plano se não existir
    let plan = await prisma.licensePlan.findFirst();
    if (!plan) {
        plan = await prisma.licensePlan.create({
            data: { name: 'V6 Master Plan', price: 0, durationDays: 365, isActive: true }
        });
        console.log('✅ Plano criado:', plan.id);
    }

    // 3. Criar a licença
    const license = await prisma.license.create({
        data: {
            id: 'AURA-V6-MASTER-2026', // ID customizado fácil de usar
            userId: admin.id,
            planId: plan.id,
            status: 'ACTIVE',
            expiresAt: new Date('2027-01-01')
        }
    });

    console.log('✨ LICENÇA MESTRE CRIADA!');
    console.log('CHAVE:', license.id);
}

main().finally(() => prisma.$disconnect());
