const prisma = require('../db');
const fs = require('fs');

async function backup() {
    console.log("Iniciando Backup de Segurança...");
    const data = {};
    
    data.users = await prisma.user.findMany();
    data.licenses = await prisma.license.findMany();
    data.plans = await prisma.licensePlan.findMany();
    data.settings = await prisma.userSettings.findMany();
    data.system = await prisma.systemSettings.findMany();
    data.purchaseRequests = await prisma.purchaseRequest.findMany();
    data.bonusTransactions = await prisma.bonusTransaction.findMany();
    data.withdrawals = await prisma.withdrawalRequest.findMany();
    
    fs.writeFileSync('db_backup_pre_migration.json', JSON.stringify(data, null, 2));
    console.log("Backup concluído com sucesso: db_backup_pre_migration.json");
    console.log(`Registros: ${data.users.length} usuários, ${data.licenses.length} licenças.`);
}

backup().catch(console.error).finally(() => prisma.$disconnect());
