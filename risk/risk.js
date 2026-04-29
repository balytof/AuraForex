/*
 *  APEX SMC — risk/risk.js
 *  Gestão de risco completa:
 *    - Tamanho de posição dinâmico (risco fixo % do saldo)
 *    - Limite de trades simultâneos
 *    - Limite de perda diária (circuit breaker)
 *    - Trailing Stop automático
 *    - Registo de trades abertos e histórico
 * ============================================================
 */

const config = require("../config/config");
const log = require("../utils/logger");
const fs = require("fs");
const path = require("path");

const cfg = config.risk;

class RiskManager {
  constructor(userId = "default") {
    this.userId = userId;
    this.openTrades = [];     // trades atualmente abertos
    this.tradeHistory = [];     // todos os trades fechados
    this.balance = 0;
    this.dailyStartBalance = 0;
    this.dailyPnl = 0;
    this.dailyDate = null;
    this.circuitBreaker = false;  // true = bot parado por perda diária
    
    // Pasta de logs por utilizador
    const logDir = path.join(__dirname, "../logs/users", userId);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.historyFile = path.join(logDir, "trade_history.json");
    this.stateFile = path.join(logDir, "bot_state.json");
    
    log.info(`[RISK-INIT] [User: ${userId}] Inicializando Gestor de Risco.`);
    this._loadHistory();
    this._loadState();
  }

  // ── INICIALIZAÇÃO ─────────────────────────────────────
  setBalance(balance) {
    this.balance = balance;
    const today = new Date().toDateString();
    if (this.dailyDate !== today) {
      this.dailyDate = today;
      this.dailyStartBalance = balance;
      this.dailyPnl = 0;
      this.circuitBreaker = false;
      log.info(`[RISK-NEW-DAY] Novo dia de trading | Saldo: $${balance.toFixed(2)}`);
    }
  }

  // ── VERIFICAÇÃO DE PERMISSÃO ──────────────────────────
  canOpenTrade(pair) {
    if (this.circuitBreaker) {
      return { allowed: false, reason: `Circuit breaker ativo — perda diária ≥ ${cfg.maxDailyLossPct}%` };
    }
    if (this.balance < 50) return { allowed: false, reason: "Saldo muito baixo para operar (< 50)" };
    if (this.openTrades.length >= cfg.maxOpenTrades) {
      return { allowed: false, reason: `Máx. ${cfg.maxOpenTrades} trades simultâneos atingido` };
    }
    return { allowed: true };
  }

  // ── CÁLCULO DE TAMANHO DE POSIÇÃO ─────────────────────
  calcLotSizeSafe({ balance, freeMargin, entry, sl, pair, leverage = 500 }) {
    const riskAmount = balance * (cfg.riskPerTradePct / 100);
    const distance = Math.abs(entry - sl);
    if (distance === 0) return 0.01;

    const isJpy = pair.includes("JPY");
    const isXau = pair.includes("XAU") || pair.includes("GOLD");
    const pipSize = isJpy ? 0.01 : isXau ? 0.1 : 0.0001;

    const slPips = distance / pipSize;
    if (slPips <= 0) return 0.01;

    let pipValue = 10; 
    if (isJpy) pipValue = 7;
    if (isXau) pipValue = 1;

    let lot = riskAmount / (slPips * pipValue);
    const finalLot = Math.max(0.01, Math.min(lot, 0.10)); // Limite de segurança 0.10
    return Number(finalLot.toFixed(2));
  }

  validateMargin({ freeMargin, lot, pair, leverage = 500 }) {
    const isXau = pair.includes("XAU") || pair.includes("GOLD");
    const contractSize = isXau ? 100 : 100000;
    const requiredMargin = (contractSize * lot) / leverage;
    return { valid: freeMargin >= requiredMargin };
  }

  // ── REGISTAR TRADE ABERTO ─────────────────────────────
  registerTrade(signal, lotSize, brokerId = null) {
    const trade = {
      id: `T-${Date.now()}`,
      brokerId,
      pair: signal.pair,
      direction: signal.direction,
      entry: signal.entry,
      sl: signal.sl,
      tp: signal.tp,
      lotSize,
      openedAt: new Date().toISOString(),
      status: "OPEN",
      peakProfit: 0, 
    };
    this.openTrades.push(trade);
    this._saveState();
    return trade;
  }

  // ── FECHAR TRADE ─────────────────────────────────────
  closeTrade(tradeId, closePrice, reason = "MANUAL") {
    const idx = this.openTrades.findIndex(t => t.id === tradeId || t.brokerId === tradeId);
    if (idx === -1) return null;

    const trade = this.openTrades[idx];
    const closed = {
      ...trade,
      closePrice,
      closeReason: reason,
      closedAt: new Date().toISOString(),
      status: "CLOSED",
    };

    this.openTrades.splice(idx, 1);
    this.tradeHistory.push(closed);
    this._saveHistory();
    this._saveState();
    return closed;
  }

  // ── PROFIT PROTECTION (LOCK) ── Usando Lucro REAL do Broker
  checkProfitProtection(trade, currentProfit) {
    // 🔼 atualizar pico
    if (currentProfit > (trade.peakProfit || 0)) {
      trade.peakProfit = currentProfit;
      this._saveState(); 
    }

    const minProfitToActivate = 3;   
    const drawdown = 0.30; // 30%

    if (trade.peakProfit >= minProfitToActivate) {
      const minAllowed = trade.peakProfit * (1 - drawdown);
      
      // LOG DE ALTA VISIBILIDADE NO TERMINAL
      console.log(`[VIGIA] ${trade.pair} | Lucro: $${currentProfit.toFixed(2)} | Pico: $${trade.peakProfit.toFixed(2)} | Gatilho: $${minAllowed.toFixed(2)}`);

      if (currentProfit <= minAllowed) {
        return {
          shouldClose: true,
          reason: `PROFIT_LOCK ${currentProfit.toFixed(2)}$ < ${minAllowed.toFixed(2)}$`
        };
      }
    }
    return { shouldClose: false };
  }

  // ── MONITOR DE TRADES ABERTOS ─────────────────────────
  checkOpenTrades(pair, currentPrice, currentProfit, atr) {
    const toClose = [];
    const normalize = (p) => p.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().replace("W", "");
    const normalizedPair = normalize(pair);

    const tradesForThisPair = this.openTrades.filter(t => normalize(t.pair).includes(normalizedPair) || normalizedPair.includes(normalize(t.pair)));

    for (const trade of tradesForThisPair) {
      const protection = this.checkProfitProtection(trade, currentProfit);
      if (protection.shouldClose) {
        toClose.push({ trade, closePrice: currentPrice, reason: protection.reason });
      }
    }
    return toClose;
  }

  // ── PERSISTÊNCIA ─────────────────────────────────────
  _saveHistory() {
    try {
      if (!fs.existsSync(path.dirname(this.historyFile))) fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      fs.writeFileSync(this.historyFile, JSON.stringify(this.tradeHistory, null, 2));
    } catch (e) {}
  }

  _loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        this.tradeHistory = JSON.parse(fs.readFileSync(this.historyFile, "utf8"));
      }
    } catch (e) { this.tradeHistory = []; }
  }

  _saveState() {
    try {
      if (!fs.existsSync(path.dirname(this.stateFile))) fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const state = {
        openTrades: this.openTrades,
        dailyPnl: this.dailyPnl,
        dailyStartBalance: this.dailyStartBalance,
        balance: this.balance
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {}
  }

  _loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const state = JSON.parse(fs.readFileSync(this.stateFile, "utf8"));
        this.openTrades = state.openTrades || [];
        this.dailyPnl = state.dailyPnl || 0;
        this.dailyStartBalance = state.dailyStartBalance || 0;
        this.balance = state.balance || 0;
      }
    } catch (e) { this.openTrades = []; }
  }
}

module.exports = RiskManager;
