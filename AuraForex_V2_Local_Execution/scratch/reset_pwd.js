const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require('dotenv').config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  const hashedPassword = await bcrypt.hash('aura123', 10);
  await prisma.user.update({
    where: { email: 'admin@auratrade.ai' },
    data: { passwordHash: hashedPassword }
  });
  
  console.log('Senha de admin@auratrade.ai alterada para: aura123');
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
