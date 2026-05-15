const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  const users = await prisma.user.findMany({
    include: { licenses: true }
  });

  console.log("=== LISTA DE UTILIZADORES E ESTADO DE RISCO ===");
  for (const user of users) {
    const statePath = path.join(__dirname, 'logs', 'users', user.id, 'bot_state.json');
    let locked = "Não";
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.dailyProfitLocked || state.circuitBreaker) {
        locked = "SIM (Resetando...)";
        // Reset manual imediato
        state.dailyProfitLocked = false;
        state.circuitBreaker = false;
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      }
    }
    console.log(`- Email: ${user.email} | ID: ${user.id} | Bloqueado: ${locked}`);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
