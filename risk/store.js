const RiskManager = require("./risk");
const userRisks = new Map();

function getRiskManager(userId) {
  if (!userId) {
     console.error("[STORE-ERROR] getRiskManager chamado sem userId!");
     return null;
  }
  console.log(`[STORE-GET] Recuperando RiskManager para: ${userId}`);
  if (!userRisks.has(userId)) {
    console.log(`[STORE-CREATE] Criando nova instância para: ${userId}`);
    userRisks.set(userId, new RiskManager(userId));
  }
  return userRisks.get(userId);
}

module.exports = { userRisks, getRiskManager };
