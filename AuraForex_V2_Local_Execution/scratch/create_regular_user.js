const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = 'user@auraforex.com';
  const password = 'password123';
  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hash, role: 'USER' },
      create: {
        email,
        passwordHash: hash,
        role: 'USER'
      }
    });
    console.log('User created/updated:', user.email);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
