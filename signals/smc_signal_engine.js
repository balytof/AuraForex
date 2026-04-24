// ============================================================
// APEX SMC — SIGNAL ENGINE PRO (ULTRA STOPS FIXED)
// ============================================================

const config = require("../config/config");
const { calcAll } = require("../indicators/indicators");
const { analyzeAll } = require("../smc/smc");

function getPrecision(price, pair = "") {
  if (pair.includes("XAU") || price > 1000) return 2; // Ouro: 2 casas
  if (pair.includes("JPY") || price > 100) return 3;  // JPY: 3 casas
  return 5;                                           // Forex: 5 casas
}

function normalizePrice(price, pair = "") {
  const p = getPrecision(price, pair);
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

    // DISTÂNCIA MÍNIMA ULTRA SEGURA (Evitar Invalid Stops)
    // Forex: Min 20 pips (0.00020)
    // JPY/Ouro: Min 50 pips (0.50)
    const isSpecial = pair.includes("JPY") || pair.includes("XAU");
    const minStopGap = isSpecial ? 0.60 : 0.00025; 
    
    // Calcula Stop baseado em 3.0 * ATR mas garante o GAP MÍNIMO
    const stopDist = Math.max(last.atr * 3.5, minStopGap);

    // ================= BUY =================
    if (htfBias === "BULLISH" || (htfBias === "NEUTRAL" && last.emaFast > last.emaSlow)) {
      if (isDuplicate(pair, "BUY")) return { signal: null, reason: "Sinal duplicado" };

      let sl = last.close - stopDist;
      let tp = last.close + (stopDist * 2.0); 

      sl = normalizePrice(sl, pair);
      tp = normalizePrice(tp, pair);
      const entry = normalizePrice(last.close, pair);

      const rr = safeRR(entry, sl, tp);
      return {
        signal: { pair, direction: "BUY", entry, sl, tp, rr, timestamp: Date.now(), score: 85 },
        reason: "Sinal COMPRA PRO"
      };
    }

    // ================= SELL =================
    if (htfBias === "BEARISH" || (htfBias === "NEUTRAL" && last.emaFast < last.emaSlow)) {
      if (isDuplicate(pair, "SELL")) return { signal: null, reason: "Sinal duplicado" };

      let sl = last.close + stopDist;
      let tp = last.close - (stopDist * 2.0);

      sl = normalizePrice(sl, pair);
      tp = normalizePrice(tp, pair);
      const entry = normalizePrice(last.close, pair);

      const rr = safeRR(entry, sl, tp);
      return {
        signal: { pair, direction: "SELL", entry, sl, tp, rr, timestamp: Date.now(), score: 85 },
        reason: "Sinal VENDA PRO"
      };
    }
  } catch (e) {
    return { signal: null, reason: "Erro motor" };
  }
  return { signal: null, reason: "Sem tendência PRO" };
}

module.exports = { generateSignal };
