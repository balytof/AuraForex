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
const log    = require("../utils/logger");
const fs     = require("fs");
const path   = require("path");

const cfg = config.risk;

class RiskManager {
  constructor() {
    this.openTrades        = [];     // trades atualmente abertos
    this.tradeHistory      = [];     // todos os trades fechados
    this.balance           = 0;
    this.dailyStartBalance = 0;
    this.dailyPnl          = 0;
    this.dailyDate         = null;
    this.circuitBreaker    = false;  // true = bot parado por perda diária
    this.historyFile       = path.join(__dirname, "../logs/trade_history.json");
    this.stateFile         = path.join(__dirname, "../logs/bot_state.json");
    this._loadHistory();
    this._loadState();
  }

  // ── INICIALIZAÇÃO ─────────────────────────────────────
  setBalance(balance) {
    this.balance = balance;
    const today  = new Date().toDateString();
    if (this.dailyDate !== today) {
      this.dailyDate         = today;
      this.dailyStartBalance = balance;
      this.dailyPnl          = 0;
      this.circuitBreaker    = false;
      log.info(`Novo dia de trading | Saldo: $${balance.toFixed(2)}`);
    }
  }

  // ── VERIFICAÇÃO DE PERMISSÃO ──────────────────────────
  canOpenTrade(pair) {
    if (this.circuitBreaker) {
      return { allowed: false, reason: `Circuit breaker ativo — perda diária ≥ ${cfg.maxDailyLossPct}%` };
    }

    if (this.openTrades.length >= cfg.maxOpenTrades) {
      return { allowed: false, reason: `Máx. ${cfg.maxOpenTrades} trades simultâneos atingido (${this.openTrades.length} abertos)` };
    }

    const alreadyOpen = this.openTrades.find(t => t.pair === pair);
    if (alreadyOpen) {
      return { allowed: false, reason: `Já existe trade aberto em ${pair}` };
    }

    const lossPct = this.dailyStartBalance > 0
      ? ((this.dailyStartBalance - this.balance) / this.dailyStartBalance) * 100
      : 0;

    if (lossPct >= cfg.maxDailyLossPct) {
      this.circuitBreaker = true;
      log.warn(`🚨 CIRCUIT BREAKER ativado — perda diária: ${lossPct.toFixed(2)}%`);
      return { allowed: false, reason: `Perda diária máxima de ${cfg.maxDailyLossPct}% atingida` };
    }

    return { allowed: true };
  }

  // ── CÁLCULO DE TAMANHO DE POSIÇÃO ─────────────────────
  /**
   * Calcula lotes baseado em risco fixo (% do saldo)
   * Fórmula: Lotes = (Saldo × Risco%) ÷ (Pips de SL × PipValue)
   */
  calcLotSize(balance, entry, sl, pair) {
    const riskAmount = balance * (cfg.riskPerTradePct / 100);
    const isJpy      = pair.includes("JPY");
    const isXau      = pair.includes("XAU");
    const pipSize    = isJpy ? 0.01 : isXau ? 0.1 : 0.0001;
    const slPips     = Math.abs(entry - sl) / pipSize;

    if (slPips === 0) return 0.01;

    const lots = riskAmount / (slPips * cfg.pipValueUSD);
    return Math.min(Math.max(parseFloat(lots.toFixed(2)), 0.01), 10.0);
  }

  // ── REGISTAR TRADE ABERTO ─────────────────────────────
  registerTrade(signal, lotSize, brokerId = null) {
    const trade = {
      id:        `T-${Date.now()}`,
      brokerId,                      // ID do trade no broker (OANDA)
      pair:      signal.pair,
      direction: signal.direction,
      entry:     signal.entry,
      sl:        signal.sl,
      slOriginal: signal.sl,
      tp:        signal.tp,
      lotSize,
      score:     signal.score,
      rr:        signal.rr,
      openedAt:  new Date().toISOString(),
      status:    "OPEN",
      peakProfit: 0, // Expert: Rastreia o lucro máximo atingido em %
    };
    this.openTrades.push(trade);
    log.info(`Trade registado: ${trade.id} | ${trade.direction} ${trade.pair} | ${lotSize} lotes`);
    this._saveState();
    return trade;
  }

  // ── FECHAR TRADE ─────────────────────────────────────
  closeTrade(tradeId, closePrice, reason = "MANUAL") {
    const idx = this.openTrades.findIndex(t => t.id === tradeId);
    if (idx === -1) { log.warn(`Trade ${tradeId} não encontrado`); return null; }

    const trade    = this.openTrades[idx];
    const isJpy    = trade.pair.includes("JPY");
    const isXau    = trade.pair.includes("XAU");
    const pipSize  = isJpy ? 0.01 : isXau ? 0.1 : 0.0001;
    const pnlPips  = trade.direction === "BUY"
      ? (closePrice - trade.entry) / pipSize
      : (trade.entry - closePrice) / pipSize;
    const pnl      = pnlPips * cfg.pipValueUSD * trade.lotSize;

    const closed = {
      ...trade,
      closePrice,
      closeReason: reason,
      pnlPips:     parseFloat(pnlPips.toFixed(1)),
      pnl:         parseFloat(pnl.toFixed(2)),
      closedAt:    new Date().toISOString(),
      status:      "CLOSED",
    };

    this.openTrades.splice(idx, 1);
    this.tradeHistory.push(closed);
    this.dailyPnl  += pnl;
    this.balance   += pnl;

    log.trade(closed);
    this._saveHistory();
    this._saveState();
    return closed;
  }

  // ── TRAILING STOP ─────────────────────────────────────
  /**
   * Atualiza o SL se o preço avançou > 1.5× ATR a favor.
   * @returns {boolean} true se o SL foi movido
   */
  updateTrailingStop(trade, currentPrice, atr) {
    const mult    = cfg.trailingAtrMult;
    let   moved   = false;

    if (trade.direction === "BUY") {
      const newSl = parseFloat((currentPrice - atr * mult).toFixed(5));
      if (newSl > trade.sl) {
        trade.sl = newSl;
        moved    = true;
      }
    } else {
      const newSl = parseFloat((currentPrice + atr * mult).toFixed(5));
      if (newSl < trade.sl) {
        trade.sl = newSl;
        moved    = true;
      }
    }

    if (moved) {
      log.debug(`Trailing SL atualizado | ${trade.pair} ${trade.direction} | Novo SL: ${trade.sl}`);
      this._saveState();
    }
    return moved;
  }

  // ── MONITOR DE TRADES ABERTOS ─────────────────────────
  /**
   * Verifica se TP ou SL foi atingido para cada trade aberto.
   * Retorna lista de trades para fechar.
   */
  checkOpenTrades(pair, currentPrice, atr) {
    const toClose = [];

    for (const trade of this.openTrades.filter(t => t.pair === pair)) {
      const tpHit = trade.direction === "BUY"
        ? currentPrice >= trade.tp
        : currentPrice <= trade.tp;

      const slHit = trade.direction === "BUY"
        ? currentPrice <= trade.sl
        : currentPrice >= trade.sl;

      // 3. Expert Profit Protection Logic (Preservação de Lucro)
      const isJpy    = trade.pair.includes("JPY");
      const isXau    = trade.pair.includes("XAU");
      const pipSize  = isJpy ? 0.01 : isXau ? 0.1 : 0.0001;
      const pnlPips  = trade.direction === "BUY"
        ? (currentPrice - trade.entry) / pipSize
        : (trade.entry - currentPrice) / pipSize;
      const currentPnL = pnlPips * cfg.pipValueUSD * trade.lotSize;
      const profitPct  = (currentPnL / this.dailyStartBalance) * 100;

      // Atualizar o pico de lucro
      if (profitPct > (trade.peakProfit || 0)) {
        trade.peakProfit = profitPct;
      }

      // Gatilho: Se o lucro foi > 1.1% e agora caiu para <= 1.0%, fechar para proteger
      const protectionActive = (trade.peakProfit || 0) > 1.1;
      const profitDroppingBelowSafety = protectionActive && profitPct <= 1.0;

      if (tpHit) {
        toClose.push({ trade, closePrice: trade.tp, reason: "TP" });
      } else if (slHit) {
        toClose.push({ trade, closePrice: trade.sl, reason: "SL" });
      } else if (profitDroppingBelowSafety) {
        toClose.push({ trade, closePrice: currentPrice, reason: "PROFIT_PROTECTION_1%" });
      } else {
        this.updateTrailingStop(trade, currentPrice, atr);
      }
    }

    return toClose;
  }

  // ── ESTATÍSTICAS ─────────────────────────────────────
  getStats() {
    const closed = this.tradeHistory;
    const wins   = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl <= 0);
    const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);

    return {
      balance:         parseFloat(this.balance.toFixed(2)),
      dailyPnl:        parseFloat(this.dailyPnl.toFixed(2)),
      openTrades:      this.openTrades.length,
      totalTrades:     closed.length,
      wins:            wins.length,
      losses:          losses.length,
      winRate:         closed.length ? ((wins.length / closed.length) * 100).toFixed(1) + "%" : "N/A",
      totalPnl:        parseFloat(totalPnl.toFixed(2)),
      avgWin:          wins.length   ? parseFloat((wins.reduce((s,t)   => s + t.pnl, 0) / wins.length).toFixed(2))   : 0,
      avgLoss:         losses.length ? parseFloat((losses.reduce((s,t) => s + t.pnl, 0) / losses.length).toFixed(2)) : 0,
      circuitBreaker:  this.circuitBreaker,
    };
  }

  // ── PERSISTÊNCIA ─────────────────────────────────────
  _saveHistory() {
    try {
      if (!fs.existsSync(path.dirname(this.historyFile))) {
        fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      }
      fs.writeFileSync(this.historyFile, JSON.stringify(this.tradeHistory, null, 2));
    } catch (e) { /* ignora erro de escrita */ }
  }

  _loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        this.tradeHistory = JSON.parse(fs.readFileSync(this.historyFile, "utf8"));
        log.info(`Histórico carregado: ${this.tradeHistory.length} trades`);
      }
    } catch (e) { this.tradeHistory = []; }
  }

  _saveState() {
    try {
      if (!fs.existsSync(path.dirname(this.stateFile))) {
        fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      }
      const state = {
        openTrades: this.openTrades,
        dailyPnl: this.dailyPnl,
        dailyStartBalance: this.dailyStartBalance,
        balance: this.balance
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) { /* ignora erro de escrita */ }
  }

  _loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const state = JSON.parse(fs.readFileSync(this.stateFile, "utf8"));
        this.openTrades = state.openTrades || [];
        this.dailyPnl = state.dailyPnl || 0;
        this.dailyStartBalance = state.dailyStartBalance || 0;
        this.balance = state.balance || this.balance;
        log.info(`Estado carregado: ${this.openTrades.length} trades abertos`);
      }
    } catch (e) { this.openTrades = []; }
  }
}

module.exports = new RiskManager();
