/**
 * ============================================================
 *  APEX SMC — bot.js
 *  Orquestrador principal — independente de broker.
 *
 *  FLUXO A CADA CICLO:
 *  1. Busca dados via broker universal (data/broker.js)
 *  2. Pede bias ao Gemini AI
 *  3. Gera sinais SMC + indicadores
 *  4. Verifica gestão de risco
 *  5. Executa ordens via execution/execution.js
 *  6. Monitoriza trades abertos (TP/SL/Trailing)
 * ============================================================
 */

const config    = require("./config/config");
const log       = require("./utils/logger");
const broker    = require("./data/broker");
const { generateSignal } = require("./signals/signals");
const { calcAll }        = require("./indicators/indicators");
const risk               = require("./risk/risk");
const { executeSignal, exitTrade, updateStopLoss } = require("./execution/execution");
const { analyzeBias }    = require("./ai/gemini");

let isRunning = false;
let loopTimer = null;
let cycleCount = 0;

// ══════════════════════════════════════════════
//  INICIALIZAÇÃO
// ══════════════════════════════════════════════
async function init() {
  log.info("═══════════════════════════════════════════");
  log.info(`  APEX SMC Bot v2.0`);
  log.info(`  Broker:   ${broker.getBrokerName()}`);
  log.info(`  Pares:    ${config.pairs.join(", ")}`);
  log.info(`  Modo:     ${config.bot.demoMode ? "DEMO (sem ordens reais)" : "⚠️  LIVE"}`);
  log.info(`  Intervalo: ${config.bot.intervalSeconds}s`);
  log.info("═══════════════════════════════════════════");

  const account = await broker.getAccountInfo();
  if (!account) {
    log.error("Não foi possível conectar ao broker. Verifique config.js.");
    process.exit(1);
  }

  log.info(`Conta: ${account.currency} | Saldo: $${account.balance.toFixed(2)}${account.simulated ? " (simulado)" : ""}`);
  risk.setBalance(account.balance);
}

// ══════════════════════════════════════════════
//  CICLO PRINCIPAL
// ══════════════════════════════════════════════
async function runCycle() {
  if (!isRunning) return;
  cycleCount++;
  log.info(`─── Ciclo #${cycleCount} | ${new Date().toLocaleTimeString("pt-PT")} ───`);

  if (risk.circuitBreaker) {
    log.warn("⚠️  Circuit breaker ativo. Bot pausado até amanhã.");
    scheduleNext();
    return;
  }

  // Atualiza saldo e passa para os pares
  const account = await broker.getAccountInfo();
  if (account) {
    risk.setBalance(account.balance);
    
    // Processa cada par em paralelo passando a conta atualizada
    await Promise.allSettled(config.pairs.map(pair => processPair(pair, account)));
  }

  // Stats a cada 10 ciclos
  if (cycleCount % 10 === 0) {
    log.info("📊 STATS", risk.getStats());
  }

  scheduleNext();
}

function scheduleNext() {
  if (isRunning) {
    loopTimer = setTimeout(runCycle, config.bot.intervalSeconds * 1000);
  }
}

// ══════════════════════════════════════════════
//  PROCESSAR UM PAR
// ══════════════════════════════════════════════
async function processPair(pair, accountNow) {
  try {
    // 1. Dados de mercado (via broker universal)
    const marketData = await broker.getMarketData(pair);
    if (!marketData.candles || marketData.candles.length < 100) {
      log.warn(`${pair}: dados insuficientes (${marketData.candles?.length ?? 0} candles)`);
      return;
    }

    const { candles, currentPrice, htfSummary } = marketData;
    const ind    = calcAll(candles);
    const lastAtr = ind.last.atr;

    // 2. Monitoriza trades abertos primeiro
    await monitorOpenTrades(pair, currentPrice, lastAtr);

    // 3. Bias da AI (com fallback de segurança)
    let aiResult = { bias: "neutral" };
    try {
      aiResult = await analyzeBias(pair, htfSummary);
    } catch (e) {
      log.warn(`${pair}: AI falhou, usando fallback neutral`);
    }

    // 4. Sinal SMC
    const signal = generateSignal(pair, candles, aiResult.bias);
    if (!signal) {
      log.debug(`${pair}: sem sinal (${aiResult.bias})`);
      return;
    }

    // 5. Verifica risco
    const perm = risk.canOpenTrade(pair);
    if (!perm.allowed) {
      log.info(`${pair}: bloqueado — ${perm.reason}`);
      return;
    }

    // 6. Tamanho de posição (Expert Safe Calculation)
    if (accountNow.freeMargin < 50) {
      log.warn(`${pair}: margem insuficiente (${accountNow.freeMargin})`);
      return;
    }

    const lotSize = risk.calcLotSizeSafe({
      balance: accountNow.balance,
      freeMargin: accountNow.freeMargin,
      entry: signal.entry,
      sl: signal.sl,
      pair
    });

    console.log("Balance:", accountNow.balance);
    console.log("FreeMargin:", accountNow.freeMargin);
    console.log("Lot:", lotSize);

    if (lotSize <= 0) {
      log.warn(`${pair}: lote inválido (${lotSize})`);
      return;
    }

    if (lotSize < 0.01) {
      log.warn(`${pair}: lote abaixo do mínimo (0.01)`);
      return;
    }

    // ANTI-REJEIÇÃO: Validação de margem real
    const validation = risk.validateMargin({
      freeMargin: accountNow.freeMargin,
      lot: lotSize,
      pair
    });

    if (!validation.valid) {
      log.warn(`${pair}: ${validation.reason}`);
      return;
    }

    log.signal({ ...signal, lotSize });

    // 7. Executa via broker universal
    const orderResult = await executeSignal(signal, lotSize);
    const brokerId    = orderResult?.brokerId || null;

    // 8. Regista internamente
    risk.registerTrade(signal, lotSize, brokerId);

  } catch (e) {
    log.error(`Erro ao processar ${pair}: ${e.message}`);
  }
}

// ══════════════════════════════════════════════
//  MONITORIZAR TRADES ABERTOS
// ══════════════════════════════════════════════
async function monitorOpenTrades(pair, currentPrice, atr) {
  const toClose = risk.checkOpenTrades(pair, currentPrice, atr);

  for (const { trade, closePrice, reason } of toClose) {
    if (trade.brokerId && !config.bot.demoMode) {
      const result = await exitTrade(trade.brokerId, pair, reason);
      
      if (!result?.success) {
        log.error(`Falha ao fechar ordem ${trade.brokerId} no broker`);
        continue; // Não fecha internamente se falhou no broker
      }
    }
    risk.closeTrade(trade.id, closePrice, reason);
  }

  // Atualiza SL no broker para trailing stops
  for (const trade of risk.openTrades.filter(t => t.pair === pair)) {
    if (trade.brokerId && trade.sl !== trade.slOriginal && !config.bot.demoMode) {
      await updateStopLoss(trade.brokerId, trade.sl);
      trade.slOriginal = trade.sl;
    }
  }
}

// ══════════════════════════════════════════════
//  CONTROLO
// ══════════════════════════════════════════════
async function start() {
  if (isRunning) { log.warn("Bot já está a correr"); return; }
  await init();
  isRunning = true;
  log.info("🚀 Bot iniciado!");
  runCycle();
}

function stop() {
  isRunning = false;
  if (loopTimer) clearTimeout(loopTimer);
  log.info("🛑 Bot parado.");
  log.info("📊 Estatísticas finais:", risk.getStats());
}

process.on("SIGINT",  () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });

module.exports = { start, stop };
