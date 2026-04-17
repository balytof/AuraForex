/**
 * ============================================================
 *  SMC FOREX TRADING BOT — AI Studio Integration
 *  Smart Money Concepts + Multi-Indicator Strategy
 *  Version: 2.0.0
 * ============================================================
 *
 *  ESTRATÉGIA PRINCIPAL:
 *  - Smart Money Concepts (SMC): Order Blocks, Fair Value Gaps, BOS/CHoCH
 *  - EMA 50/200 (tendência)
 *  - RSI 14 (momentum + divergência)
 *  - ATR 14 (volatilidade + SL/TP dinâmico)
 *  - MACD (12,26,9) (confirmação de entrada)
 *  - Sessões de mercado (Londres + Nova York)
 *
 *  INTEGRAÇÃO:
 *  Este bot exporta a classe SMCForexBot que pode ser instanciada
 *  e controlada via AI Studio (Google AI Studio).
 * ============================================================
 */

// ──────────────────────────────────────────────
//  CONFIGURAÇÕES GLOBAIS
// ──────────────────────────────────────────────
const BOT_CONFIG = {
  pairs: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPJPY"],
  htf: 240,
  mtf: 60,
  ltf: 15,
  riskPerTrade: 1.5,
  maxOpenTrades: 3,
  maxDailyLoss: 5,
  rrRatio: 2.5,
  ema:  { fast: 50, slow: 200 },
  rsi:  { period: 14, ob: 70, os: 30 },
  macd: { fast: 12, slow: 26, signal: 9 },
  atr:  { period: 14, slMultiplier: 1.8, tpMultiplier: 3.2 },
  bb:   { period: 20, stdDev: 2 },
  sessions: {
    london:  { open: 7,  close: 16 },
    newYork: { open: 12, close: 21 },
  },
};

// ──────────────────────────────────────────────
//  UTILITÁRIOS MATEMÁTICOS
// ──────────────────────────────────────────────
const MathUtils = {
  ema(data, period) {
    const k = 2 / (period + 1);
    let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const result = [val];
    for (let i = period; i < data.length; i++) {
      val = data[i] * k + val * (1 - k);
      result.push(val);
    }
    return result;
  },

  atr(highs, lows, closes, period) {
    const tr = [];
    for (let i = 1; i < closes.length; i++) {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
    }
    const vals = [tr.slice(0, period).reduce((a, b) => a + b) / period];
    for (let i = period; i < tr.length; i++) {
      vals.push((vals[vals.length - 1] * (period - 1) + tr[i]) / period);
    }
    return vals;
  },

  rsi(closes, period) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let ag = gains / period, al = losses / period;
    const vals = [100 - 100 / (1 + ag / (al || 1e-10))];
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * (period - 1) + Math.max(d, 0)) / period;
      al = (al * (period - 1) + Math.max(-d, 0)) / period;
      vals.push(100 - 100 / (1 + ag / (al || 1e-10)));
    }
    return vals;
  },

  macd(closes, fast, slow, signal) {
    const ef = this.ema(closes, fast);
    const es = this.ema(closes, slow);
    const offset = slow - fast;
    const macdLine = ef.slice(offset).map((v, i) => v - es[i]);
    const signalLine = this.ema(macdLine, signal);
    const histogram = macdLine.slice(signal - 1).map((v, i) => v - signalLine[i]);
    return { macdLine, signalLine, histogram };
  },

  bollingerBands(closes, period, std) {
    const bands = [];
    for (let i = period - 1; i < closes.length; i++) {
      const s = closes.slice(i - period + 1, i + 1);
      const mean = s.reduce((a, b) => a + b) / period;
      const variance = s.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
      const sd = Math.sqrt(variance);
      bands.push({ upper: mean + sd * std, middle: mean, lower: mean - sd * std });
    }
    return bands;
  },

  fibonacci(high, low) {
    const d = high - low;
    return {
      r3: high + d * 1.618, r2: high + d * 0.618, r1: high + d * 0.382,
      pivot: (high + low) / 2,
      s1: low - d * 0.382, s2: low - d * 0.618, s3: low - d * 1.618,
    };
  },
};

// ──────────────────────────────────────────────
//  DETECTOR SMC
// ──────────────────────────────────────────────
class SMCDetector {
  static detectOrderBlocks(candles, lookback = 10) {
    const obs = [];
    for (let i = lookback; i < candles.length - 3; i++) {
      const c = candles[i];
      const impulse = candles.slice(i + 1, i + 4);
      if (c.close < c.open) {
        const impUp = impulse.every(ic => ic.close > ic.open);
        const range = impulse.reduce((mx, ic) => Math.max(mx, ic.close - ic.open), 0);
        if (impUp && range > (c.high - c.low) * 1.5) {
          obs.push({ type: "BULLISH_OB", high: c.high, low: c.low, mid: (c.high + c.low) / 2, index: i, strength: range / (c.high - c.low) });
        }
      }
      if (c.close > c.open) {
        const impDn = impulse.every(ic => ic.close < ic.open);
        const range = impulse.reduce((mx, ic) => Math.max(mx, ic.open - ic.close), 0);
        if (impDn && range > (c.high - c.low) * 1.5) {
          obs.push({ type: "BEARISH_OB", high: c.high, low: c.low, mid: (c.high + c.low) / 2, index: i, strength: range / (c.high - c.low) });
        }
      }
    }
    return obs;
  }

  static detectFairValueGaps(candles, minGapPips = 5) {
    const fvgs = [];
    const pip = 0.0001;
    for (let i = 0; i < candles.length - 2; i++) {
      const c1 = candles[i], c3 = candles[i + 2];
      if (c3.low > c1.high && (c3.low - c1.high) / pip >= minGapPips)
        fvgs.push({ type: "BULLISH_FVG", top: c3.low, bottom: c1.high, index: i + 1, gapSize: (c3.low - c1.high) / pip });
      if (c3.high < c1.low && (c1.low - c3.high) / pip >= minGapPips)
        fvgs.push({ type: "BEARISH_FVG", top: c1.low, bottom: c3.high, index: i + 1, gapSize: (c1.low - c3.high) / pip });
    }
    return fvgs;
  }

  static detectStructure(candles, lookback = 20) {
    const swingHighs = [], swingLows = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
      const slice = candles.slice(i - lookback, i + lookback + 1);
      if (candles[i].high === Math.max(...slice.map(c => c.high))) swingHighs.push({ price: candles[i].high, index: i });
      if (candles[i].low === Math.min(...slice.map(c => c.low)))   swingLows.push({ price: candles[i].low,  index: i });
    }
    const structure = [];
    const last = candles[candles.length - 1];
    if (swingHighs.length >= 2 && last.close > swingHighs[swingHighs.length - 2].price)
      structure.push({ type: "BOS_BULLISH", level: swingHighs[swingHighs.length - 2].price, confirmed: true });
    if (swingLows.length >= 2 && last.close < swingLows[swingLows.length - 2].price)
      structure.push({ type: "BOS_BEARISH", level: swingLows[swingLows.length - 2].price, confirmed: true });
    if (swingHighs.length && swingLows.length) {
      const lh = swingHighs[swingHighs.length - 1], ll = swingLows[swingLows.length - 1];
      if (ll.index > lh.index && last.close > lh.price) structure.push({ type: "CHOCH_BULLISH", level: lh.price, confirmed: true });
      if (lh.index > ll.index && last.close < ll.price) structure.push({ type: "CHOCH_BEARISH", level: ll.price, confirmed: true });
    }
    return { structure, swingHighs, swingLows };
  }

  static detectLiquidity(candles, tolerance = 0.0005) {
    const equalHighs = [], equalLows = [];
    for (let i = 0; i < candles.length - 1; i++) {
      for (let j = i + 1; j < candles.length; j++) {
        if (Math.abs(candles[i].high - candles[j].high) <= tolerance)
          equalHighs.push({ level: (candles[i].high + candles[j].high) / 2, indices: [i, j] });
        if (Math.abs(candles[i].low - candles[j].low) <= tolerance)
          equalLows.push({ level: (candles[i].low + candles[j].low) / 2, indices: [i, j] });
      }
    }
    return { equalHighs, equalLows };
  }
}

// ──────────────────────────────────────────────
//  MOTOR DE SINAIS
// ──────────────────────────────────────────────
class SignalEngine {
  constructor(config = BOT_CONFIG) { this.config = config; }

  isActiveSession(utcHour) {
    const { london, newYork } = this.config.sessions;
    return (utcHour >= london.open && utcHour < london.close) ||
           (utcHour >= newYork.open && utcHour < newYork.close);
  }

  calcConfluence(factors) {
    const w = { smcStructure: 25, orderBlock: 20, fvg: 15, emaAlignment: 15, macdConfirm: 10, rsiConfirm: 10, sessionActive: 5 };
    return Object.entries(factors).reduce((s, [k, v]) => s + (v && w[k] ? w[k] : 0), 0);
  }

  generateSignal({ candles, pair, htfBias }) {
    if (!candles || candles.length < 200) return null;
    const closes = candles.map(c => c.close);
    const highs  = candles.map(c => c.high);
    const lows   = candles.map(c => c.low);
    const utcH   = new Date().getUTCHours();

    const emaFast  = MathUtils.ema(closes, this.config.ema.fast);
    const emaSlow  = MathUtils.ema(closes, this.config.ema.slow);
    const rsiVals  = MathUtils.rsi(closes, this.config.rsi.period);
    const atrVals  = MathUtils.atr(highs, lows, closes, this.config.atr.period);
    const macdData = MathUtils.macd(closes, this.config.macd.fast, this.config.macd.slow, this.config.macd.signal);

    const lastEmaFast = emaFast[emaFast.length - 1];
    const lastEmaSlow = emaSlow[emaSlow.length - 1];
    const lastRsi     = rsiVals[rsiVals.length - 1];
    const lastAtr     = atrVals[atrVals.length - 1];
    const lastMacd    = macdData.histogram[macdData.histogram.length - 1];
    const prevMacd    = macdData.histogram[macdData.histogram.length - 2];
    const lastClose   = closes[closes.length - 1];

    const obs = SMCDetector.detectOrderBlocks(candles);
    const fvgs = SMCDetector.detectFairValueGaps(candles);
    const { structure } = SMCDetector.detectStructure(candles);

    // ── LONG
    if (htfBias === "BULLISH" || lastEmaFast > lastEmaSlow) {
      const nearBullOB  = obs.filter(o => o.type === "BULLISH_OB" && lastClose >= o.low && lastClose <= o.high * 1.002);
      const nearBullFVG = fvgs.filter(f => f.type === "BULLISH_FVG" && lastClose >= f.bottom && lastClose <= f.top);
      const bosBull     = structure.some(s => s.type === "BOS_BULLISH" || s.type === "CHOCH_BULLISH");
      if (nearBullOB.length || nearBullFVG.length) {
        const factors = {
          smcStructure: bosBull, orderBlock: nearBullOB.length > 0, fvg: nearBullFVG.length > 0,
          emaAlignment: lastEmaFast > lastEmaSlow, macdConfirm: lastMacd > 0 && lastMacd > prevMacd,
          rsiConfirm: lastRsi > 40 && lastRsi < this.config.rsi.ob, sessionActive: this.isActiveSession(utcH),
        };
        const score = this.calcConfluence(factors);
        if (score >= 55) {
          const sl = lastClose - lastAtr * this.config.atr.slMultiplier;
          const tp = lastClose + lastAtr * this.config.atr.tpMultiplier;
          return { pair, direction: "BUY", score, entry: lastClose, sl, tp, rr: ((tp - lastClose) / (lastClose - sl)).toFixed(2), atr: lastAtr, factors, timestamp: new Date().toISOString() };
        }
      }
    }

    // ── SHORT
    if (htfBias === "BEARISH" || lastEmaFast < lastEmaSlow) {
      const nearBearOB  = obs.filter(o => o.type === "BEARISH_OB" && lastClose <= o.high && lastClose >= o.low * 0.998);
      const nearBearFVG = fvgs.filter(f => f.type === "BEARISH_FVG" && lastClose <= f.top && lastClose >= f.bottom);
      const bosBear     = structure.some(s => s.type === "BOS_BEARISH" || s.type === "CHOCH_BEARISH");
      if (nearBearOB.length || nearBearFVG.length) {
        const factors = {
          smcStructure: bosBear, orderBlock: nearBearOB.length > 0, fvg: nearBearFVG.length > 0,
          emaAlignment: lastEmaFast < lastEmaSlow, macdConfirm: lastMacd < 0 && lastMacd < prevMacd,
          rsiConfirm: lastRsi < 60 && lastRsi > this.config.rsi.os, sessionActive: this.isActiveSession(utcH),
        };
        const score = this.calcConfluence(factors);
        if (score >= 55) {
          const sl = lastClose + lastAtr * this.config.atr.slMultiplier;
          const tp = lastClose - lastAtr * this.config.atr.tpMultiplier;
          return { pair, direction: "SELL", score, entry: lastClose, sl, tp, rr: ((lastClose - tp) / (sl - lastClose)).toFixed(2), atr: lastAtr, factors, timestamp: new Date().toISOString() };
        }
      }
    }

    return null;
  }
}

// ──────────────────────────────────────────────
//  GESTÃO DE RISCO
// ──────────────────────────────────────────────
class RiskManager {
  constructor(config = BOT_CONFIG) {
    this.config = config;
    this.openTrades = [];
    this.dailyPnl = 0;
    this.dailyStartBalance = 0;
  }

  setBalance(b) { this.dailyStartBalance = b; }

  calcPositionSize(balance, entry, sl, pair) {
    const riskAmount = balance * (this.config.riskPerTrade / 100);
    const pipValue   = pair.includes("JPY") ? 0.01 : 0.0001;
    const slPips     = Math.abs(entry - sl) / pipValue;
    return Math.min(Math.max(parseFloat((riskAmount / (slPips * 10)).toFixed(2)), 0.01), 5.00);
  }

  canOpenTrade(balance) {
    if (this.openTrades.length >= this.config.maxOpenTrades)
      return { allowed: false, reason: `Máx. ${this.config.maxOpenTrades} trades simultâneos` };
    const lossPct = ((this.dailyStartBalance - balance) / this.dailyStartBalance) * 100;
    if (lossPct >= this.config.maxDailyLoss)
      return { allowed: false, reason: `Perda diária máxima de ${this.config.maxDailyLoss}% atingida` };
    return { allowed: true };
  }

  updateTrailingStop(trade, currentPrice, atr) {
    const mult = 1.5;
    if (trade.direction === "BUY") {
      const newSl = currentPrice - atr * mult;
      if (newSl > trade.sl) { trade.sl = parseFloat(newSl.toFixed(5)); return true; }
    } else {
      const newSl = currentPrice + atr * mult;
      if (newSl < trade.sl) { trade.sl = parseFloat(newSl.toFixed(5)); return true; }
    }
    return false;
  }

  registerTrade(trade) { this.openTrades.push({ ...trade, id: `T${Date.now()}`, status: "OPEN" }); }

  closeTrade(tradeId, closePrice) {
    const idx = this.openTrades.findIndex(t => t.id === tradeId);
    if (idx === -1) return null;
    const trade = this.openTrades[idx];
    const pip = trade.pair.includes("JPY") ? 0.01 : 0.0001;
    const pnlPips = trade.direction === "BUY" ? (closePrice - trade.entry) / pip : (trade.entry - closePrice) / pip;
    const pnl = pnlPips * 10 * (trade.lotSize || 0.1);
    this.dailyPnl += pnl;
    this.openTrades.splice(idx, 1);
    return { ...trade, closePrice, pnl, status: "CLOSED", closedAt: new Date().toISOString() };
  }
}

// ──────────────────────────────────────────────
//  CLASSE PRINCIPAL
// ──────────────────────────────────────────────
class SMCForexBot {
  constructor(config = BOT_CONFIG) {
    this.config   = config;
    this.engine   = new SignalEngine(config);
    this.risk     = new RiskManager(config);
    this.tradeLog = [];
    this.isRunning = false;
    this.balance  = 10000;
    this.onSignal = null;
    this.onTrade  = null;
    this.onLog    = null;
  }

  log(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}`;
    console.log(entry);
    if (this.onLog) this.onLog(entry);
  }

  init(accountBalance) {
    this.balance = accountBalance;
    this.risk.setBalance(accountBalance);
    this.log(`Bot SMC iniciado | Saldo: $${accountBalance} | Pares: ${this.config.pairs.join(", ")}`);
  }

  analyze(pair, candles, htfBias = "NEUTRAL") {
    const signal = this.engine.generateSignal({ candles, pair, htfBias });
    if (!signal) { this.log(`${pair} — Sem confluência suficiente.`); return null; }

    this.log(`SINAL ${signal.direction} ${pair} | Score: ${signal.score}/100 | R:R ${signal.rr}`);
    const perm = this.risk.canOpenTrade(this.balance);
    if (!perm.allowed) { this.log(`Trade bloqueado: ${perm.reason}`); return null; }

    const lotSize = this.risk.calcPositionSize(this.balance, signal.entry, signal.sl, pair);
    const enriched = { ...signal, lotSize };
    this.risk.registerTrade(enriched);
    this.tradeLog.push({ type: "SIGNAL", data: enriched });
    if (this.onSignal) this.onSignal(enriched);
    return enriched;
  }

  updateTrades(pair, currentPrice, atr) {
    for (const trade of this.risk.openTrades.filter(t => t.pair === pair)) {
      const tpHit = trade.direction === "BUY" ? currentPrice >= trade.tp : currentPrice <= trade.tp;
      const slHit = trade.direction === "BUY" ? currentPrice <= trade.sl : currentPrice >= trade.sl;
      if (tpHit) {
        const r = this.risk.closeTrade(trade.id, trade.tp);
        this.log(`TP atingido | ${pair} | PnL: +$${r.pnl.toFixed(2)}`);
        if (this.onTrade) this.onTrade(r);
      } else if (slHit) {
        const r = this.risk.closeTrade(trade.id, trade.sl);
        this.log(`SL atingido | ${pair} | PnL: -$${Math.abs(r.pnl).toFixed(2)}`);
        if (this.onTrade) this.onTrade(r);
      } else {
        const moved = this.risk.updateTrailingStop(trade, currentPrice, atr);
        if (moved) this.log(`Trailing Stop atualizado | ${pair} | Novo SL: ${trade.sl}`);
      }
    }
  }

  getStats() {
    const closed = this.tradeLog.filter(t => t.type === "TRADE" && t.data?.status === "CLOSED");
    const wins   = closed.filter(t => t.data.pnl > 0).length;
    return {
      balance: this.balance,
      openTrades: this.risk.openTrades.length,
      totalTrades: closed.length,
      winRate: closed.length ? ((wins / closed.length) * 100).toFixed(1) + "%" : "N/A",
      dailyPnl: this.risk.dailyPnl.toFixed(2),
      pairs: this.config.pairs,
    };
  }

  stop() { this.isRunning = false; this.log("Bot parado."); }
}

// ──────────────────────────────────────────────
//  INTEGRAÇÃO AI STUDIO (Google AI Studio)
// ──────────────────────────────────────────────
class AIStudioIntegration {
  /**
   * Analisa sentimento/bias de mercado usando Gemini
   * @param {string} pair
   * @param {Object} marketData - dados de contexto HTF
   * @param {string} apiKey - Gemini API Key
   */
  static async analyzeSentimentWithAI(pair, marketData, apiKey) {
    const prompt = `
Você é um analista SMC (Smart Money Concepts) especialista em forex.
Analise os dados de mercado para ${pair} e responda SOMENTE em JSON sem formatação markdown.
Formato exato: {"bias":"BULLISH","confidence":85,"reasoning":"Texto explicativo"}

Dados de mercado:
${JSON.stringify(marketData, null, 2)}
    `.trim();

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("AIStudio error:", e);
      return { bias: "NEUTRAL", confidence: 0, reasoning: "Erro na análise AI" };
    }
  }

  /**
   * Loop principal — combina Gemini AI com lógica SMC
   * @param {SMCForexBot} bot
   * @param {Function} getMarketData - async (pair) => { candles, currentPrice, atr, htfSummary }
   * @param {string} aiApiKey
   * @param {number} intervalMs
   */
  static async runWithAI(bot, getMarketData, aiApiKey, intervalMs = 60000) {
    bot.log("Modo AI Studio ativado");
    bot.isRunning = true;

    const loop = async () => {
      if (!bot.isRunning) return;
      for (const pair of bot.config.pairs) {
        try {
          const { candles, currentPrice, atr, htfSummary } = await getMarketData(pair);
          const ai = await AIStudioIntegration.analyzeSentimentWithAI(pair, htfSummary, aiApiKey);
          bot.log(`AI Bias ${pair}: ${ai.bias} (${ai.confidence}%) — ${ai.reasoning}`);
          bot.analyze(pair, candles, ai.bias);
          bot.updateTrades(pair, currentPrice, atr);
        } catch (e) {
          bot.log(`Erro ao processar ${pair}: ${e.message}`);
        }
      }
      setTimeout(loop, intervalMs);
    };

    loop();
  }
}

// ──────────────────────────────────────────────
//  EXPORTAÇÃO (Node.js / ES Modules)
// ──────────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SMCForexBot,
    SMCDetector,
    SignalEngine,
    RiskManager,
    MathUtils,
    AIStudioIntegration,
    BOT_CONFIG,
  };
}

// ──────────────────────────────────────────────
//  EXEMPLO DE USO
// ──────────────────────────────────────────────
/*

const { SMCForexBot, AIStudioIntegration } = require("./smc_forex_bot.js");

const bot = new SMCForexBot();
bot.init(10000);

bot.onSignal = (signal) => {
  console.log("NOVO SINAL:", signal);
  // Envia sinal para a UI do AI Studio
};

bot.onTrade = (result) => {
  console.log("TRADE FECHADO:", result);
};

bot.onLog = (msg) => {
  // Mostra log na interface do AI Studio
  appendToLogPanel(msg);
};

// Conecta com Google AI Studio (Gemini)
AIStudioIntegration.runWithAI(
  bot,
  async (pair) => {
    // Substitua por sua fonte de dados real (ex: MT5, OANDA, Binance)
    return await fetchMarketData(pair);
  },
  "SUA_GEMINI_API_KEY",
  60000 // Analisa a cada 60 segundos
);

*/
