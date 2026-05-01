const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany();
    console.log("Found", users.length, "users");
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`);
    });
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
