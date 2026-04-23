/**
 * ============================================================
 *  MetaApi Broker Adapter
 *  Conecta a contas MetaTrader 4/5 via MetaApi Cloud
 *  https://metaapi.cloud
 * ============================================================
 */

const BrokerAdapter = require("./base");
const fetch = require("node-fetch");

const METAAPI_BASE = "https://mt-client-api-v1.agiliumtrade.ai";
const METAAPI_PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.ai";

const TF_MAP = {
  M1: "1m", M5: "5m", M15: "15m", M30: "30m",
  H1: "1h", H4: "4h", D1: "1d", W1: "1w", MN: "1mn",
};

class MetaApiAdapter extends BrokerAdapter {
  constructor() {
    super("MetaTrader", "metaapi");
    this.metaApiToken = "";
    this.mtAccountId = "";
    this.region = "vint-hill";
  }

  async connect(credentials) {
    try {
      const { metaApiToken, accountId } = credentials;
      console.log("[DEBUG] MetaApi Token Length:", metaApiToken ? metaApiToken.length : 0);
      console.log("[DEBUG] MetaApi Token Start:", metaApiToken ? metaApiToken.substring(0, 5) : "none");
      console.log("[DEBUG] MetaApi Account ID:", accountId);
      if (!metaApiToken || !accountId) {
        return { success: false, error: "MetaApi Token e Account ID são obrigatórios" };
      }

      this.metaApiToken = metaApiToken;
      this.mtAccountId = accountId;

      // 1. Verificar a conta no MetaApi
      const accInfo = await this._provisioningRequest(`/users/current/accounts/${this.mtAccountId}`);

      if (!accInfo || accInfo.error) {
        return { success: false, error: accInfo?.message || "Conta MetaApi não encontrada. Verifique o Account ID." };
      }

      this.region = accInfo.region || "vint-hill";

      // 2. Verificar se a conta está deployed
      if (accInfo.state !== "DEPLOYED") {
        // Tentar fazer deploy
        try {
          await this._provisioningRequest(`/users/current/accounts/${this.mtAccountId}/deploy`, "POST");
          // Esperar um pouco para o deploy completar
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
          // Ignorar se já está deployed
        }
      }

      // 3. Obter dados da conta de trading
      const accountData = await this._tradingRequest("/account-information");

      if (!accountData || accountData.error) {
        return { success: false, error: accountData?.message || "Não foi possível obter dados da conta MT. A conta pode estar desconectada." };
      }

      this.accountInfo = {
        accountId: this.mtAccountId,
        balance: accountData.balance || 0,
        equity: accountData.equity || accountData.balance || 0,
        currency: accountData.currency || "USD",
        accountType: accInfo.type === "cloud" ? "CLOUD" : (accountData.leverage > 0 ? "LIVE" : "DEMO"),
        broker: `MetaTrader (${accInfo.platform || "MT5"})`,
        platform: accInfo.platform || "mt5",
        unrealizedPL: (accountData.equity || 0) - (accountData.balance || 0),
        leverage: accountData.leverage || 0,
        server: accInfo.server || "",
      };

      this.connected = true;
      this.credentials = { accountId };

      return { success: true, accountInfo: this.accountInfo };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getAccountInfo() {
    this._requireConnection();
    const data = await this._tradingRequest("/account-information");
    this.accountInfo = {
      ...this.accountInfo,
      balance: data.balance || 0,
      equity: data.equity || data.balance || 0,
      unrealizedPL: (data.equity || 0) - (data.balance || 0),
    };
    return this.accountInfo;
  }

  async getOpenPositions() {
    this._requireConnection();
    const data = await this._tradingRequest("/positions");
    return (Array.isArray(data) ? data : []).map(p => ({
      id: p.id,
      pair: this.normalizePair(p.symbol),
      direction: p.type === "POSITION_TYPE_BUY" ? "BUY" : "SELL",
      lotSize: p.volume || 0,
      openPrice: p.openPrice || 0,
      sl: p.stopLoss || null,
      tp: p.takeProfit || null,
      pnl: p.profit || 0,
      openTime: p.time,
      magic: p.magic || 0,
      comment: p.comment || "",
    }));
  }

  async placeOrder(order) {
    this._requireConnection();
    const { pair, direction, lotSize, sl, tp } = order;

    const body = {
      symbol: this.formatPair(pair),
      actionType: direction === "BUY" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL",
      volume: lotSize,
      comment: "AuraForex SMC Bot",
      magic: 202604,
    };

    if (sl) body.stopLoss = sl;
    if (tp) body.takeProfit = tp;

    try {
      const result = await this._tradingRequest("/trade", "POST", body);
      if (result.numericCode === 10009 || result.stringCode === "TRADE_RETCODE_DONE") {
        return {
          success: true,
          orderId: result.orderId || result.positionId || "",
          fillPrice: result.openPrice || 0,
        };
      }
      return {
        success: false,
        error: result.message || result.stringCode || "Ordem rejeitada pelo MetaTrader",
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async closePosition(positionId) {
    this._requireConnection();
    try {
      // Primeiro, obter a posição para saber os detalhes
      const positions = await this.getOpenPositions();
      const pos = positions.find(p => p.id === positionId);
      if (!pos) return { success: false, error: "Posição não encontrada" };

      const body = {
        actionType: pos.direction === "BUY" ? "ORDER_TYPE_SELL" : "ORDER_TYPE_BUY",
        symbol: this.formatPair(pos.pair),
        volume: pos.lotSize,
        positionId: positionId,
        comment: "AuraForex Close",
      };

      const result = await this._tradingRequest("/trade", "POST", body);
      if (result.numericCode === 10009 || result.stringCode === "TRADE_RETCODE_DONE") {
        return {
          success: true,
          pnl: pos.pnl,
          closePrice: result.openPrice || 0,
        };
      }
      return { success: false, error: result.message || "Erro ao fechar posição" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getHistory(filters = {}) {
    this._requireConnection();
    // Últimos 30 dias por omissão
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    try {
      const data = await this._tradingRequest(`/history-deals/time/${start.toISOString()}/${end.toISOString()}`);
      
      let history = (Array.isArray(data) ? data : [])
        .filter(d => d.type === "DEAL_TYPE_BUY" || d.type === "DEAL_TYPE_SELL")
        .filter(d => d.entryType === "DEAL_ENTRY_OUT" || typeof d.entryType === "undefined") // Pega os fechos ou MT4 standard
        .map(d => {
          return {
            id: d.id,
            pair: this.normalizePair(d.symbol || "Unknown"),
            direction: d.type === "DEAL_TYPE_BUY" ? "BUY" : "SELL",
            lotSize: d.volume || 0,
            openPrice: 0,
            closePrice: d.price || 0,
            openTime: d.time,
            closeTime: d.time,
            pnl: parseFloat(d.profit || 0),
            broker: "MetaTrader"
          };
        });

      history.sort((a,b) => new Date(b.closeTime) - new Date(a.closeTime));
      return history;
    } catch(e) {
      console.error("Erro MetaApi getHistory:", e);
      return [];
    }
  }

  async getCandles(pair, timeframe = "H1", count = 250) {
    this._requireConnection();
    const symbol = this.formatPair(pair);
    const tf = TF_MAP[timeframe] || "1h";
    const data = await this._tradingRequest(
      `/historic-market-data/symbols/${encodeURIComponent(symbol)}/timeframes/${tf}/candles?limit=${count}`
    );
    return (Array.isArray(data) ? data : []).map(c => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.tickVolume || c.volume || 0,
      time: c.time,
    }));
  }

  async getPrice(pair) {
    this._requireConnection();
    const symbol = this.formatPair(pair);
    const data = await this._tradingRequest(
      `/symbols/${encodeURIComponent(symbol)}/current-price`
    );
    if (!data) return null;
    return {
      bid: data.bid || 0,
      ask: data.ask || 0,
      spread: (data.ask || 0) - (data.bid || 0),
    };
  }

  formatPair(pair) {
    // MetaTrader usa formato do broker, geralmente EURUSD direto
    return pair.toUpperCase();
  }

  normalizePair(brokerPair) {
    // Removes suffixes like EURUSDm, EURUSD.raw, etc.
    return brokerPair.replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 6);
  }

  _requireConnection() {
    if (!this.connected) throw new Error("MetaTrader não está conectada");
  }

  async _provisioningRequest(endpoint, method = "GET", body = null) {
    const opts = {
      method,
      headers: {
        "auth-token": this.metaApiToken,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${METAAPI_PROVISIONING}${endpoint}`, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MetaApi Provisioning ${res.status}: ${err}`);
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async _tradingRequest(endpoint, method = "GET", body = null) {
    const baseUrl = `https://mt-client-api-v1.${this.region}.agiliumtrade.ai`;
    const opts = {
      method,
      headers: {
        "auth-token": this.metaApiToken,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const url = `${baseUrl}/users/current/accounts/${this.mtAccountId}${endpoint}`;
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MetaApi Trading ${res.status}: ${err}`);
    }
    if (res.status === 204) return {};
    return res.json();
  }
}

module.exports = MetaApiAdapter;
