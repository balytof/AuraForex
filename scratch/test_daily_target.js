const RiskManager = require("../risk/risk");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function mockStatusEndpoint(license, risk, targetPercent = 0.10) {
  let lastBalance = (risk.balance && risk.balance > 0) ? risk.balance : (license ? license.balance : 0);
  if (lastBalance === null || lastBalance === undefined) lastBalance = 0;

  let lastEquity = (risk.equity && risk.equity > 0) ? risk.equity : (license ? license.equity : lastBalance);
  if (lastEquity === null || lastEquity === undefined) lastEquity = lastBalance;

  // 🛡️ LÓGICA INSTITUCIONAL: Usar apenas o dailyStartBalance!
  let startCapital = (risk.dailyStartBalance && risk.dailyStartBalance > 0) 
    ? risk.dailyStartBalance 
    : lastBalance;

  let dailyTargetMoney = startCapital * targetPercent;
  if (isNaN(dailyTargetMoney)) dailyTargetMoney = 0;

  // Evolução Líquida = Equity - Saldo Inicial
  let netEvolution = lastEquity - startCapital;

  let isProfitLocked = risk.dailyProfitLocked;
  if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {
    isProfitLocked = true;
  }

  return {
    success: true,
    balance: lastBalance,
    equity: lastEquity,
    dailyPnl: netEvolution, // A evolução total do P&L (Equity - Saldo Inicial)
    dailyTargetMoney: dailyTargetMoney,
    isLocked: isProfitLocked || risk.circuitBreaker,
    isProfitLocked: isProfitLocked
  };
}

async function runTest() {
  console.log("🚀 Iniciando teste do RiskManager com Lógica Institucional de Equity Estrita...");
  
  const userId = "test_user_equity_evolution";
  const manager = new RiskManager(userId);
  
  try {
    // 1. Definir saldo inicial de $260.00
    console.log("\n👉 Passo 1: Definindo saldo inicial de $260.00...");
    manager.setBalance(260.00, 260.00);
    
    let license = { balance: 260.00, equity: 260.00 };
    let status = mockStatusEndpoint(license, manager);
    
    assert.strictEqual(Number(status.dailyTargetMoney.toFixed(2)), 26.00, "A Meta Diária (10%) deveria ser $26.00!");
    assert.strictEqual(status.dailyPnl, 0, "O P&L inicial (Evolução) deveria ser $0.00!");
    assert.strictEqual(status.isProfitLocked, false, "O sistema não deveria estar bloqueado.");
    console.log("   ✅ Meta Diária Inicial Fixa calculada corretamente: $26.00");

    // 2. Caso A: Soma dos lucros atual realizado = +10 (Saldo = 270, Equity = 270)
    console.log("\n👉 Passo 2 (Caso A): Soma dos lucros atual realizado = +$10.00 (Saldo = $270, Equity = $270)...");
    license.balance = 270.00;
    license.equity = 270.00;
    manager.setBalance(270.00, 270.00);
    
    status = mockStatusEndpoint(license, manager);
    assert.strictEqual(Number(status.dailyTargetMoney.toFixed(2)), 26.00, "A Meta Diária deve permanecer fixa em $26.00!");
    assert.strictEqual(status.dailyPnl, 10.00, "O P&L Não Realizado (Evolução) deveria ser +$10.00!");
    assert.strictEqual(status.isProfitLocked, false, "O sistema não deveria estar bloqueado.");
    console.log("   ✅ P&L Não Realizado mostra exatamente a Evolução de +$10.00.");

    // 3. Caso B: Soma dos lucros das ordens abertas = -10 (Saldo = 260, Equity = 250)
    console.log("\n👉 Passo 3 (Caso B): Soma dos lucros das ordens abertas = -$10.00 (Saldo = $260, Equity = $250)...");
    license.balance = 260.00;
    license.equity = 250.00;
    manager.setBalance(260.00, 250.00);
    
    status = mockStatusEndpoint(license, manager);
    assert.strictEqual(Number(status.dailyTargetMoney.toFixed(2)), 26.00, "A Meta Diária deve permanecer fixa em $26.00!");
    assert.strictEqual(status.dailyPnl, -10.00, "O P&L Não Realizado (Evolução) deveria ser -$10.00!");
    assert.strictEqual(status.isProfitLocked, false, "O sistema não deveria estar bloqueado.");
    console.log("   ✅ P&L Não Realizado mostra exatamente a Evolução de -$10.00 e o saldo real desce para $250.");

    // 4. Caso C: Lucro fechado = +20, ordens abertas = -10 (Saldo = 280, Equity = 270)
    console.log("\n👉 Passo 4 (Caso C): Lucro realizado = +$20.00, aberto = -$10.00 (Saldo = $280, Equity = $270)...");
    license.balance = 280.00;
    license.equity = 270.00;
    manager.setBalance(280.00, 270.00);
    
    status = mockStatusEndpoint(license, manager);
    assert.strictEqual(status.dailyPnl, 10.00, "O P&L Não Realizado (Evolução Líquida) deveria ser +$10.00!");
    assert.strictEqual(status.isProfitLocked, false, "O sistema não deveria estar bloqueado (10 < 26).");
    console.log("   ✅ Evolução calculada de forma perfeita em cenário misto: +$10.00.");

    // 5. Caso D: Meta Batida por Ordens Abertas (Saldo = 260, Equity = 290)
    console.log("\n👉 Passo 5 (Caso D): Lucro flutuante das ordens abertas = +$30.00 (Saldo = $260, Equity = $290)...");
    license.balance = 260.00;
    license.equity = 290.00;
    manager.setBalance(260.00, 290.00);
    
    // Testar gatilho no RiskManager
    const checkRes = manager.checkDailyProfitTarget([]);
    assert.strictEqual(checkRes.hit, true, "A meta diária deveria ser considerada BATIDA!");
    
    status = mockStatusEndpoint(license, manager);
    assert.strictEqual(status.isProfitLocked, true, "O sistema DEVERIA bloquear a conta e fechar todas as ordens!");
    console.log("   ✅ SINAL DE META ATINGIDA DISPARADO COM SUCESSO via evolução líquida!");

    console.log("\n🥇 TESTE CONCLUÍDO COM SUCESSO ABSOLUTO!");
  } catch (error) {
    console.error("❌ TESTE FALHOU:", error.message);
    process.exit(1);
  } finally {
    // Limpar ficheiros de estado gerados pelo teste
    const logDir = path.join(__dirname, "../logs/users", userId);
    if (fs.existsSync(logDir)) {
      const stateFile = path.join(logDir, "bot_state.json");
      if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
      const historyFile = path.join(logDir, "trade_history.json");
      if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
      fs.rmdirSync(logDir);
    }
  }
}

runTest();
