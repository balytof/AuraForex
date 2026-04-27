// ============================================================
// APEX SMC — Production Multi-Broker Layer (EXPERT EDITION - STABLE)
// ============================================================

const https = require('https');
const fetch = require('node-fetch');
const MetaApi = require('metaapi.cloud-sdk').default;

// --- EXPERT UTILS ---
const SYMBOL_MAP = {
  "XAUUSD": ["GOLD", "XAUUSD", "XAUUSD.m", "XAUUSD.pro", "XAUUSD.ecn", "XAUUSD.raw", "XAUUSD.x", "GOLD.m", "GOLD.pro"],
  "EURUSD": ["EURUSD", "EURUSD.m", "EURUSD.pro", "EURUSD.ecn", "EURUSD.raw", "EURUSD.x"],
  "GBPUSD": ["GBPUSD", "GBPUSD.m", "GBPUSD.pro", "GBPUSD.ecn", "GBPUSD.raw", "GBPUSD.x"],
  "USDJPY": ["USDJPY", "USDJPY.m", "USDJPY.pro", "USDJPY.ecn", "USDJPY.raw", "USDJPY.x"],
  "GBPJPY": ["GBPJPY", "GBPJPY.m", "GBPJPY.pro", "GBPJPY.ecn", "GBPJPY.raw", "GBPJPY.x"],
  "EURGBP": ["EURGBP", "EURGBP.m", "EURGBP.pro", "EURGBP.ecn", "EURGBP.raw", "EURGBP.x"]
};

function normalizeToTick(price, tickSize = 0.00001) {
  if (!price) return 0;
  const inv = 1.0 / tickSize;
  return Math.round(price * inv) / inv;
}

class BrokerBase {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this.accountInfo = null;
  }
  async connect() { throw new Error('Not implemented'); }
  async getBalance() { throw new Error('Not implemented'); }
  async getPrice(pair) { throw new Error('Not implemented'); }
  async placeOrder(signal, lotSize) { throw new Error('Not implemented'); }
  async closePosition(positionId) { throw new Error('Not implemented'); }
  async modifySL(positionId, newSl) { throw new Error('Not implemented'); }
  async getOpenPositions() { throw new Error('Not implemented'); }
  async getCandles(symbol, timeframe, limit) { 
    console.warn(`[FALLBACK] getCandles called for ${symbol}`);
    return []; 
  }
  async getStatus() { return { success: true, connected: this.connected, accountInfo: this.accountInfo }; }
  async disconnect() { this.connected = false; return { success: true }; }
}

function validateSignal(signal) {
  if (!signal || !signal.pair || !signal.direction) throw new Error('Invalid signal data');
}

// ============================================================
// OandaAdapter
// ============================================================
class OandaAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.accountId = config.oandaAccountId || config.accountId;
    this.apiKey = config.oandaApiKey || config.apiToken;
    this.environment = config.environment || 'demo';
    this.baseUrl = (this.environment === 'live') ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com';
    this.name = "OANDA";
    this.type = "oanda";
  }

  async request(method, endpoint, body = null) {
    const opts = {
      method,
      hostname: this.baseUrl,
      path: endpoint,
      headers: { 
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    return new Promise((resolve, reject) => {
      const req = https.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (res.statusCode >= 400) reject(new Error(`OANDA Error: ${d}`));
            else resolve(j);
          } catch(e) { reject(e); }
        });
      });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async connect() {
    try {
      const res = await this.request('GET', `/v3/accounts/${this.accountId}/summary`);
      this.connected = true;
      this.accountInfo = { 
        balance: parseFloat(res.account.balance), 
        broker: "OANDA",
        brokerName: "OANDA",
        brokerType: "oanda",
        currency: res.account.currency || "USD",
        accountType: this.environment === 'live' ? "LIVE" : "DEMO",
        region: "🌎"
      };
      return { success: true, accountInfo: this.accountInfo };
    } catch(e) { return { success: false, error: e.message }; }
  }

  async placeOrder(signal, lotSize) {
    const units = signal.direction === 'BUY' ? Math.round(lotSize * 100000) : -Math.round(lotSize * 100000);
    const instrument = signal.pair.replace(/([A-Z]{3})([A-Z]{3})/, "$1_$2");
    try {
      const res = await this.request('POST', `/v3/accounts/${this.accountId}/orders`, {
        order: {
          type: 'MARKET', instrument, units: String(units), timeInForce: 'FOK',
          stopLossOnFill: { price: signal.sl.toFixed(5) },
          takeProfitOnFill: { price: signal.tp.toFixed(5) }
        }
      });
    } catch(e) { return { success: false, error: e.message }; }
  }

  async getOpenPositions() {
    try {
      const res = await this.request('GET', `/v3/accounts/${this.accountId}/openPositions`);
      return (res.positions || []).map(p => ({
        id: p.instrument, pair: p.instrument,
        direction: (parseFloat(p.long.units) > 0) ? "BUY" : "SELL",
        lotSize: Math.abs(parseFloat(p.long.units) || parseFloat(p.short.units)),
        pnl: parseFloat(p.unrealizedPL)
      }));
    } catch(e) { return []; }
  }

  async getCandles(symbol, timeframe = '1m', limit = 100) {
    const tfMap = {
      '1m': 'M1',
      '5m': 'M5',
      '15m': 'M15',
      '1h': 'H1',
      '4h': 'H4',
      '1d': 'D'
    };

    const res = await this.request(
      'GET',
      `/v3/instruments/${symbol}/candles?granularity=${tfMap[timeframe] || 'M1'}&count=${limit}`
    );

    return (res.candles || []).map(c => ({
      time: c.time,
      open: Number(c.mid.o),
      high: Number(c.mid.h),
      low: Number(c.mid.l),
      close: Number(c.mid.c),
      volume: c.volume
    }));
  }

  async getHistory() {
    try {
      const res = await this.request('GET', `/v3/accounts/${this.accountId}/trades?state=CLOSED&count=50`);
      return (res.trades || []).map(t => ({
        id: t.id, broker: "OANDA", pair: t.instrument.replace("_", ""),
        direction: Number(t.initialUnits) > 0 ? "BUY" : "SELL",
        lotSize: Math.abs(Number(t.initialUnits)) / 100000,
        pnl: Number(t.realizedPL), closeTime: t.closeTime
      }));
    } catch(e) { return []; }
  }
}

// ============================================================
// MetaApiAdapter
// ============================================================
class MetaApiAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.api = new MetaApi(config.metaApiToken || config.apiToken);
    this.accountId = config.metaApiAccountId || config.accountId;
    this.name = "MetaTrader";
    this.type = "metaapi";
  }

  async connect() {
    try {
      this.account = await this.api.metatraderAccountApi.getAccount(this.accountId);
      if (this.account.state !== 'DEPLOYED') await this.account.deploy();
      await this.account.waitConnected();
      this.connection = this.account.getRPCConnection();
      await this.connection.connect();
      const info = await this.connection.getAccountInformation();
      this.connected = true;
      
      // PRIORIDADE: Usa o ambiente que o utilizador selecionou no modal
      const selectedEnv = (this.config.environment || "").toUpperCase();
      const isLive = selectedEnv === "LIVE" || this.account.type === 'CLOUD-LIVE' || this.account.type === 'SELF-HOSTED';
      
      this.accountInfo = { 
        balance: info.balance, 
        broker: "MetaTrader",
        brokerName: "MetaTrader",
        brokerType: "metaapi",
        currency: info.currency || "USD",
        platform: "MT4/MT5",
        accountType: isLive ? "LIVE" : "DEMO",
        region: "🌐"
      };
      return { success: true, accountInfo: this.accountInfo };
    } catch(e) { return { success: false, error: e.message }; }
  }


  async getAccountInfo() {
    try {
      if (!this.connection) await this.connect();
      const info = await this.connection.getAccountInformation();
      this.accountInfo = {
        ...this.accountInfo,
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freeMargin,
        unrealizedPL: info.profit
      };
      return this.accountInfo;
    } catch (e) {
      console.error(`[EXPERT-MA] Erro ao obter info da conta: ${e.message}`);
      return this.accountInfo || { balance: 0, broker: "MetaTrader" };
    }
  }

  async getBalance() {
    const info = await this.getAccountInfo();
    return info.balance;
  }

  async resolveSymbol(requestedSymbol) {
    try {
      if (!this.connection) await this.connect();
      const allSymbols = await this.connection.getSymbols();
      const upper = requestedSymbol.toUpperCase();
      
      // 🎯 SOLUÇÃO PROFISSIONAL (Sugestão Expert)
      // Procura qualquer símbolo que comece com o par solicitado (ex: GBPUSD -> GBPUSDm)
      const match = allSymbols.find(s => 
        s.toUpperCase().startsWith(upper)
      );

      if (match) {
        console.log(`[EXPERT-MA] FBS/Broker Match Encontrado: ${upper} -> ${match}`);
        return match;
      }

      // Fallback para GOLD
      if (upper.includes("XAU")) {
        const goldMatch = allSymbols.find(s => s.includes("GOLD") || s.includes("XAU"));
        if (goldMatch) return goldMatch;
      }

      return upper;
    } catch (e) {
      return requestedSymbol.toUpperCase();
    }
  }

  calculateLotSize(balance, riskPercent, entry, sl, pair) {
    try {
      const riskAmount = balance * (riskPercent / 100);
      const stopDist = Math.abs(entry - sl);
      if (stopDist === 0) return 0.01;

      let pipValue = 10; // Standard lot
      if (pair.includes("JPY")) pipValue = 7;
      if (pair.includes("XAU") || pair.includes("GOLD")) pipValue = 1; // MetaTrader Gold calculation

      const pips = stopDist / (pair.includes("JPY") ? 0.01 : (pair.includes("XAU") || pair.includes("GOLD") ? 1 : 0.0001));
      
      // Ajuste de Precisão AURA PRO
      let divisor = 10;
      if (pair.includes("XAU") || pair.includes("GOLD")) divisor = 100; // Ouro precisa de divisor 100 no MT4/MT5
      
      let lotSize = riskAmount / (pips * divisor);

      // 🛡️ TRAVA DE SEGURANÇA EXPERT (AURA PRO)
      let maxLot = 0.50;
      if (pair.includes("XAU") || pair.includes("GOLD")) {
        maxLot = 0.05; 
        if (balance < 1000) maxLot = 0.02;
        if (balance < 500) maxLot = 0.01;
      } else {
        // Forex Guard
        if (balance < 1000) maxLot = 0.05;
        if (balance < 500) maxLot = 0.02;
        if (balance < 200) maxLot = 0.01;
      }

      const finalLot = Math.min(Math.max(parseFloat(lotSize.toFixed(2)), 0.01), maxLot);
      console.log(`[EXPERT-MA] Lote calculado para ${pair}: ${finalLot} (Risco: ${riskPercent}%, Saldo: ${balance})`);
      return finalLot;
    } catch (e) {
      return 0.01;
    }
  }

  async placeOrder(signal, riskPercent = 1) {
    try {
      if (!this.connection) await this.connect();
      
      // 🔍 Resolver símbolo correto (Expert Logic)
      const symbol = await this.resolveSymbol(signal.pair);
      
      // 📊 Dados da conta com limpeza de símbolos ($, etc)
      const account = await this.connection.getAccountInformation();
      let balance = parseFloat(String(account.balance).replace(/[^0-9.]/g, ''));
      let freeMargin = parseFloat(String(account.freeMargin).replace(/[^0-9.]/g, ''));
      
      console.log(`[EXPERT-MA] DIAGNÓSTICO: Saldo Bruto=${account.balance} | Saldo Limpo=${balance} | Margem Livre=${freeMargin}`);
      
      if (freeMargin < 1) {
        console.warn(`[EXPERT-MA] ❌ Margem Crítica: ${freeMargin}. Abortando.`);
        return { success: false, error: "Saldo/Margem Insuficiente" };
      }

      const tick = await this.connection.getSymbolPrice(symbol);
      const entry = signal.direction === 'BUY' ? tick.ask : tick.bid;

      // 💰 Calcular lote com trava de segurança extrema para FBS
      let lot = this.calculateLotSize(balance, riskPercent, entry, signal.sl, symbol);
      
      // 🛡️ REGRA DE OURO FBS: Se o saldo for menor que 1000 (seja USD ou Cents), 
      // forçamos o lote mínimo de 0.01 para Forex.
      if (!symbol.includes("XAU") && !symbol.includes("GOLD")) {
        if (balance < 1000) {
          console.log(`[EXPERT-MA] 🛡️ Conta FBS detetada. Forçando lote mínimo 0.01 para ${symbol}.`);
          lot = 0.01;
        }
      }

      console.log(`[EXPERT-MA] ORDEM PRONTA: Symbol=${symbol} | Lote=${lot} | Entry=${entry}`);

      // 🚀 Execução via REST API (Expert Logic - Ultra Fiel ao MT5)
      const region = this.account?.region || 'vint-hill';
      const baseUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`; 
      const url = `${baseUrl}/users/current/accounts/${this.accountId}/trade`;
      
      const payload = {
        symbol: symbol,
        actionType: signal.direction === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        volume: lot,
        comment: 'AURA PRO EXECUTION',
        magic: 202604
      };

      if (signal.sl) payload.stopLoss = signal.sl;
      if (signal.tp) payload.takeProfit = signal.tp;

      console.log(`[EXPERT-MA] Enviando REST:`, JSON.stringify(payload));

      const response = await fetch(`${baseUrl}/users/current/accounts/${this.accountId}/trade`, {
        method: 'POST',
        headers: {
          'auth-token': this.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log(`[EXPERT-MA] Resposta Raw:`, JSON.stringify(result));

      if (response.ok && (result.orderId || result.stringCode === 'TRADE_RETCODE_DONE')) {
        console.log(`[EXPERT-MA] ✅ Sucesso! ID: ${result.orderId || result.stringCode}`);
        return { success: true, orderId: result.orderId, fillPrice: entry };
      } else {
        const errorMsg = result.message || result.stringCode || "Rejeição Silenciosa";
        console.error(`[EXPERT-MA] ❌ Rejeição: ${errorMsg}`, result);
        throw new Error(errorMsg);
      }
    } catch (e) {
      console.error(`[EXPERT-MA] ❌ Fatal Error: ${e.message}`);
      return { success: false, error: e.message };
    }
  }
  }

  async getPrice(pair) {
    const requestedSymbol = pair.toUpperCase();
    try {
      if (!this.connection) await this.connect();
      const allSymbols = await this.connection.getSymbols();
      const symbol = allSymbols.find(s => s === requestedSymbol || s.startsWith(requestedSymbol) || (requestedSymbol === "XAUUSD" && s.startsWith("GOLD"))) || requestedSymbol;
      
      const tick = await this.connection.getSymbolPrice(symbol);
      console.log(`[EXPERT-MA] Preço obtido para ${symbol}: Bid=${tick.bid} Ask=${tick.ask}`);
      return { bid: tick.bid, ask: tick.ask, symbol };
    } catch (e) {
      console.error(`[EXPERT-MA] Erro ao obter preço para ${pair}: ${e.message}`);
      return null;
    }
  }

  async getOpenPositions() {
    try {
      await this.connect();
      const positions = await this.connection.getPositions();
      return (positions || []).map(p => ({
        id: p.id, 
        pair: p.symbol, 
        direction: p.type === "POSITION_TYPE_BUY" ? "BUY" : "SELL",
        lotSize: p.volume, 
        openPrice: p.openPrice, 
        pnl: p.profit,
        sl: p.stopLoss || 0,
        tp: p.takeProfit || 0
      }));
    } catch(e) { 
      console.error("MetaApi getOpenPositions error:", e);
      return []; 
    }
  }

  async getCandles(symbol, timeframe = '1m', limit = 100) {
    try {
      if (!this.connection) await this.connect();

      const tfMap = {
        '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d'
      };

      const candles = await this.connection.getCandles(
        symbol,
        tfMap[timeframe] || '1m',
        { limit }
      );

      return (candles || []).map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.tickVolume
      }));
    } catch (e) {
      console.error(`[EXPERT-MA] Error getCandles: ${e.message}`);
      return [];
    }
  }

  async getHistory() {
    try {
      if (!this.connection) await this.connect();
      const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias
      const deals = await this.connection.getDealsByTimeRange(startTime, new Date());
      
      // MetaApi pode retornar array direto ou objeto { deals: [] }
      const dealList = Array.isArray(deals) ? deals : (deals.deals || []);
      
      return dealList.map(d => ({
        id: d.id, broker: "MetaTrader", pair: d.symbol,
        direction: d.type === "DEAL_TYPE_BUY" ? "BUY" : "SELL",
        lotSize: d.volume, pnl: (d.profit || 0) + (d.commission || 0) + (d.swap || 0),
        closeTime: d.time
      })).filter(d => d.pair && d.pnl !== 0).reverse();
    } catch(e) { 
      console.error("MetaApi History Error:", e);
      return []; 
    }
  }
  async closePosition(positionId) {
    try {
      if (!this.connection) await this.connect();
      // MetaApi closePosition returns a promise that resolves on success
      await this.connection.closePosition(positionId);
      console.log(`[EXPERT-MA] ✅ Posição ${positionId} fechada com sucesso.`);
      return { success: true, message: "Posição fechada" };
    } catch (e) {
      console.error(`[EXPERT-MA] ❌ Erro ao fechar posição ${positionId}: ${e.message}`);
      return { success: false, error: e.message };
    }
  }
}

// ============================================================
// CapitalAdapter
// ============================================================
class CapitalAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.apiKey = config.capitalApiKey || config.apiKey;
    this.baseUrl = config.environment === 'live' ? "https://api-capital.backend-capital.com/api/v1" : "https://demo-api-capital.backend-capital.com/api/v1";
    this.name = "Capital.com";
    this.type = "capital";
  }

  async connect() {
     try {
       const res = await fetch(`${this.baseUrl}/session`, {
         method: "POST",
         headers: { "Content-Type": "application/json", "X-CAP-API-KEY": this.apiKey },
         body: JSON.stringify({ identifier: this.config.capitalIdentifier || this.config.identifier, password: this.config.capitalPassword || this.config.password })
       });
       this.cst = res.headers.get("CST");
       this.securityToken = res.headers.get("X-SECURITY-TOKEN");
       this.connected = true;
       this.accountInfo = {
         balance: 0,
         broker: "Capital.com",
         brokerName: "Capital.com",
         brokerType: "capital",
         currency: "USD",
         accountType: (this.config.environment || "demo") === "live" ? "LIVE" : "DEMO",
         region: "🇪🇺"
       };
       return { success: true, accountInfo: this.accountInfo };
     } catch(e) { return { success: false, error: e.message }; }
  }

  async placeOrder(signal, risk = 1) {
    const epic = signal.pair.includes("XAU") ? "GOLD" : signal.pair;
    try {
      const res = await fetch(`${this.baseUrl}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CAP-API-KEY": this.apiKey, "CST": this.cst, "X-SECURITY-TOKEN": this.securityToken },
        body: JSON.stringify({ epic, direction: signal.direction, size: 0.1, stopLevel: signal.sl, profitLevel: signal.tp, guaranteedStop: false, forceOpen: true })
      });
      const data = await res.json();
      return { success: !!data.dealReference, orderId: data.dealReference };
    } catch(e) { return { success: false, error: e.message }; }
  }

  async getCandles(symbol, timeframe = '1m', limit = 100) {
    const tfMap = { '1m': 'MINUTE', '5m': 'MINUTE_5', '15m': 'MINUTE_15', '1h': 'HOUR', '4h': 'HOUR_4', '1d': 'DAY' };
    try {
      const epic = symbol.includes("XAU") ? "GOLD" : symbol;
      const res = await fetch(`${this.baseUrl}/prices/${epic}?resolution=${tfMap[timeframe] || 'MINUTE'}&max=${limit}`, {
        method: "GET",
        headers: { "X-CAP-API-KEY": this.apiKey, "CST": this.cst, "X-SECURITY-TOKEN": this.securityToken }
      });
      const data = await res.json();
      return (data.prices || []).map(p => ({
        time: p.snapshotTime,
        open: p.openPrice.bid,
        high: p.highPrice.bid,
        low: p.lowPrice.bid,
        close: p.closePrice.bid,
        volume: 0
      }));
    } catch(e) { return []; }
  }
}

function createBroker(config) {
  const p = (config.provider || config.brokerType || '').toLowerCase();
  if (p === 'oanda') return new OandaAdapter(config);
  if (p === 'metaapi') return new MetaApiAdapter(config);
  if (p === 'capital') return new CapitalAdapter(config);
  throw new Error(`Provider ${p} not supported`);
}

module.exports = { createBroker };
