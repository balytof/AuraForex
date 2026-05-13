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
    this.circuitBreaker = false;  // true = bot parado por perda diária
    this.lastStateSave = 0;       // Throttle para gravação em disco
    
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
    if (isXau) pipValue = 1; // Para XAUUSD 0.01 lot = $1 por 10 pips (1.0 USD/pt em standard)

    let lot = riskAmount / (slPips * pipValue);
    
    // Limite de segurança institucional: Máximo 0.10 para evitar overexposure em contas pequenas
    const finalLot = Math.max(0.01, Math.min(lot, 0.10)); 
    return Number(finalLot.toFixed(2));
  }

  validateMargin({ freeMargin, lot, pair, leverage = 500 }) {
    const isXau = pair.includes("XAU") || pair.includes("GOLD");
    const contractSize = isXau ? 100 : 100000;
    const requiredMargin = (contractSize * lot) / leverage;
    return { valid: freeMargin >= requiredMargin };
  }

  // ── REGISTAR TRADE ABERTO ─────────────────────────────
    const trade = {
      id: `T-${Date.now()}`,
      brokerId: String(brokerId),
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
    this._safeSaveState();
    return trade;
  }

  // ── FECHAR TRADE ─────────────────────────────────────
  closeTrade(tradeId, closePrice, reason = "MANUAL", pnl = 0) {
    const idx = this.openTrades.findIndex(t => t.id === tradeId || t.brokerId === String(tradeId));
    if (idx === -1) return null;

    const trade = this.openTrades[idx];
    const closed = {
      ...trade,
      closePrice,
      pnl: Number(pnl) || 0,
      closeReason: reason,
      closedAt: new Date().toISOString(),
      status: "CLOSED",
    };

    // Actualizar Circuit Breaker
    this.dailyPnl += closed.pnl;
    if (this.dailyStartBalance > 0) {
        const lossLimit = this.dailyStartBalance * (cfg.maxDailyLossPct / 100);
        if (this.dailyPnl <= -lossLimit) {
            this.circuitBreaker = true;
            log.warn(`[CIRCUIT-BREAKER] Atingido limite de perda diária ($${this.dailyPnl.toFixed(2)})`);
        }
    }

    this.openTrades.splice(idx, 1);
    this.tradeHistory.push(closed);
    
    // Limitar histórico para evitar leak de memória (Max 5000 trades)
    if (this.tradeHistory.length > 5000) {
        this.tradeHistory = this.tradeHistory.slice(-5000);
    }

    this._saveHistory();
    this._safeSaveState();
    return closed;
  }

  // ── PROFIT PROTECTION (LOCK) ── Usando Lucro REAL do Broker
  checkProfitProtection(trade, currentProfit) {
    // 🔼 Atualizar pico
    if (currentProfit > (trade.peakProfit || 0)) {
      trade.peakProfit = currentProfit;
      this._safeSaveState(); 
    }

    const isXau = trade.pair.toUpperCase().includes("XAU") || trade.pair.toUpperCase().includes("GOLD");
    const minProfitToActivate = isXau ? 15 : 3;   
    
    // Drawdown Dinâmico: Quanto maior o lucro, menos permitimos devolver
    let drawdown = 0.35; // 35% inicial
    if (trade.peakProfit > 50)  drawdown = 0.25;
    if (trade.peakProfit > 100) drawdown = 0.15;
    if (trade.peakProfit > 500) drawdown = 0.10;

    if (trade.peakProfit >= minProfitToActivate) {
      const minAllowed = trade.peakProfit * (1 - drawdown);
      
      if (currentProfit <= minAllowed) {
        return {
          shouldClose: true,
          reason: `PROFIT_LOCK | Lucro: $${currentProfit.toFixed(2)} | Queda do Pico ($${trade.peakProfit.toFixed(2)}) > ${(drawdown*100).toFixed(0)}%`
        };
      }
    }
    return { shouldClose: false };
  }

  // ── MONITOR DE TRADES ABERTOS ─────────────────────────
  // ── MONITOR DE TRADES ABERTOS (Lógica de Individualização por Ticket) ──
  checkOpenTrades(pair, brokerPositions = []) {
    const toClose = [];
    const normalize = (p) => {
        if (!p) return "";
        // Sanitização cirúrgica: remove sufixos de broker (.m, .raw, _ecn) sem quebrar o par principal
        return p.toUpperCase().replace(/(\.m|\.raw|_ecn|\.i|\.pro)$/i, "").replace(/[^A-Z0-9]/g, "");
    };
    
    const normalizedTargetPair = normalize(pair);

    // Filtrar apenas trades que pertencem a este par no nosso estado interno
    const myTradesForPair = this.openTrades.filter(t => normalize(t.pair) === normalizedTargetPair);

    for (const trade of myTradesForPair) {
      // Encontrar a posição REAL do broker que corresponde a este ticket
      const realPosition = brokerPositions.find(p => String(p.ticket || p.brokerId) === String(trade.brokerId));
      
      if (!realPosition) {
        log.warn(`[RISK] Trade ${trade.brokerId} (${trade.pair}) não encontrado nas posições atuais do broker.`);
        continue;
      }

      const currentProfit = Number(realPosition.profit);
      const currentPrice = Number(realPosition.price || realPosition.currentPrice);

      const protection = this.checkProfitProtection(trade, currentProfit);
      if (protection.shouldClose) {
        toClose.push({ 
            trade, 
            closePrice: currentPrice, 
            reason: protection.reason,
            pnl: currentProfit 
        });
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

  _safeSaveState() {
    const now = Date.now();
    // Throttle de 5 segundos para proteger o disco e performance da VPS
    if (now - this.lastStateSave < 5000) return;
    this.lastStateSave = now;
    this._saveState();
  }

  _saveState() {
    try {
      const logDir = path.dirname(this.stateFile);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      
      const state = {
        openTrades: this.openTrades,
        dailyPnl: this.dailyPnl,
        dailyStartBalance: this.dailyStartBalance,
        balance: this.balance,
        circuitBreaker: this.circuitBreaker,
        lastUpdate: new Date().toISOString()
      };
      
      // Gravação síncrona dentro do throttle é segura e evita race conditions simples
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      log.error(`[RISK-SAVE-ERROR] Falha ao salvar estado: ${e.message}`);
    }
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
