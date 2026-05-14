const RiskManager = require("./risk");
const userRisks = new Map();

function getRiskManager(userId) {
  if (!userRisks.has(userId)) {
    userRisks.set(userId, new RiskManager(userId));
  }
  return userRisks.get(userId);
}

module.exports = { userRisks, getRiskManager };
