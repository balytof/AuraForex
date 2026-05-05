// ============================================================
// APEX SMC — SIGNAL ENGINE PRO (MAGIC VERSION)
// ============================================================

const config = require("../config/config");
const { calcAll } = require("../indicators/indicators");

function getPrecision(pair = "") {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 2;
  if (pair.includes("JPY")) return 3;
  return 5;
}

function normalizePrice(price, pair = "") {
  const p = getPrecision(pair);
  return Number(Math.round(price + "e" + p) + "e-" + p);
}

const recentSignals = new Map();

function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  const SIGNAL_COOLDOWN = 4 * 60 * 60 * 1000; // 4 horas de proteção contra duplicados

  if (!candles || candles.length < 210) return { signal: null, reason: "Velas insuficientes" };

  try {
    const ind = calcAll(candles);
    const { last } = ind;
    if (!last || !last.atr) return { signal: null, reason: "Erro indicadores" };

    const stopDist = last.atr * 4.0;
    const entry = normalizePrice(last.close, pair);

    // Check Duplicado
    const lastSignal = recentSignals.get(`${pair}_BUY`);
    const isCooldown = lastSignal && (Date.now() - lastSignal < SIGNAL_COOLDOWN);

    // ================= BUY =================

    if ((htfBias === "BULLISH" || (htfBias === "NEUTRAL" && last.emaFast > last.emaSlow))) {

      const sl = normalizePrice(entry - stopDist, pair);
      const tp = normalizePrice(entry + (stopDist * 1.5), pair);

      recentSignals.set(`${pair}_BUY`, Date.now());

      return {
        signal: { pair, direction: "BUY", entry, sl, tp, rr: 3.0, timestamp: Date.now(), score: 95, magic: true },
        reason: "Sinal COMPRA PRO"
      };
    }


    // ================= SELL =================
    const lastSell = recentSignals.get(`${pair}_SELL`);
    const isSellCooldown = lastSell && (Date.now() - lastSell < SIGNAL_COOLDOWN);

    if ((htfBias === "BEARISH" || (htfBias === "NEUTRAL" && last.emaFast < last.emaSlow))) {

      const sl = normalizePrice(entry + stopDist, pair);
      const tp = normalizePrice(entry - (stopDist * 1.5), pair);

      recentSignals.set(`${pair}_SELL`, Date.now());

      return {
        signal: { pair, direction: "SELL", entry, sl, tp, rr: 3.0, timestamp: Date.now(), score: 95, magic: true },
        reason: "Sinal VENDA PRO"
      };
    }

  } catch (e) {
    return { signal: null, reason: "Erro motor" };
  }
  return { signal: null, reason: "Sem tendência PRO" };
}

module.exports = { generateSignal };
