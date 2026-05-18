const { getRiskManager } = require("../risk/store");
const risk = getRiskManager("5782b472-0ff0-4761-bf38-9fc149705574");
console.log("Daily Start Balance carregado:", risk.dailyStartBalance);
console.log("Daily Profit Target carregado:", risk.dailyProfitTarget);
console.log("Balance carregado:", risk.balance);
console.log("Equity carregada:", risk.equity);
