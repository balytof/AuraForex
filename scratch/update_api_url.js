const prisma = require('./db');

async function main() {
  const newUrl = "http://139.59.159.48:3005/api";
  console.log('🚀 Updating System Settings to:', newUrl);
  
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (settings) {
      const updated = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { apiUrl: newUrl }
      });
      console.log('✅ Updated Settings:', updated);
    } else {
      const created = await prisma.systemSettings.create({
        data: { apiUrl: newUrl }
      });
      console.log('✅ Created Settings:', created);
    }
  } catch (err) {
    console.error('❌ Error updating settings:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
