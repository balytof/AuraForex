require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const crypto = require("crypto");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function generateUniqueCode() {
  while (true) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
}

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const code = await generateUniqueCode();
    await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
    console.log(`Updated ${user.email} -> ${code}`);
  }
  console.log("Done! All referral codes are now 8 characters.");
}

main().finally(() => prisma.$disconnect());
