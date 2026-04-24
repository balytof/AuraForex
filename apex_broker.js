// ============================================================
// APEX SMC — Production Multi-Broker Layer (EXPERT EDITION - STABLE)
// ============================================================

const https = require('https');
const fetch = require('node-fetch');
const MetaApi = require('metaapi.cloud-sdk').default;

// --- EXPERT UTILS ---
const SYMBOL_MAP = {
  "XAUUSD": ["GOLD", "XAUUSD", "XAUUSD.m", "XAUUSD.pro"],
  "EURUSD": ["EURUSD", "EURUSD.m", "EURUSD.pro", "EURUSD.ecn"],
  "GBPUSD": ["GBPUSD", "GBPUSD.m", "GBPUSD.pro", "GBPUSD.ecn"],
  "USDJPY": ["USDJPY", "USDJPY.m", "USDJPY.pro", "USDJPY.ecn"],
  "GBPJPY": ["GBPJPY", "GBPJPY.m", "GBPJPY.pro", "GBPJPY.ecn"],
  "EURGBP": ["EURGBP", "EURGBP.m", "EURGBP.pro", "EURGBP.ecn"]
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
  async placeOrder(signal, lotSize) { throw new Error('Not implemented'); }
  async closePosition(positionId) { throw new Error('Not implemented'); }
  async modifySL(positionId, newSl) { throw new Error('Not implemented'); }
  async getOpenPositions() { throw new Error('Not implemented'); }
  async getStatus() { return { connected: this.connected, accountInfo: this.accountInfo }; }
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
      const res = await this.request('GET', `/v3/accounts/${this.accountId}/openTrades`);
      return (res.trades || []).map(t => ({
        id: t.id, pair: t.instrument.replace("_", ""),
        direction: Number(t.currentUnits) > 0 ? "BUY" : "SELL",
        lotSize: Math.abs(Number(t.currentUnits)) / 100000,
        openPrice: Number(t.price), pnl: Number(t.unrealizedPL)
      }));
    } catch(e) { return []; }
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

  async placeOrder(signal, lotSize) {
    const volume = parseFloat(lotSize);
    try {
      const symbol = signal.pair;
      const sl = normalizeToTick(signal.sl, symbol.includes("XAU") ? 0.01 : 0.00001);
      const tp = normalizeToTick(signal.tp, symbol.includes("XAU") ? 0.01 : 0.00001);
      let res;
      if (signal.direction === 'BUY') res = await this.connection.createMarketBuyOrder(symbol, volume, sl, tp);
      else res = await this.connection.createMarketSellOrder(symbol, volume, sl, tp);
      return { success: true, orderId: res.orderId };
    } catch (e) {
      if (e.message.includes("not found") || e.message.includes("Invalid symbol")) {
        const possible = SYMBOL_MAP[signal.pair] || [];
        for (const s of possible) {
           try {
             const r = signal.direction === 'BUY' 
               ? await this.connection.createMarketBuyOrder(s, volume, signal.sl, signal.tp)
               : await this.connection.createMarketSellOrder(s, volume, signal.sl, signal.tp);
             return { success: true, orderId: r.orderId };
           } catch(err) {}
        }
      }
    }
  }

  async getOpenPositions() {
    try {
      await this.connect();
      const positions = await this.connection.getPositions();
      return (positions || []).map(p => ({
        id: p.id, pair: p.symbol, direction: p.type === "POSITION_TYPE_BUY" ? "BUY" : "SELL",
        lotSize: p.volume, openPrice: p.openPrice, pnl: p.profit
      }));
    } catch(e) { return []; }
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

  async placeOrder(signal, lotSize) {
    const epic = signal.pair.includes("XAU") ? "GOLD" : signal.pair;
    try {
      const res = await fetch(`${this.baseUrl}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CAP-API-KEY": this.apiKey, "CST": this.cst, "X-SECURITY-TOKEN": this.securityToken },
        body: JSON.stringify({ epic, direction: signal.direction, size: lotSize, stopLevel: signal.sl, profitLevel: signal.tp, guaranteedStop: false, forceOpen: true })
      });
      const data = await res.json();
      return { success: !!data.dealReference, orderId: data.dealReference };
    } catch(e) { return { success: false, error: e.message }; }
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
