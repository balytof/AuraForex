/**
 * ============================================================
 *  APEX SMC — execution/execution.js
 *  Módulo de execução universal — funciona com qualquer broker.
 *
 *  Toda a comunicação passa pelo data/broker.js (fábrica universal).
 *  Para mudar de broker: altere apenas config.credentials.provider
 *
 *  BROKERS SUPORTADOS:
 *    "oanda"        → OANDA v20 (demo + live)
 *    "fxcm"         → FXCM REST API (demo + live)
 *    "mt5"          → MetaTrader 5 via CSV bridge (qualquer broker MT5)
 *    "alphavantage" → Alpha Vantage (só dados, sem execução)
 *    "twelvedata"   → Twelve Data (só dados, sem execução)
 *    "demo"         → Simulação completa sem broker real
 * ============================================================
 */

const broker = require("../data/broker");
const log    = require("../utils/logger");

/**
 * Executa um sinal de trading — abre ordem no broker
 * @param {Object} signal  - sinal gerado pelo motor SMC
 * @param {number} lotSize - calculado pelo RiskManager
 * @returns {Promise<Object>} { brokerId, fillPrice, ... }
 */
async function executeSignal(signal, lotSize) {
  const brokerName = broker.getBrokerName();
  log.info(`Executando via ${brokerName} | ${signal.direction} ${signal.pair} | ${lotSize} lotes`);

  const result = await broker.openOrder(signal, lotSize);

  if (result.demo || result.simulated) {
    log.info(`[${brokerName}] Simulado | ID: ${result.brokerId} | Fill: ${result.fillPrice}`);
  } else {
    log.info(`[${brokerName}] Executado | ID: ${result.brokerId} | Fill: ${result.fillPrice}`);
  }

  return result;
}

/**
 * Fecha um trade aberto pelo broker ID
 * @param {string} brokerId
 * @param {string} pair
 * @param {string} reason - "TP" | "SL" | "MANUAL"
 * @returns {Promise<Object>}
 */
async function exitTrade(brokerId, pair, reason = "MANUAL") {
  log.info(`Fechando ${brokerId} (${pair}) | Razão: ${reason}`);
  try {
    return await broker.closeOrder(brokerId, pair);
  } catch (e) {
    log.error(`Erro ao fechar ${brokerId}: ${e.message}`);
    throw e;
  }
}

/**
 * Atualiza o Stop Loss no broker (trailing stop)
 * @param {string} brokerId
 * @param {number} newSl
 */
async function updateStopLoss(brokerId, newSl) {
  try {
    await broker.modifyStopLoss(brokerId, newSl);
    log.debug(`SL → ${newSl} | Trade: ${brokerId}`);
  } catch (e) {
    log.error(`Erro SL ${brokerId}: ${e.message}`);
  }
}

module.exports = { executeSignal, exitTrade, updateStopLoss };
