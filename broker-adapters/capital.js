/**
 * ============================================================
 *  Capital.com Broker Adapter
 *  Conecta à Capital.com REST API
 * ============================================================
 */

const BrokerAdapter = require("./base");
const fetch = require("node-fetch");

const CAPITAL_URLS = {
  demo: "https://demo-api-capital.backend-capital.com/api/v1",
  live: "https://api-capital.backend-capital.com/api/v1",
};

const TF_MAP = {
  M1: "MINUTE", M5: "MINUTE_5", M15: "MINUTE_15", M30: "MINUTE_30",
  H1: "HOUR", H4: "HOUR_4", D1: "DAY", W1: "WEEK",
};

class CapitalAdapter extends BrokerAdapter {
  constructor() {
    super("Capital.com", "capital");
    this.baseUrl = "";
    this.cst = "";
    this.securityToken = "";
    this.apiKey = "";
  }

  async connect(credentials) {
    try {
      const { apiKey, identifier, password, environment } = credentials;
      if (!apiKey || !identifier || !password) {
        return { success: false, error: "API Key, Email e Password são obrigatórios" };
      }

      this.baseUrl = CAPITAL_URLS[environment || "demo"];
      this.apiKey = apiKey;

      // Autenticar — criar sessão
      const sessionRes = await fetch(`${this.baseUrl}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CAP-API-KEY": apiKey,
        },
        body: JSON.stringify({ identifier, password, encryptedPassword: false }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.text();
        return { success: false, error: `Autenticação falhou (${sessionRes.status}): ${err}` };
      }

      this.cst = sessionRes.headers.get("CST") || "";
      this.securityToken = sessionRes.headers.get("X-SECURITY-TOKEN") || "";

      if (!this.cst || !this.securityToken) {
        return { success: false, error: "Tokens de sessão não recebidos. Verifique suas credenciais." };
      }

      // Obter contas
      const accounts = await this._request("/accounts");
      const acc = accounts.accounts?.[0];
      if (!acc) {
        return { success: false, error: "Nenhuma conta encontrada" };
      }

      this.accountInfo = {
        accountId: acc.accountId,
        balance: acc.balance?.balance || 0,
        equity: acc.balance?.equity || acc.balance?.balance || 0,
        currency: acc.currency,
        accountType: environment === "live" ? "LIVE" : "DEMO",
        broker: "Capital.com",
        unrealizedPL: acc.balance?.profitLoss || 0,
      };

      this.connected = true;
      this.credentials = { environment };

      return { success: true, accountInfo: this.accountInfo };
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
      } catch (e) { /* ignorar erros ao desconectar */ }
    }
    this.cst = "";
    this.securityToken = "";
    await super.disconnect();
  }

  async getAccountInfo() {
    this._requireConnection();
    const accounts = await this._request("/accounts");
    const acc = accounts.accounts?.[0];
    if (acc) {
      this.accountInfo = {
        ...this.accountInfo,
        balance: acc.balance?.balance || 0,
        equity: acc.balance?.equity || acc.balance?.balance || 0,
        unrealizedPL: acc.balance?.profitLoss || 0,
      };
    }
    return this.accountInfo;
  }

  async getOpenPositions() {
    this._requireConnection();
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

  async placeOrder(order) {
    this._requireConnection();
    const { pair, direction, lotSize, sl, tp } = order;

    const body = {
      epic: this.formatPair(pair),
      direction: direction.toUpperCase(),
      size: lotSize,
      guaranteedStop: false,
      forceOpen: true,
    };

    if (sl) body.stopLevel = sl;
    if (tp) body.profitLevel = tp;

    try {
      const result = await this._request("/positions", "POST", body);
      if (result.dealReference) {
        // Confirmar o deal
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
    this._requireConnection();
    try {
      const result = await this._request(`/positions/${positionId}`, "DELETE");
      if (result.dealReference) {
        const confirm = await this._request(`/confirms/${result.dealReference}`);
        return {
          success: confirm.dealStatus === "ACCEPTED",
          pnl: confirm.profit || 0,
          closePrice: confirm.level || 0,
        };
      }
      return { success: false, error: "Não foi possível fechar a posição" };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getHistory(filters = {}) {
    this._requireConnection();
    // Limite de tempo: últimos 30 dias por defeito
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    // Capital.com usa formato YYYY-MM-DDTHH:MM:SS (truncando os ms e o Z)
    const formatTime = (d) => d.toISOString().split(".")[0];
    
    try {
      // Pedir a "/history/activity"
      const data = await this._request(`/history/activity?detailed=true&from=${formatTime(start)}&to=${formatTime(end)}`);
      
      // Filtrar apenas fechos de posições ("POSITION" origin com dealStatus "ACCEPTED")
      const history = (data.activities || [])
        .filter(a => a.status === "ACCEPTED" && a.details && a.details.dealReference)
        .filter(a => a.details.direction === "BUY" || a.details.direction === "SELL")
        .map(a => {
          return {
            id: a.dealId || a.details.dealReference,
            pair: this.normalizePair(a.epic || ""),
            direction: a.details.direction,
            lotSize: a.details.size || 0,
            openPrice: 0,
            closePrice: a.details.level || 0,
            openTime: a.date,
            closeTime: a.date,
            pnl: parseFloat(a.details.profit || 0),
            broker: "Capital.com"
          };
        });
        
      history.sort((a,b) => new Date(b.closeTime) - new Date(a.closeTime));
      return history;
    } catch(e) {
      console.error("Capital getHistory Error:", e);
      return [];
    }
  }

  async getCandles(pair, timeframe = "H1", count = 250) {
    this._requireConnection();
    const epic = this.formatPair(pair);
    const resolution = TF_MAP[timeframe] || "HOUR";
    const data = await this._request(
      `/prices/${epic}?resolution=${resolution}&max=${count}`
    );
    return (data.prices || []).map(c => ({
      open: (c.openPrice?.bid + c.openPrice?.ask) / 2 || c.openPrice?.bid,
      high: (c.highPrice?.bid + c.highPrice?.ask) / 2 || c.highPrice?.bid,
      low: (c.lowPrice?.bid + c.lowPrice?.ask) / 2 || c.lowPrice?.bid,
      close: (c.closePrice?.bid + c.closePrice?.ask) / 2 || c.closePrice?.bid,
      volume: c.lastTradedVolume || 0,
      time: c.snapshotTimeUTC,
    }));
  }

  async getPrice(pair) {
    this._requireConnection();
    const epic = this.formatPair(pair);
    const data = await this._request(`/markets/${epic}`);
    const snap = data.snapshot;
    if (!snap) return null;
    return {
      bid: snap.bid,
      ask: snap.offer,
      spread: snap.offer - snap.bid,
    };
  }

  formatPair(pair) {
    // Capital.com usa epics como "EURUSD" diretamente para forex
    return pair.toUpperCase();
  }

  normalizePair(brokerPair) {
    return brokerPair.replace(/[^A-Z]/g, "");
  }

  _headers() {
    return {
      "Content-Type": "application/json",
      "X-CAP-API-KEY": this.apiKey,
      "CST": this.cst,
      "X-SECURITY-TOKEN": this.securityToken,
    };
  }

  _requireConnection() {
    if (!this.connected) throw new Error("Capital.com não está conectada");
  }

  async _request(endpoint, method = "GET", body = null) {
    const opts = {
      method,
      headers: this._headers(),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${endpoint}`, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Capital.com API ${res.status}: ${err}`);
    }
    return res.json();
  }
}

module.exports = CapitalAdapter;
