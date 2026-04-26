const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const admin = await prisma.user.findUnique({ 
      where: { email: 'admin@auratrade.ai' },
      include: { connections: true, licenses: true }
    });

    if (admin) {
      console.log("Admin User found:");
      console.log("- ID:", admin.id);
      console.log("- Email:", admin.email);
      console.log("- Connections count:", admin.connections.length);
      console.log("- Licenses count:", admin.licenses.length);
      
      if (admin.licenses.length > 0) {
        admin.licenses.forEach(l => {
          console.log(`  - License: ${l.type}, Status: ${l.status}, Expires: ${l.expiresAt}`);
        });
      }
    } else {
      console.log("Admin User 'admin@auratrade.ai' NOT found.");
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
