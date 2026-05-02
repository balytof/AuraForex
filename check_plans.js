const prisma = require('./db');

async function main() {
  const plans = await prisma.licensePlan.findMany();
  console.log('Plans found:', plans.length);
  plans.forEach(p => console.log(`- ${p.name}: $${p.price} (${p.durationDays} days, Active: ${p.isActive})`));
  
  if (plans.length === 0) {
    console.log('Creating default plans...');
    await prisma.licensePlan.createMany({
      data: [
        { name: 'PRO MONTHLY', price: 97.00, durationDays: 30, isActive: true },
        { name: 'PRO QUARTERLY', price: 247.00, durationDays: 90, isActive: true },
        { name: 'ULTRA LIFETIME', price: 997.00, durationDays: 9999, isActive: true }
      ]
    });
    console.log('Default plans created.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
