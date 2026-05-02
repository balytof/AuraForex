const prisma = require("./db");
const bcrypt = require("bcrypt");

async function createTestUser() {
  const email = "cliente@auraforex.com";
  const password = "senha123456";

  try {
    console.log("Criando usuário de teste...");
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email: email },
      update: { role: "USER" },
      create: {
        email: email,
        passwordHash: passwordHash,
        role: "USER",
        referralCode: "CLIENTE-TESTE"
      }
    });

    // Ativar licença de 30 dias para o teste
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const existingLicense = await prisma.license.findFirst({
      where: { userId: user.id }
    });

    if (existingLicense) {
      await prisma.license.update({
        where: { id: existingLicense.id },
        data: {
          status: "ACTIVE",
          expiresAt: expiresAt,
          type: "PRO-TESTE"
        }
      });
    } else {
      await prisma.license.create({
        data: {
          userId: user.id,
          status: "ACTIVE",
          expiresAt: expiresAt,
          type: "PRO-TESTE"
        }
      });
    }

    console.log("==========================================");
    console.log("  ✅ USUÁRIO COMUM CRIADO COM LICENÇA!");
    console.log(`  E-mail: ${email}`);
    console.log(`  Senha:  ${password}`);
    console.log("  Status: LICENÇA ATIVA (30 DIAS)");
    console.log("==========================================");

  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
