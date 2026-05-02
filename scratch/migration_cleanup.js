const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function cleanup() {
  console.log("--- INICIANDO LIMPEZA DE MIGRAÇÃO V1 -> V2 ---");

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

  // 2. Opcional: Limpar logs de erro legados se existissem em alguma tabela (não aplicável aqui)

  console.log("--- LIMPEZA CONCLUÍDA ---");
  await prisma.$disconnect();
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});
