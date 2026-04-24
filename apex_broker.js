// ============================================================
// APEX SMC — Production Multi-Broker Layer
// broker.js + BrokerBase.js + OandaAdapter.js + MetaApiAdapter.js + CapitalAdapter.js
// 100% production-ready base structure with Backwards Compatibility
// ============================================================

const https = require('https');
const fetch = require('node-fetch'); // Required for MetaApi and Capital.com raw REST
const MetaApi = require('metaapi.cloud-sdk');

// ============================================================
// BrokerBase.js
// ============================================================
class BrokerBase {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this.accountInfo = null;
  }

  async connect() {
    throw new Error('connect() must be implemented');
  }

  async getBalance() {
    throw new Error('getBalance() must be implemented');
  }

  async placeOrder(signal, lotSize) {
    throw new Error('placeOrder() must be implemented');
  }

  async closePosition(positionId, pair) {
    throw new Error('closePosition() must be implemented');
  }

  async modifySL(positionId, newSl) {
    throw new Error('modifySL() must be implemented');
  }

  async getHistory() { return []; }

  async getCandles() { return []; }

  async getPrice() { return { bid: 0, ask: 0, spread: 0 }; }

  async getOpenPositions() {
    throw new Error('getOpenPositions() must be implemented');
  }

  // --- COMPATIBILITY LAYER ---
  async getStatus() {
    return {
      connected: this.connected,
      accountInfo: this.accountInfo || null
    };
  }

  async getAccountInfo() {
    if (this.connected) {
      try {
        const balance = await this.getBalance();
        if (this.accountInfo) {
          this.accountInfo.balance = balance;
          this.accountInfo.equity = balance;
        }
      } catch (e) {
        // ignore
      }
    }
    return this.accountInfo;
  }

  async disconnect() {
    this.connected = false;
    this.accountInfo = null;
    return { success: true };
  }
}

// ============================================================
// Helpers
// ============================================================
function safeJsonParse(data) {
  try {
    return JSON.parse(data || '{}');
  } catch (e) {
    throw new Error(`Invalid JSON response: ${data}`);
  }
}

function validateSignal(signal) {
  if (!signal) throw new Error('Signal is required');
  if (!signal.pair) throw new Error('signal.pair is required');
  if (!signal.direction) throw new Error('signal.direction is required');
  if (typeof signal.sl !== 'number') throw new Error('signal.sl must be number');
  if (typeof signal.tp !== 'number') throw new Error('signal.tp must be number');
}

// ============================================================
// OandaAdapter.js
// ============================================================
class OandaAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.name = "OANDA";
    this.type = "oanda";

    this.accountId = config.oandaAccountId || config.accountId;
    this.apiKey = config.oandaApiKey || config.apiToken || config.apiKey;
    this.environment = config.environment || 'demo';
    this.baseUrl = this.environment === 'live'
      ? 'api-fxtrade.oanda.com'
      : 'api-fxpractice.oanda.com';

    if (!this.accountId) throw new Error('Missing OANDA accountId');
    if (!this.apiKey) throw new Error('Missing OANDA apiKey');
  }

  request(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
      const bodyStr = body ? JSON.stringify(body) : null;

      const options = {
        hostname: this.baseUrl,
        path: endpoint,
        method,
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(bodyStr
            ? { 'Content-Length': Buffer.byteLength(bodyStr) }
            : {})
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const parsed = safeJsonParse(data);

          if (res.statusCode >= 400) {
            return reject(
              new Error(`OANDA ${res.statusCode}: ${JSON.stringify(parsed)}`)
            );
          }

          resolve(parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OANDA request timeout'));
      });

      req.on('error', reject);

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  async connect() {
    try {
      const res = await this.request('GET', `/v3/accounts/${this.accountId}/summary`);
      const bal = parseFloat(res.account?.balance || 0);
      
      this.connected = true;
      this.accountInfo = {
        accountId: this.accountId,
        balance: bal,
        equity: parseFloat(res.account?.NAV || bal),
        currency: res.account?.currency || "USD",
        accountType: this.environment === "live" ? "LIVE" : "DEMO",
        broker: "OANDA",
        unrealizedPL: parseFloat(res.account?.unrealizedPL || 0)
      };

      return {
        success: true,
        provider: 'oanda',
        connected: true,
        balance: bal,
        accountInfo: this.accountInfo
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getBalance() {
    const res = await this.request('GET', `/v3/accounts/${this.accountId}/summary`);
    return parseFloat(res.account?.balance || 0);
  }

  async placeOrder(signal, lotSize) {
    validateSignal(signal);

    const units = signal.direction === 'BUY'
      ? Math.round(lotSize * 100000)
      : -Math.round(lotSize * 100000);

    try {
      const res = await this.request('POST', `/v3/accounts/${this.accountId}/orders`, {
        order: {
          type: 'MARKET',
          instrument: signal.pair.replace(/([A-Z]{3})([A-Z]{3})/, "$1_$2"),
          units: String(units),
          timeInForce: 'FOK',
          positionFill: 'DEFAULT',
          stopLossOnFill: {
            price: signal.sl.toFixed(5),
            timeInForce: 'GTC'
          },
          takeProfitOnFill: {
            price: signal.tp.toFixed(5),
            timeInForce: 'GTC'
          }
        }
      });
      return {
        success: true,
        orderId: res.orderCreateTransaction?.id || res.orderFillTransaction?.orderId,
        fillPrice: res.orderFillTransaction?.price || 0
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async closePosition(positionId) {
    try {
      await this.request('PUT', `/v3/accounts/${this.accountId}/trades/${positionId}/close`);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async modifySL(positionId, newSl) {
    try {
      await this.request('PUT', `/v3/accounts/${this.accountId}/trades/${positionId}/orders`, {
        stopLoss: {
          price: Number(newSl).toFixed(5),
          timeInForce: 'GTC'
        }
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getOpenPositions() {
    const res = await this.request('GET', `/v3/accounts/${this.accountId}/openTrades`);
    return (res.trades || []).map(t => ({
      id: t.id,
      pair: t.instrument?.replace("_", ""),
      direction: Number(t.currentUnits) > 0 ? "BUY" : "SELL",
      lotSize: Math.abs(Number(t.currentUnits)) / 100000,
      openPrice: Number(t.price),
      sl: t.stopLossOrder ? Number(t.stopLossOrder.price) : null,
      tp: t.takeProfitOrder ? Number(t.takeProfitOrder.price) : null,
      pnl: Number(t.unrealizedPL),
      openTime: t.openTime
    }));
  }
}

// ============================================================
// MetaApiAdapter.js
// ============================================================
class MetaApiAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.name = "MetaTrader";
    this.type = "metaapi";

    this.token = config.metaApiToken || config.apiToken;
    this.accountId = config.metaApiAccountId || config.accountId;

    if (!this.token) throw new Error('Missing MetaApi token');
    if (!this.accountId) throw new Error('Missing MetaApi accountId');

    this.api = new MetaApi(this.token);
    this.account = null;
    this.connection = null;
  }

  async connect() {
    try {
      this.account = await this.api.metatraderAccountApi.getAccount(this.accountId);

      const initialState = this.account.state;
      const deployedStates = ['DEPLOYING', 'DEPLOYED'];

      if (!deployedStates.includes(initialState)) {
        await this.account.deploy();
      }

      await this.account.waitConnected();

      this.connection = this.account.getRPCConnection();
      await this.connection.connect();
      await this.connection.waitSynchronized();

      const accountInfo = await this.connection.getAccountInformation();

      this.connected = true;
      this.accountInfo = {
        accountId: this.accountId,
        balance: accountInfo.balance || 0,
        equity: accountInfo.equity || accountInfo.balance || 0,
        currency: accountInfo.currency || "USD",
        accountType: accountInfo.leverage > 0 ? "LIVE" : "DEMO",
        broker: `MetaTrader`,
        platform: "MT4/MT5",
        unrealizedPL: (accountInfo.equity || 0) - (accountInfo.balance || 0),
        leverage: accountInfo.leverage || 0,
      };

      return {
        success: true,
        provider: 'metaapi',
        connected: true,
        accountId: this.accountId,
        balance: accountInfo.balance,
        accountInfo: this.accountInfo
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async ensureConnection() {
    if (!this.connection) {
      const res = await this.connect();
      if (!res.success) throw new Error(res.error);
    }
  }

  async getBalance() {
    await this.ensureConnection();
    const info = await this.connection.getAccountInformation();
    return Number(info.balance || 0);
  }

  async placeOrder(signal, lotSize) {
    validateSignal(signal);
    await this.ensureConnection();

    const volume = Number(lotSize);

    try {
      let res;
      if (signal.direction === 'BUY') {
        res = await this.connection.createMarketBuyOrder(
          signal.pair,
          volume,
          signal.sl,
          signal.tp,
          { comment: 'APEX SMC BUY' }
        );
      } else {
        res = await this.connection.createMarketSellOrder(
          signal.pair,
          volume,
          signal.sl,
          signal.tp,
          { comment: 'APEX SMC SELL' }
        );
      }
      return {
        success: true,
        orderId: res.orderId || res.positionId,
        fillPrice: res.price || 0
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async closePosition(positionId) {
    await this.ensureConnection();
    try {
      await this.connection.closePosition(positionId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async modifySL(positionId, newSl) {
    await this.ensureConnection();
    try {
      await this.connection.modifyPosition(positionId, {
        stopLoss: Number(newSl)
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getOpenPositions() {
    await this.ensureConnection();
    const positions = await this.connection.getPositions();
    return (positions || []).map(p => ({
      id: p.id,
      pair: p.symbol,
      direction: p.type === "POSITION_TYPE_BUY" ? "BUY" : "SELL",
      lotSize: p.volume || 0,
      openPrice: p.openPrice || 0,
      sl: p.stopLoss || null,
      tp: p.takeProfit || null,
      pnl: p.profit || 0,
      openTime: p.time
    }));
  }
}

// ============================================================
// CapitalAdapter.js (Ported for APEX SMC)
// ============================================================
const CAPITAL_URLS = {
  demo: "https://demo-api-capital.backend-capital.com/api/v1",
  live: "https://api-capital.backend-capital.com/api/v1",
};

class CapitalAdapter extends BrokerBase {
  constructor(config) {
    super(config);
    this.name = "Capital.com";
    this.type = "capital";

    this.apiKey = config.capitalApiKey || config.apiKey;
    this.identifier = config.capitalIdentifier || config.identifier;
    this.password = config.capitalPassword || config.password;
    this.environment = config.environment || "demo";
    
    this.baseUrl = CAPITAL_URLS[this.environment];
    this.cst = "";
    this.securityToken = "";
    
    if (!this.apiKey || !this.identifier || !this.password) {
      throw new Error("Missing Capital.com credentials (apiKey, identifier, password)");
    }
  }

  _headers() {
    return {
      "X-CAP-API-KEY": this.apiKey,
      "CST": this.cst,
      "X-SECURITY-TOKEN": this.securityToken,
      "Content-Type": "application/json",
    };
  }

  async _request(endpoint, method = "GET", body = null) {
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${this.baseUrl}${endpoint}`, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Capital.com API Error (${res.status}): ${err}`);
    }
    return res.json();
  }

  async connect() {
    try {
      const sessionRes = await fetch(`${this.baseUrl}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CAP-API-KEY": this.apiKey,
        },
        body: JSON.stringify({ identifier: this.identifier, password: this.password, encryptedPassword: false }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.text();
        return { success: false, error: `Autenticação falhou (${sessionRes.status}): ${err}` };
      }

      this.cst = sessionRes.headers.get("CST") || "";
      this.securityToken = sessionRes.headers.get("X-SECURITY-TOKEN") || "";

      if (!this.cst || !this.securityToken) {
        return { success: false, error: "Tokens de sessão não recebidos." };
      }

      const accounts = await this._request("/accounts");
      const acc = accounts.accounts?.[0];
      if (!acc) return { success: false, error: "Nenhuma conta encontrada" };

      this.connected = true;
      this.accountInfo = {
        accountId: acc.accountId,
        balance: acc.balance?.balance || 0,
        equity: acc.balance?.equity || acc.balance?.balance || 0,
        currency: acc.currency,
        accountType: this.environment === "live" ? "LIVE" : "DEMO",
        broker: "Capital.com",
        unrealizedPL: acc.balance?.profitLoss || 0,
      };

      return {
        success: true,
        provider: 'capital',
        connected: true,
        balance: this.accountInfo.balance,
        accountInfo: this.accountInfo
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async disconnect() {
    if (this.connected && this.cst) {
      try {
        await fetch(`${this.baseUrl}/session`, {
          method: "DELETE",
          headers: this._headers(),
        });
      } catch (e) {}
    }
    this.cst = "";
    this.securityToken = "";
    return super.disconnect();
  }

  async getBalance() {
    if (!this.connected) throw new Error("Not connected");
    const accounts = await this._request("/accounts");
    return parseFloat(accounts.accounts?.[0]?.balance?.balance || 0);
  }

  async placeOrder(signal, lotSize) {
    validateSignal(signal);
    if (!this.connected) throw new Error("Not connected");

    const body = {
      epic: signal.pair.replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 6),
      direction: signal.direction.toUpperCase(),
      size: Number(lotSize),
      guaranteedStop: false,
      forceOpen: true,
    };
    if (signal.sl) body.stopLevel = signal.sl;
    if (signal.tp) body.profitLevel = signal.tp;

    try {
      const result = await this._request("/positions", "POST", body);
      if (result.dealReference) {
        const confirm = await this._request(`/confirms/${result.dealReference}`);
        return {
          success: confirm.dealStatus === "ACCEPTED",
          orderId: confirm.dealId || result.dealReference,
          fillPrice: confirm.level || 0,
          error: confirm.dealStatus !== "ACCEPTED" ? confirm.reason : null,
        };
      }
      return { success: false, error: "Deal reference não recebido" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async closePosition(positionId) {
    if (!this.connected) throw new Error("Not connected");
    try {
      const result = await this._request(`/positions/${positionId}`, "DELETE");
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async modifySL(positionId, newSl) {
    // Capital REST API requires modifying the working order or closing and reopening.
    // For simplicity we will throw an error as this is complex in Capital's API.
    throw new Error('modifySL not implemented natively for Capital.com API in this version');
  }

  async getOpenPositions() {
    if (!this.connected) throw new Error("Not connected");
    const data = await this._request("/positions");
    return (data.positions || []).map(p => ({
      id: p.position?.dealId,
      pair: p.market?.epic?.replace(/[^A-Z]/g, "") || "",
      direction: p.position?.direction === "BUY" ? "BUY" : "SELL",
      lotSize: p.position?.size || 0,
      openPrice: p.position?.openLevel || 0,
      sl: p.position?.stopLevel || null,
      tp: p.position?.profitLevel || null,
      pnl: p.position?.profit || 0,
      openTime: p.position?.createdDateUTC,
    }));
  }
}

// ============================================================
// broker.js (Factory)
// ============================================================
function createBroker(config) {
  const provider = String(config.provider || config.brokerType || '').toLowerCase();

  switch (provider) {
    case 'oanda':
      return new OandaAdapter(config);

    case 'metaapi':
      return new MetaApiAdapter(config);
      
    case 'capital':
      return new CapitalAdapter(config);

    default:
      throw new Error(`Unsupported broker provider: ${provider}`);
  }
}

module.exports = {
  BrokerBase,
  OandaAdapter,
  MetaApiAdapter,
  CapitalAdapter,
  createBroker
};
