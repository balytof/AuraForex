
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { role: 'PROVIDER' } });
    if (!user) {
        console.log("No provider user found");
        return;
    }
    console.log("Testing as user:", user.email, "id:", user.id);

    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role
    }, process.env.JWT_SECRET || 'AuraForexSuperChaveSecretaDeProducao2026', { expiresIn: '7d' });

    console.log("Generated token:", token);

    const res = await fetch('http://localhost:3005/api/user/provider/stats', {
       headers: { 'Authorization': 'Bearer ' + token }
    });
    
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Response:", data);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
