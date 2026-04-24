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
  if (!candles || candles.length < 210) return null;

  try {
    const ind = calcAll(candles);
    const { last } = ind;

    if (!last || !last.atr || !last.emaFast || !last.emaSlow) return null;
    if (!isValidATR(last.atr, last.close)) return null;

    const smc = analyzeAll(candles);

    // ================= BUY =================
    if ((htfBias === "BULLISH" || last.emaFast > last.emaSlow)) {

      if (isDuplicate(pair, "BUY")) return null;

      let sl = last.close - last.atr * 1.5;
      let tp = last.close + last.atr * 3;

      sl = normalizePrice(sl);
      tp = normalizePrice(tp);

      const rr = safeRR(last.close, sl, tp);
      const minRR = config.risk ? config.risk.minRR : 1.5;
      if (rr < minRR) return null;

      return {
        pair,
        direction: "BUY",
        entry: last.close,
        sl,
        tp,
        rr,
        timestamp: Date.now()
      };
    }

    // ================= SELL =================
    if ((htfBias === "BEARISH" || last.emaFast < last.emaSlow)) {

      if (isDuplicate(pair, "SELL")) return null;

      let sl = last.close + last.atr * 1.5;
      let tp = last.close - last.atr * 3;

      sl = normalizePrice(sl);
      tp = normalizePrice(tp);

      const rr = safeRR(last.close, sl, tp);
      const minRR = config.risk ? config.risk.minRR : 1.5;
      if (rr < minRR) return null;

      return {
        pair,
        direction: "SELL",
        entry: last.close,
        sl,
        tp,
        rr,
        timestamp: Date.now()
      };
    }
  } catch (e) {
    console.error("Signal generation error:", e.message);
  }

  return null;
}

module.exports = { generateSignal };
