// ============================================================
// APEX SMC — SIGNAL ENGINE PRO (REAL SAFE)
// ============================================================

const config = require("../config/config");
const { calcAll } = require("../indicators/indicators");
const { analyzeAll } = require("../smc/smc");

function getPrecision(price) {
  if (price > 1000) return 1;
  if (price > 100) return 2;
  if (price > 10) return 3;
  return 5;
}

function normalizePrice(price) {
  const p = getPrecision(price);
  return parseFloat(price.toFixed(p));
}

function safeRR(entry, sl, tp) {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk <= 0) return 0;
  return reward / risk;
}

function isValidATR(atr, price) {
  return atr > 0 && atr < price * 0.1;
}

const recentSignals = new Map();

function isDuplicate(pair, direction) {
  const key = `${pair}-${direction}`;
  const now = Date.now();
  const last = recentSignals.get(key);

  if (last && now - last < 30000) return true;

  recentSignals.set(key, now);
  return false;
}

function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  if (!candles || candles.length < 210) return { signal: null, reason: "Velas insuficientes (<210)" };

  try {
    const ind = calcAll(candles);
    const { last } = ind;

    if (!last || !last.atr || !last.emaFast || !last.emaSlow) return { signal: null, reason: "Indicadores em falta" };
    if (!isValidATR(last.atr, last.close)) return { signal: null, reason: "ATR inválido" };

    const smc = analyzeAll(candles);

    // ================= BUY =================
    if ((htfBias === "BULLISH" || last.emaFast > last.emaSlow)) {

      if (isDuplicate(pair, "BUY")) return { signal: null, reason: "Sinal duplicado (BUY)" };

      let sl = last.close - last.atr * 1.5;
      let tp = last.close + last.atr * 3;

      sl = normalizePrice(sl);
      tp = normalizePrice(tp);

      const rr = safeRR(last.close, sl, tp);
      const minRR = config.risk ? config.risk.minRR : 1.5;
      if (rr < minRR) return { signal: null, reason: `RR insuficiente (${rr.toFixed(2)} < ${minRR})` };

      return {
        signal: {
          pair,
          direction: "BUY",
          entry: last.close,
          sl,
          tp,
          rr,
          timestamp: Date.now()
        },
        reason: "Sinal de COMPRA gerado"
      };
    }

    // ================= SELL =================
    if ((htfBias === "BEARISH" || last.emaFast < last.emaSlow)) {

      if (isDuplicate(pair, "SELL")) return { signal: null, reason: "Sinal duplicado (SELL)" };

      let sl = last.close + last.atr * 1.5;
      let tp = last.close - last.atr * 3;

      sl = normalizePrice(sl);
      tp = normalizePrice(tp);

      const rr = safeRR(last.close, sl, tp);
      const minRR = config.risk ? config.risk.minRR : 1.5;
      if (rr < minRR) return { signal: null, reason: `RR insuficiente (${rr.toFixed(2)} < ${minRR})` };

      return {
        signal: {
          pair,
          direction: "SELL",
          entry: last.close,
          sl,
          tp,
          rr,
          timestamp: Date.now()
        },
        reason: "Sinal de VENDA gerado"
      };
    }
  } catch (e) {
    console.error("Signal generation error:", e.message);
    return { signal: null, reason: "Erro interno no motor" };
  }

  return { signal: null, reason: "Sem tendência clara" };
}

module.exports = { generateSignal };
