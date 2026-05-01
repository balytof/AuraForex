const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const connections = await prisma.brokerConnection.findMany();
    console.log("Found", connections.length, "connections");
    connections.forEach(c => {
      console.log(`- ID: ${c.id}, UserID: ${c.userId}, Broker: ${c.brokerName}, Account: ${c.accountId}`);
    });
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
