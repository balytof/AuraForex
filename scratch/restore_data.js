const prisma = require('../db');
const fs = require('fs');

async function restore() {
    console.log("Iniciando Restauro de Dados na Local DB...");
    const raw = fs.readFileSync('db_backup_pre_migration.json');
    const data = JSON.parse(raw);
    
    // 1. Planos
    console.log(`Restaurando ${data.plans.length} planos...`);
    for (const plan of data.plans) {
        await prisma.licensePlan.upsert({
            where: { id: plan.id },
            update: plan,
            create: plan
        });
    }
    
    // 2. Usuários
    console.log(`Restaurando ${data.users.length} usuários...`);
    for (const user of data.users) {
        // Remover campos que podem causar conflitos se o sponsor não existir ainda
        const { sponsorId, ...userData } = user;
        await prisma.user.upsert({
            where: { id: user.id },
            update: userData,
            create: userData
        });
    }
    
    // 2.1 Atualizar Sponsors (depois que todos os usuários existem)
    for (const user of data.users) {
        if (user.sponsorId) {
            await prisma.user.update({
                where: { id: user.id },
                data: { sponsorId: user.sponsorId }
            });
        }
    }
    
    // 3. Licenças
    console.log(`Restaurando ${data.licenses.length} licenças...`);
    for (const lic of data.licenses) {
        await prisma.license.upsert({
            where: { id: lic.id },
            update: lic,
            create: lic
        });
    }
    
    // 4. Configurações
    console.log("Restaurando configurações...");
    for (const s of data.settings) {
        await prisma.userSettings.upsert({
            where: { id: s.id },
            update: s,
            create: s
        });
    }
    
    for (const s of data.system) {
        await prisma.systemSettings.upsert({
            where: { id: s.id },
            update: s,
            create: s
        });
    }
    
    // 5. Histórico (Purchase, Bonus, Withdrawal)
    console.log("Restaurando histórico...");
    for (const r of data.purchaseRequests) {
        await prisma.purchaseRequest.upsert({
            where: { id: r.id },
            update: r,
            create: r
        });
    }
    
    for (const t of data.bonusTransactions) {
        await prisma.bonusTransaction.upsert({
            where: { id: t.id },
            update: t,
            create: t
        });
    }
    
    for (const w of data.withdrawals) {
        await prisma.withdrawalRequest.upsert({
            where: { id: w.id },
            update: w,
            create: w
        });
    }
    
    console.log("✅ Migração concluída com sucesso!");
}

restore().catch(console.error).finally(() => prisma.$disconnect());
