const prisma = require("./db");

async function injectTestSignal() {
  console.log("🧪 INJETANDO SINAL DE TESTE V5 MASTER...");
  
  try {
    const signal = await prisma.signal.create({
      data: {
        userId: "d75bb50b-90e9-482f-854c-4392d22e20d4",
        pair: "EURUSD",
        direction: "BUY",
        entry: 0,
        sl: 1.08000,
        tp: 1.10000,
        lot: 0.01,
        atr: 0.00150, // ATR para o cálculo da V5
        status: "PENDING"
      }
    });

    console.log("✅ SINAL V5 INJETADO COM SUCESSO!");
    console.log("ID:", signal.id);
    console.log("Para o Usuário:", signal.userId);
    console.log("Aguarde 2 segundos para o robô reagir...");

  } catch (err) {
    console.error("❌ ERRO AO INJETAR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

injectTestSignal();
