// ============================================================
// APEX SMC — SIGNAL ENGINE PRO (HARDCORE PRECISION FIXED)
// ============================================================

const config = require("../config/config");
const { calcAll } = require("../indicators/indicators");

function getPrecision(pair = "") {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 2;
  if (pair.includes("JPY")) return 3;
  if (pair.includes("BTC") || pair.includes("ETH")) return 2;
  return 5;
}

function normalizePrice(price, pair = "") {
  const p = getPrecision(pair);
  // Força arredondamento matemático rigoroso
  return Number(Math.round(price + "e" + p) + "e-" + p);
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

    // DISTÂNCIA DE SEGURANÇA AUMENTADA (30 Pips)
    const isSpecial = pair.includes("JPY") || pair.includes("XAU");
    const minStopGap = isSpecial ? 0.80 : 0.00030; 
    const stopDist = Math.max(last.atr * 4.0, minStopGap);

    const entry = normalizePrice(last.close, pair);

    // ================= BUY =================
    if (htfBias === "BULLISH" || (htfBias === "NEUTRAL" && last.emaFast > last.emaSlow)) {
      if (isDuplicate(pair, "BUY")) return { signal: null, reason: "Sinal duplicado" };

      const sl = normalizePrice(entry - stopDist, pair);
      const tp = normalizePrice(entry + (stopDist * 2.5), pair);

      return {
        signal: { pair, direction: "BUY", entry, sl, tp, rr: 2.5, timestamp: Date.now(), score: 92 },
        reason: "Sinal COMPRA PRO"
      };
    }

    // ================= SELL =================
    if (htfBias === "BEARISH" || (htfBias === "NEUTRAL" && last.emaFast < last.emaSlow)) {
      if (isDuplicate(pair, "SELL")) return { signal: null, reason: "Sinal duplicado" };

      const sl = normalizePrice(entry + stopDist, pair);
      const tp = normalizePrice(entry - (stopDist * 2.5), pair);

      return {
        signal: { pair, direction: "SELL", entry, sl, tp, rr: 2.5, timestamp: Date.now(), score: 92 },
        reason: "Sinal VENDA PRO"
      };
    }
  } catch (e) {
    return { signal: null, reason: "Erro motor" };
  }
  return { signal: null, reason: "Sem tendência PRO" };
}

module.exports = { generateSignal };
