const prisma = require("./db");
const bcrypt = require("bcrypt");

async function createAdmin() {
  const email = "admin@auraforex.com";
  const password = "admin123456";
  const referralCode = "AURA-MASTER";

  try {
    console.log("Iniciando criação do Admin...");

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email: email },
      update: {
        role: "ADMIN",
        referralCode: referralCode
      },
      create: {
        email: email,
        passwordHash: passwordHash,
        role: "ADMIN",
        referralCode: referralCode
      }
    });

    console.log("==========================================");
    console.log("  ✅ ADMIN CRIADO COM SUCESSO!");
    console.log(`  E-mail: ${user.email}`);
    console.log(`  Senha:  ${password}`);
    console.log(`  Chave Mestre: ${user.referralCode}`);
    console.log("==========================================");

  } catch (err) {
    console.error("Erro ao criar admin:", err);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
