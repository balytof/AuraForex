const prisma = require('../db');

async function cleanup() {
  console.log("--- INICIANDO LIMPEZA DE MIGRAÇÃO V1 -> V2 ---");

  try {
    // 1. Remover sinais pendentes inválidos (sem preço ou ativo inválido)
    const deletedSignals = await prisma.signal.deleteMany({
      where: {
        status: "PENDING",
        OR: [
          { entry: 0 },
          { pair: "INVALID_ASSET" },
          { pair: "" }
        ]
      }
    });
    console.log(`✅ Sinais inválidos removidos: ${deletedSignals.count}`);
    
    // 2. Limpar conexões de broker de utilizadores comuns (opcional, mas libera espaço)
    // Se quiseres manter as conexões, comenta a linha abaixo.
    // const deletedConns = await prisma.brokerConnection.deleteMany({
    //   where: { user: { role: "USER" } }
    // });
    // console.log(`✅ Conexões legadas removidas: ${deletedConns.count}`);

  } catch (e) {
    console.error("❌ Erro durante a limpeza:", e.message);
  }

  console.log("--- LIMPEZA CONCLUÍDA ---");
  await prisma.$disconnect();
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});
