const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in DB:");
  users.forEach(u => console.log(`- ${u.email} (ID: ${u.id}, Role: ${u.role})`));
  
  if (users.length > 0) {
    const firstUser = users[0];
    await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: "ADMIN" }
    });
    console.log(`\n✅ Usuário ${firstUser.email} foi promovido a ADMIN.`);
  } else {
    console.log("\n❌ Nenhum usuário encontrado no banco de dados.");
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
