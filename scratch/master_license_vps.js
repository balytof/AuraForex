const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      console.log('Admin não encontrado.');
      return;
    }

    let plan = await prisma.licensePlan.findFirst();
    if (!plan) {
      plan = await prisma.licensePlan.create({
        data: { name: 'Master Plan', price: 0, durationDays: 365, isActive: true }
      });
    }

    const license = await prisma.license.upsert({
      where: { id: 'AURA-V6-MASTER-2026' },
      update: { status: 'ACTIVE', expiresAt: new Date('2027-01-01') },
      create: {
        id: 'AURA-V6-MASTER-2026',
        userId: admin.id,
        planId: plan.id,
        status: 'ACTIVE',
        expiresAt: new Date('2027-01-01')
      }
    });

    console.log('SUCCESS:' + license.id);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
