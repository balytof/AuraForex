const prisma = require('../db');

async function update() {
    const updated = await prisma.systemSettings.updateMany({
        data: {
            apiUrl: 'http://localhost:3005'
        }
    });
    console.log('Updated settings:', updated.count);
}

update().catch(console.error).finally(() => prisma.$disconnect());
