/**
 * ============================================================
 *  APEX SMC — data/broker.js
 *  Wrapper universal que liga a lógica antiga ao novo apex_broker.js.
 * ============================================================
 */

const { createBroker } = require("../apex_broker");
const config = require("../config/config");
const log = require("../utils/logger");

let activeBroker = null;

function getBroker() {
  if (!activeBroker) {
    const provider = config.credentials.provider;
    log.info(`Inicializando broker: ${provider}`);
    
    const brokerConfig = {
      provider: provider,
      environment: config.bot.demoMode ? "demo" : "live",
      accountId: config.credentials.oandaAccountId, // Fallback OANDA
      apiToken: config.credentials.oandaApiKey,     // Fallback OANDA
      // Adicionar mapeamento para outros providers se necessário
    };
    
    // Mapeamento específico para MetaApi se estiver no config
    if (provider === "metaapi") {
      brokerConfig.metaApiToken = config.credentials.metaApiToken || config.credentials.apiToken;
      brokerConfig.metaApiAccountId = config.credentials.metaApiAccountId || config.credentials.accountId;
    }
    
    activeBroker = createBroker(brokerConfig);
  }
  return activeBroker;
}

module.exports = {
  getBrokerName: () => config.credentials.provider.toUpperCase(),
  
  getAccountInfo: async () => {
    const b = getBroker();
    if (!b.connected) await b.connect();
    // O novo apex_broker usa getAccountInfo() ou connect() retorna accountInfo
    if (b.type === "metaapi") return await b.getAccountInfo();
    return b.accountInfo;
  },
  
  getMarketData: async (pair) => {
    const b = getBroker();
    if (!b.connected) await b.connect();
    
    const candles = await b.getCandles(pair, config.timeframes.mtf || "H1", config.bot.candleCount || 250);
    const tick = await b.getPrice(pair);
    
    return {
      candles,
      currentPrice: tick ? tick.ask : 0,
      htfSummary: { pair, candles } // Simplificado para o bot legado
    };
  },
  
  openOrder: async (signal, lotSize) => {
    const b = getBroker();
    if (!b.connected) await b.connect();
    
    // O novo placeOrder aceita (signal, riskPercent)
    // Para manter compatibilidade com o bot legado que passa lotSize:
    // Vou injetar o lotSize no placeOrder se o adaptador suportar ou ajustar a chamada.
    
    const result = await b.placeOrder(signal, config.risk.riskPerTradePct);
    
    return {
      success: result.success,
      brokerId: result.orderId,
      fillPrice: result.fillPrice,
      demo: config.bot.demoMode
    };
  },
  
  closeOrder: async (brokerId, pair) => {
    const b = getBroker();
    if (!b.connected) await b.connect();
    return await b.closePosition(brokerId);
  },
  
  modifyStopLoss: async (brokerId, newSl) => {
    const b = getBroker();
    if (!b.connected) await b.connect();
    // Nota: O novo apex_broker ainda não implementa modifySL em todos os adaptadores
    if (b.modifySL) return await b.modifySL(brokerId, newSl);
    log.warn("modifySL não implementado para este broker.");
    return { success: false };
  }
};
