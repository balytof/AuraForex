/**
 * ============================================================
 *  OANDA Broker Adapter
 *  Conecta à OANDA v20 REST API
 * ============================================================
 */

const BrokerAdapter = require("./base");
const fetch = require("node-fetch");

const OANDA_URLS = {
  demo: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
};

// Mapeamento de timeframes
const TF_MAP = {
  M1: "M1", M5: "M5", M15: "M15", M30: "M30",
  H1: "H1", H4: "H4", D1: "D", W1: "W", MN: "M",
};

class OandaAdapter extends BrokerAdapter {
  constructor() {
    super("OANDA", "oanda");
    this.baseUrl = "";
    this.token = "";
    this.accountId = "";
  }

  async connect(credentials) {
    try {
      const { apiToken, accountId, environment } = credentials;
      if (!apiToken || !accountId) {
        return { success: false, error: "API Token e Account ID são obrigatórios" };
      }

      this.token = apiToken;
      this.accountId = accountId;
      this.baseUrl = OANDA_URLS[environment || "demo"];

      // Testar conexão obtendo dados da conta
      const info = await this._request(`/v3/accounts/${this.accountId}/summary`);
      if (!info || !info.account) {
        return { success: false, error: "Não foi possível obter dados da conta. Verifique suas credenciais." };
      }

      const acc = info.account;
      this.accountInfo = {
        accountId: acc.id,
        balance: parseFloat(acc.balance),
        equity: parseFloat(acc.NAV || acc.balance),
        currency: acc.currency,
        accountType: environment === "live" ? "LIVE" : "DEMO",
        broker: "OANDA",
        openTradeCount: acc.openTradeCount || 0,
        unrealizedPL: parseFloat(acc.unrealizedPL || 0),
      };

      this.connected = true;
      this.credentials = { environment, accountId };

      return { success: true, accountInfo: this.accountInfo };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getAccountInfo() {
    this._requireConnection();
    const info = await this._request(`/v3/accounts/${this.accountId}/summary`);
    const acc = info.account;
    this.accountInfo = {
      ...this.accountInfo,
      balance: parseFloat(acc.balance),
      equity: parseFloat(acc.NAV || acc.balance),
      openTradeCount: acc.openTradeCount || 0,
      unrealizedPL: parseFloat(acc.unrealizedPL || 0),
    };
    return this.accountInfo;
  }

  async getOpenPositions() {
    this._requireConnection();
    const data = await this._request(`/v3/accounts/${this.accountId}/trades`);
    return (data.trades || []).map(t => ({
      id: t.id,
      pair: this.normalizePair(t.instrument),
      direction: parseFloat(t.currentUnits) > 0 ? "BUY" : "SELL",
      lotSize: Math.abs(parseFloat(t.currentUnits)) / 100000,
      openPrice: parseFloat(t.price),
      sl: t.stopLossOrder ? parseFloat(t.stopLossOrder.price) : null,
      tp: t.takeProfitOrder ? parseFloat(t.takeProfitOrder.price) : null,
      pnl: parseFloat(t.unrealizedPL || 0),
      openTime: t.openTime,
    }));
  }

  async placeOrder(order) {
    this._requireConnection();
    const { pair, direction, lotSize, sl, tp } = order;
    const instrument = this.formatPair(pair);
    const units = direction === "BUY"
      ? Math.round(lotSize * 100000)
      : -Math.round(lotSize * 100000);

    const body = {
      order: {
        type: "MARKET",
        instrument,
        units: String(units),
        timeInForce: "FOK",
        positionFill: "DEFAULT",
      },
    };

    if (sl) {
      body.order.stopLossOnFill = {
        price: this._formatPrice(sl, pair),
        timeInForce: "GTC",
      };
    }
    if (tp) {
      body.order.takeProfitOnFill = {
        price: this._formatPrice(tp, pair),
        timeInForce: "GTC",
      };
    }

    const result = await this._request(`/v3/accounts/${this.accountId}/orders`, "POST", body);

    if (result.orderFillTransaction) {
      return {
        success: true,
        orderId: result.orderFillTransaction.tradeOpened?.tradeID || result.orderFillTransaction.id,
        fillPrice: parseFloat(result.orderFillTransaction.price),
      };
    }

    if (result.orderCancelTransaction) {
      return { success: false, error: result.orderCancelTransaction.reason };
    }

    return { success: false, error: "Resposta inesperada da OANDA" };
  }

  async closePosition(positionId) {
    this._requireConnection();
    const result = await this._request(
      `/v3/accounts/${this.accountId}/trades/${positionId}/close`,
      "PUT",
      { units: "ALL" }
    );

    if (result.orderFillTransaction) {
      return {
        success: true,
        pnl: parseFloat(result.orderFillTransaction.pl || 0),
        closePrice: parseFloat(result.orderFillTransaction.price),
      };
    }
    return { success: false, error: "Não foi possível fechar a posição" };
  }

  async getHistory(filters = {}) {
    this._requireConnection();
    // Puxa as últimas 100 negociações fechadas (OANDA usa o endpoint de trades fechados)
    const data = await this._request(`/v3/accounts/${this.accountId}/trades?state=CLOSED&count=100`);
    
    let history = (data.trades || []).map(t => {
      const isBuy = parseFloat(t.initialUnits) > 0;
      return {
        id: t.id,
        pair: this.normalizePair(t.instrument),
        direction: isBuy ? "BUY" : "SELL",
        lotSize: Math.abs(parseFloat(t.initialUnits)) / 100000,
        openPrice: parseFloat(t.price),
        closePrice: parseFloat(t.averageClosePrice || t.price),
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: parseFloat(t.realizedPL || 0),
        broker: "OANDA"
      };
    });

    // Sort por default (mais recente primeiro)
    history.sort((a,b) => new Date(b.closeTime) - new Date(a.closeTime));
    return history;
  }

  async getCandles(pair, timeframe = "H1", count = 250) {
    this._requireConnection();
    const instrument = this.formatPair(pair);
    const granularity = TF_MAP[timeframe] || "H1";
    const data = await this._request(
      `/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=M`
    );
    return (data.candles || [])
      .filter(c => c.complete)
      .map(c => ({
        open: parseFloat(c.mid.o),
        high: parseFloat(c.mid.h),
        low: parseFloat(c.mid.l),
        close: parseFloat(c.mid.c),
        volume: c.volume,
        time: c.time,
      }));
  }

  async getPrice(pair) {
    this._requireConnection();
    const instrument = this.formatPair(pair);
    const data = await this._request(
      `/v3/accounts/${this.accountId}/pricing?instruments=${instrument}`
    );
    const p = data.prices?.[0];
    if (!p) return null;
    const bid = parseFloat(p.bids?.[0]?.price || 0);
    const ask = parseFloat(p.asks?.[0]?.price || 0);
    return { bid, ask, spread: ask - bid };
  }

  formatPair(pair) {
    // EURUSD → EUR_USD
    if (pair.length === 6 && !pair.includes("_")) {
      return pair.slice(0, 3) + "_" + pair.slice(3);
    }
    // Handle XAU, XAG etc.
    if (pair.startsWith("XAU") || pair.startsWith("XAG")) {
      return pair.slice(0, 3) + "_" + pair.slice(3);
    }
    return pair;
  }

  normalizePair(brokerPair) {
    return brokerPair.replace("_", "");
  }

  _formatPrice(price, pair) {
    const isJpy = pair.includes("JPY");
    const isXau = pair.includes("XAU");
    const decimals = isJpy ? 3 : isXau ? 2 : 5;
    return price.toFixed(decimals);
  }

  _requireConnection() {
    if (!this.connected) throw new Error("OANDA não está conectada");
  }

  async _request(endpoint, method = "GET", body = null) {
    const opts = {
      method,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Accept-Datetime-Format": "RFC3339",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${endpoint}`, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OANDA API ${res.status}: ${err}`);
    }
    return res.json();
  }
}

module.exports = OandaAdapter;
