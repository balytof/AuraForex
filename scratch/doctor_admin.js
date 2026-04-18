const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function diagnose() {
  console.log("=== DIAGNÓSTICO DE PERMISSÕES ===");
  const email = "admin@auratrade.ai";
  const user = await prisma.user.findUnique({
    where: { email },
    include: { licenses: true }
  });

  if (!user) {
    console.log(`❌ ERRO: Usuário ${email} não encontrado.`);
    return;
  }

  console.log(`✅ Usuário: ${user.email}`);
  console.log(`✅ ID: ${user.id}`);
  console.log(`✅ Role: ${user.role}`);
  console.log(`✅ Licenças: ${user.licenses.length}`);
  
  if (user.role !== "ADMIN") {
    console.log("⚠️ AVISO: O Role não está como ADMIN. Corrigindo agora...");
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" }
    });
    console.log("✅ Role atualizado para ADMIN com sucesso.");
  } else {
    console.log("💎 O Role já está configurado como ADMIN corretamente.");
  }
}

diagnose().catch(console.error).finally(() => prisma.$disconnect());
