// ============================================================
// APEX SMC — Production Multi-Broker Layer (EXPERT EDITION)
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
    this.baseUrl = (config.environment === 'live') ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com';
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
        currency: res.account.currency || "USD"
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
      return { success: true, orderId: res.orderFillTransaction.id };
    } catch(e) { return { success: false, error: e.message }; }
  }
}

// ============================================================
// MetaApiAdapter (EXPERT)
// ============================================================
class MetaApiAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.api = new MetaApi(config.metaApiToken || config.apiToken);
    this.accountId = config.metaApiAccountId || config.accountId;
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
      this.accountInfo = { 
        balance: info.balance, 
        broker: "MetaTrader",
        brokerName: "MetaTrader",
        currency: info.currency || "USD",
        platform: "MT4/MT5"
      };
      return { success: true, accountInfo: this.accountInfo };
    } catch(e) { return { success: false, error: e.message }; }
  }

  async placeOrder(signal, lotSize) {
    await this.connect();
    const symbol = signal.pair; 
    const volume = parseFloat(lotSize);

    try {
      // Tenta encontrar o símbolo correto (Tradução Automática)
      let targetSymbol = symbol;
      const possible = SYMBOL_MAP[symbol] || [symbol];
      
      // Tentativa de execução com normalização de Tick
      const sl = normalizeToTick(signal.sl, symbol.includes("XAU") ? 0.01 : 0.00001);
      const tp = normalizeToTick(signal.tp, symbol.includes("XAU") ? 0.01 : 0.00001);

      let res;
      if (signal.direction === 'BUY') {
        res = await this.connection.createMarketBuyOrder(targetSymbol, volume, sl, tp);
      } else {
        res = await this.connection.createMarketSellOrder(targetSymbol, volume, sl, tp);
      }
      return { success: true, orderId: res.orderId };
    } catch (e) {
      // SE FALHAR POR SÍMBOLO, TENTA A LISTA DE MAPEAMENTO
      if (e.message.includes("not found") || e.message.includes("Invalid symbol")) {
        const possible = SYMBOL_MAP[signal.pair] || [];
        for (const s of possible) {
           try {
             const r = signal.direction === 'BUY' 
               ? await this.connection.createMarketBuyOrder(s, volume, signal.sl, signal.tp)
               : await this.connection.createMarketSellOrder(s, volume, signal.sl, signal.tp);
             return { success: true, orderId: r.orderId, symbolUsed: s };
           } catch(err) {}
        }
      }
      return { success: false, error: e.message };
    }
  }
}

// ============================================================
// CapitalAdapter (EXPERT)
// ============================================================
class CapitalAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.apiKey = config.capitalApiKey || config.apiKey;
    this.baseUrl = config.environment === 'live' ? "https://api-capital.backend-capital.com/api/v1" : "https://demo-api-capital.backend-capital.com/api/v1";
  }

  async connect() {
     try {
       const res = await fetch(`${this.baseUrl}/session`, {
         method: "POST",
         headers: { "Content-Type": "application/json", "X-CAP-API-KEY": this.apiKey },
         body: JSON.stringify({ identifier: this.config.identifier, password: this.config.password })
       });
       const data = await res.json();
       this.cst = res.headers.get("CST");
       this.securityToken = res.headers.get("X-SECURITY-TOKEN");
       this.connected = true;
       this.accountInfo = {
         balance: 0, // Will be updated on balance call
         broker: "Capital.com",
         brokerName: "Capital.com",
         currency: "USD"
       };
       return { success: true, accountInfo: this.accountInfo };
     } catch(e) { return { success: false, error: e.message }; }
  }

  async placeOrder(signal, lotSize) {
    await this.connect();
    // No Capital.com, o GOLD muitas vezes é o epic
    const epic = signal.pair.includes("XAU") ? "GOLD" : signal.pair;
    
    try {
      const res = await fetch(`${this.baseUrl}/positions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "X-CAP-API-KEY": this.apiKey,
          "CST": this.cst,
          "X-SECURITY-TOKEN": this.securityToken
        },
        body: JSON.stringify({
          epic, direction: signal.direction, size: lotSize,
          stopLevel: signal.sl, profitLevel: signal.tp,
          guaranteedStop: false, forceOpen: true
        })
      });
      const data = await res.json();
      return { success: !!data.dealReference, orderId: data.dealReference, error: data.errorCode };
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
