// ============================================================
// APEX SMC — SIGNAL ENGINE PRO (STOPS FIXED)
// ============================================================

const config = require("../config/config");
const { calcAll } = require("../indicators/indicators");
const { analyzeAll } = require("../smc/smc");

function getPrecision(price) {
  if (price > 1000) return 1;  // Ouro
  if (price > 100) return 2;   // JPY
  if (price > 10) return 3;    
  return 5;                    // Forex Major
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

const recentSignals = new Map();

function isDuplicate(pair, direction) {
  const key = `${pair}-${direction}`;
  const now = Date.now();
  const last = recentSignals.get(key);
  if (last && now - last < 60000) return true;
  recentSignals.set(key, now);
  return false;
}

function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  if (!candles || candles.length < 210) return { signal: null, reason: "Velas insuficientes" };

  try {
    const ind = calcAll(candles);
    const { last } = ind;
    if (!last || !last.atr) return { signal: null, reason: "Erro indicadores" };

    // Garantir distância mínima agressiva (20 pips) para evitar "Invalid Stops"
    const minStopPips = pair.includes("JPY") || pair.includes("XAU") ? 0.20 : 0.00020;
    const stopDistance = Math.max(last.atr * 3.0, minStopPips); 

    // ================= BUY =================
    if (htfBias === "BULLISH" || last.emaFast > last.emaSlow) {
      if (isDuplicate(pair, "BUY")) return { signal: null, reason: "Sinal duplicado" };

      let sl = last.close - stopDistance;
      let tp = last.close + (stopDistance * 2.0); // TP = 2x o risco para manter RR

      sl = normalizePrice(sl);
      tp = normalizePrice(tp);

      const rr = safeRR(last.close, sl, tp);
      return {
        signal: { pair, direction: "BUY", entry: last.close, sl, tp, rr, timestamp: Date.now() },
        reason: "Sinal COMPRA PRO"
      };
    }

    // ================= SELL =================
    if (htfBias === "BEARISH" || last.emaFast < last.emaSlow) {
      if (isDuplicate(pair, "SELL")) return { signal: null, reason: "Sinal duplicado" };

      let sl = last.close + stopDistance;
      let tp = last.close - (stopDistance * 2.0);

      sl = normalizePrice(sl);
      tp = normalizePrice(tp);

      const rr = safeRR(last.close, sl, tp);
      return {
        signal: { pair, direction: "SELL", entry: last.close, sl, tp, rr, timestamp: Date.now() },
        reason: "Sinal VENDA PRO"
      };
    }
  } catch (e) {
    return { signal: null, reason: "Erro motor" };
  }
  return { signal: null, reason: "Sem tendência PRO" };
}

module.exports = { generateSignal };
