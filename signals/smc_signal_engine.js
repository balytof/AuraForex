/**
 * ============================================================
 * APEX SMC — SIGNAL ENGINE PRO
 * ============================================================
 */

const { InstitutionalSMC } = require("../smc/smc");

function normalizePrice(price, symbol) {
  const specs = InstitutionalSMC.getSymbolSpecs(symbol);
  return Number(price.toFixed(specs.digits));
}

function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  if (!candles || candles.length < 50) return { signal: null, reason: "Velas insuficientes" };

  const atr = InstitutionalSMC.calculateATR(candles, 14);
  if (!atr || atr <= 0) return { signal: null, reason: "ATR inválido" };

  const last = candles[candles.length - 1];
  const entry = normalizePrice(last.close, pair);

  let direction = null;
  // Simulação de bias baseada no fechamento
  if (last.close > last.open) direction = "BUY";
  else if (last.close < last.open) direction = "SELL";

  if (!direction) return { signal: null, reason: "Sem direção" };

  const sl = InstitutionalSMC.calculateInstitutionalSL(entry, atr, direction, pair);
  const tp = InstitutionalSMC.calculateInstitutionalTP(entry, atr, direction, pair, 1.5);

  const specs = InstitutionalSMC.getSymbolSpecs(pair);
  const slPips = Math.abs(entry - sl) / specs.pip;

  if (slPips < specs.minStopPips || slPips > specs.maxStopPips) {
    return { signal: null, reason: `Stop Pips (${slPips.toFixed(1)}) fora do limite institucional` };
  }

  return {
    signal: {
      pair, direction, entry, sl, tp, atr,
      timestamp: Date.now(),
      magic: true
    },
    reason: "Sinal Institucional Validado"
  };
}

module.exports = { generateSignal };
