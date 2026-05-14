/**
 * ============================================================
 *  APEX SMC — data/broker.js
 *  Wrapper universal que liga a lógica antiga ao novo apex_broker.js.
 * ============================================================
 */

const { createBroker } = require("../apex_broker");
const config = require("../config/config");
const log = require("../utils/logger");
const prisma = require("../db");

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
    
    log.info(`[BROADCAST] Gerando sinal para todos os usuários ativos: ${signal.pair} ${signal.direction}`);

    try {
      // 1. Buscar todos os usuários com licença ativa
      const activeLicenses = await prisma.license.findMany({
        where: {
          status: "ACTIVE",
          expiresAt: { gt: new Date() }
        },
        select: { userId: true }
      });

      if (activeLicenses.length === 0) {
        log.warn("[BROADCAST] Nenhum usuário com licença ativa encontrado para receber o sinal.");
        return { success: false, error: "Sem usuários ativos" };
      }

      // 2. Criar um sinal na DB para cada usuário (o EA vai buscar)
      const signalPromises = activeLicenses.map(license => {
        return prisma.signal.create({
          data: {
            userId: license.userId,
            pair: signal.pair,
            direction: signal.direction,
            entry: signal.entry,
            sl: signal.sl,
            tp: signal.tp,
            lot: 0.01, // Lote padrão, o EA pode ajustar conforme o risco local
            status: "PENDING"
          }
        });
      });

      await Promise.all(signalPromises);
      log.info(`[BROADCAST] ✅ Sinal enviado para ${activeLicenses.length} usuários.`);

      return {
        success: true,
        count: activeLicenses.length,
        demo: config.bot.demoMode
      };

    } catch (err) {
      log.error(`[BROADCAST] Erro ao distribuir sinal: ${err.message}`);
      return { success: false, error: err.message };
    }
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
  },
  
  getOpenPositions: async () => {
    const b = getBroker();
    if (!b.connected) await b.connect();
    return await b.getOpenPositions();
  }
};
