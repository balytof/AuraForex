const prisma = require("./db");

async function testV4Signal() {
  console.log("🧪 INICIANDO TESTE DE SINAL V4 MAGIC...");
  
  try {
    // 1. Criar um sinal de teste com parâmetros V4
    const testSignal = await prisma.signal.create({
      data: {
        userId: "f613cfd9-0b39-48cf-9c5f-851cef93d4ec",
        pair: "EURUSD",
        direction: "BUY",
        entry: 0, // V4: Entrada a mercado local
        sl: 1.08500,
        tp: 1.09500,
        lot: 0.10,
        status: "PENDING"
      }
    });

    console.log("✅ SINAL GRAVADO NA BD COM SUCESSO!");
    console.log("ID:", testSignal.id);
    console.log("Par:", testSignal.pair);
    console.log("Status:", testSignal.status);

    // 2. Verificar se o EA conseguiria ler
    const check = await prisma.signal.findFirst({
      where: { userId: "f613cfd9-0b39-48cf-9c5f-851cef93d4ec", status: "PENDING" }
    });

    if (check) {
      console.log("📡 TESTE DE TRANSMISSÃO: O EA conseguiria baixar este sinal agora.");
    }

    // 3. Limpar teste
    await prisma.signal.delete({ where: { id: testSignal.id } });
    console.log("🧹 Limpeza de teste concluída.");

  } catch (err) {
    console.error("❌ ERRO NO TESTE:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testV4Signal();
