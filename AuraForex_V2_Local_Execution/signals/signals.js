/**
 * ============================================================
 *  APEX SMC — signals/signals.js
 * ============================================================
 */

const config = require("../config/config");
const { calcAll }    = require("../indicators/indicators");
const { InstitutionalSMC } = require("../smc/smc");
const log            = require("../utils/logger");

const cfg = config;

function normalizePrice(price, symbol) {
  const specs = InstitutionalSMC.getSymbolSpecs(symbol);
  return Number(price.toFixed(specs.digits));
}

function validateStops(entry, sl, tp, symbol) {
  const specs = InstitutionalSMC.getSymbolSpecs(symbol);
  const slDistancePips = Math.abs(entry - sl) / specs.pip;
  const tpDistancePips = Math.abs(entry - tp) / specs.pip;

  if (slDistancePips < specs.minStopPips) return false;
  if (tpDistancePips < specs.minStopPips) return false;
  if (slDistancePips > specs.maxStopPips) return false;

  return true;
}

function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  if (!candles || candles.length < 100) return null;

  const ind = calcAll(candles);
  const { last } = ind;
  const atr = last.atr;

  if (!atr || atr <= 0) return null;

  const specs = InstitutionalSMC.getSymbolSpecs(pair);
  const entry = normalizePrice(last.close, pair);

  let direction = null;
  const isBullish = (htfBias === "BULLISH" || (htfBias === "NEUTRAL" && last.emaFast > last.emaSlow));
  const isBearish = (htfBias === "BEARISH" || (htfBias === "NEUTRAL" && last.emaFast < last.emaSlow));

  if (isBullish) direction = "BUY";
  else if (isBearish) direction = "SELL";

  if (!direction) return null;

  // CÁLCULO INSTITUCIONAL DE SL/TP
  const sl = InstitutionalSMC.calculateInstitutionalSL(entry, atr, direction, pair);
  const tp = InstitutionalSMC.calculateInstitutionalTP(entry, atr, direction, pair, 2.0);

  if (!validateStops(entry, sl, tp, pair)) {
    log.debug(`${pair}: Sinal abortado por violação de Stop-Specs Institucionais.`);
    return null;
  }

  const rr = direction === "BUY" ? (tp - entry) / (entry - sl) : (entry - tp) / (sl - entry);
  if (rr < 1.2) return null;

  return {
    pair, direction, 
    entry, sl, tp,
    rr: parseFloat(rr.toFixed(2)),
    atr,
    timestamp: new Date().toISOString(),
    orderType: "MARKET"
  };
}

module.exports = { generateSignal };
