const prisma = require('../db');
const eaApi = require('../ea_api');

async function test() {
    console.log("--- TESTE DE FLUXO DE SINAL ---");
    
    // 1. Encontrar um usuário com licença ativa
    const license = await prisma.license.findFirst({
        where: { status: "ACTIVE" },
        include: { user: true }
    });
    
    if (!license) {
        console.error("Nenhuma licença ativa encontrada para teste.");
        return;
    }
    
    console.log(`Usando Usuário: ${license.user.email} (Licença: ${license.id})`);
    
    // 2. Criar um sinal de teste
    const signal = await prisma.signal.create({
        data: {
            userId: license.userId,
            pair: "EURUSD",
            direction: "BUY",
            entry: 1.0850,
            sl: 1.0800,
            tp: 1.0950,
            lot: 0.1,
            status: "PENDING"
        }
    });
    
    console.log(`Sinal de teste criado: ${signal.id}`);
    
    // 3. Simular chamada do EA para buscar sinais
    console.log("Simulando busca de sinais pelo EA...");
    const signals = await prisma.signal.findMany({
        where: {
            userId: license.userId,
            status: "PENDING"
        }
    });
    
    const formatted = signals.map(s => ({
        id: String(s.id).trim(),
        pair: String(s.pair).trim().toUpperCase(),
        direction: String(s.direction).trim().toUpperCase(),
        entry: Number(s.entry || 0),
        sl: Number(s.sl || 0),
        tp: Number(s.tp || 0),
        lot: Number(s.lot || 0.01)
    }));
    
    console.log("JSON formatado para o EA:");
    console.log(JSON.stringify({ success: true, signals: formatted }, null, 2));
    
    // 4. Limpeza (Opcional, mas vamos deixar para o EA processar se o usuário estiver logado)
    // await prisma.signal.delete({ where: { id: signal.id } });
}

test().catch(console.error).finally(() => prisma.$disconnect());
