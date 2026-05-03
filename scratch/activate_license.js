const prisma = require('./db');

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@auraforex.com' } });
  if (!admin) {
    console.error('Admin user not found!');
    return;
  }

  const licenseId = 'f32d7f53-249d-4b8a-846f-e68f8564e7f5';
  
  const license = await prisma.license.upsert({
    where: { id: licenseId },
    update: {
      status: 'ACTIVE',
      expiresAt: new Date('2026-12-31'),
      mtAccount: null // Permitir que ele se vincule na primeira execução
    },
    create: {
      id: licenseId,
      userId: admin.id,
      status: 'ACTIVE',
      planId: 'pro', // Assumindo que existe um plano 'pro'
      expiresAt: new Date('2026-12-31')
    }
  });

  console.log('✅ Licença ativada com sucesso:', license.id);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
