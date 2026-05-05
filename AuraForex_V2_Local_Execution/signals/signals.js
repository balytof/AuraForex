/**
 * ============================================================
 *  APEX SMC — signals/signals.js
 *  Motor de geração de sinais.
 *  Combina SMC + indicadores + sessão + bias AI num score único.
 *  Só gera sinal se score >= minConfluence (config).
 * ============================================================
 */

const config = require("../config/config");
const { calcAll }    = require("../indicators/indicators");
const { analyzeAll } = require("../smc/smc");
const log            = require("../utils/logger");

const cfg = config;

/**
 * Verifica se estamos numa sessão de mercado ativa (UTC)
 */
function isActiveSession() {
  return true; 
}

function getPrecision(pair) {
  const p = String(pair).toUpperCase();
  if (p.includes("JPY")) return 3;
  if (p.includes("XAU") || p.includes("GOLD")) return 2;
  return 5;
}

function normalize(price, pair) {
  const p = getPrecision(pair);
  return Number(Number(price).toFixed(p));
}

function validatePriceRange(pair, price) {
  const p = String(pair).toUpperCase();
  if (p.includes("XAU") || p.includes("GOLD")) {
    return price > 500; // Ouro não pode custar $1.09
  }
  if (p.includes("JPY")) {
    return price > 50 && price < 300; // Iene não custa $1.09
  }
  if (p.includes("EUR") || p.includes("GBP") || p.includes("USD") || p.includes("AUD")) {
    return price > 0.3 && price < 3.0; // Forex maioritário
  }
  return true; // Outros pares
}

/**
 * Calcula o score de confluência (0–100)
 * @param {Object} factors - mapa de factor → boolean
 * @returns {number}
 */
function calcScore(factors) {
  const weights = {
    smcStructure:  25,
    orderBlock:    20,
    fvg:           15,
    emaAlignment:  15,
    macdConfirm:   10,
    rsiConfirm:    10,
    sessionActive:  5,
  };
  return Object.entries(factors)
    .reduce((sum, [k, v]) => sum + (v && weights[k] ? weights[k] : 0), 0);
}

/**
 * Gera um sinal de trading para um par
 * @param {string} pair
 * @param {Array}  candles - candles LTF
 * @param {string} htfBias - "BULLISH" | "BEARISH" | "NEUTRAL" (vem da AI)
 * @returns {Object|null} sinal ou null
 */
function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  if (!candles || candles.length < 210) {
    log.debug(`${pair}: candles insuficientes (${candles?.length})`);
    return null;
  }

  // ── Calcula indicadores
  const ind = calcAll(candles);
  const { last } = ind;

  if (!last.atr || !last.emaFast || !last.emaSlow) {
    log.debug(`${pair}: indicadores ainda a inicializar`);
    return null;
  }

  // ── TRAVA DE SANIDADE (CHEF)
  if (!validatePriceRange(pair, last.close)) {
    console.error(`❌ CRITICAL: Dados corrompidos para ${pair}. Preço recebido: ${last.close}. Sinal abortado.`);
    return null;
  }

  // ── Analisa SMC
  const smc = analyzeAll(candles);

  const session = isActiveSession();
  const rsiCfg  = cfg.indicators.rsi;
  const atrCfg  = cfg.indicators.atr;

  // ══════════════════════════════════════════════
  //  SINAL LONG (BUY)
  // ══════════════════════════════════════════════
  const bullBias = htfBias === "BULLISH" || last.emaFast > last.emaSlow;

  if (bullBias) {
    const factors = {
      smcStructure:  smc.bosBull,
      orderBlock:    smc.nearBullOB.length  > 0,
      fvg:           smc.nearBullFVG.length > 0,
      emaAlignment:  last.emaFast > last.emaSlow,
      macdConfirm:   last.macdHist !== null && last.macdHist > 0 && last.macdHist > (last.macdHistP ?? -Infinity),
      rsiConfirm:    last.rsi !== null && last.rsi > 35 && last.rsi < rsiCfg.overbought,
      sessionActive: session,
    };

    const score = calcScore(factors);
    log.debug(`${pair} BUY score: ${score}`, factors);

    if (score >= cfg.risk.minConfluence) {
      let entryPrice = last.close;
      let orderType = "MARKET";
      
      const zone = smc.nearBullOB[0] || smc.nearBullFVG[0];
      const idealEntry = zone ? (zone.high || zone.top) : null;
      if (idealEntry && last.close > idealEntry + (last.atr * 0.1)) {
        entryPrice = idealEntry;
        orderType = "LIMIT";
      }

      const sl = normalize(entryPrice - last.atr * atrCfg.slMultiplier, pair);
      const tp = normalize(entryPrice + last.atr * atrCfg.tpMultiplier, pair);
      const rr = ((tp - entryPrice) / (entryPrice - sl));

      if (rr < cfg.risk.minRR) {
        log.debug(`${pair} BUY descartado — R:R ${rr.toFixed(2)} < ${cfg.risk.minRR}`);
      } else {
        return {
          pair, direction: "BUY", score, orderType,
          entry:    0,
          sl, tp,
          rr:       parseFloat(rr.toFixed(2)),
          atr:      last.atr,
          factors,
          htfBias,
          smcZones: {
            obs:       smc.nearBullOB,
            fvgs:      smc.nearBullFVG,
            structure: smc.structure.filter(s => s.type.includes("BULL")),
          },
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  // ══════════════════════════════════════════════
  //  SINAL SHORT (SELL)
  // ══════════════════════════════════════════════
  const bearBias = htfBias === "BEARISH" || last.emaFast < last.emaSlow;

  if (bearBias) {
    const factors = {
      smcStructure:  smc.bosBear,
      orderBlock:    smc.nearBearOB.length  > 0,
      fvg:           smc.nearBearFVG.length > 0,
      emaAlignment:  last.emaFast < last.emaSlow,
      macdConfirm:   last.macdHist !== null && last.macdHist < 0 && last.macdHist < (last.macdHistP ?? Infinity),
      rsiConfirm:    last.rsi !== null && last.rsi < 65 && last.rsi > rsiCfg.oversold,
      sessionActive: session,
    };

    const score = calcScore(factors);
    log.debug(`${pair} SELL score: ${score}`, factors);

    if (score >= cfg.risk.minConfluence) {
      let entryPrice = last.close;
      let orderType = "MARKET";
      
      const zone = smc.nearBearOB[0] || smc.nearBearFVG[0];
      const idealEntry = zone ? (zone.low || zone.bottom) : null;
      if (idealEntry && last.close < idealEntry - (last.atr * 0.1)) {
        entryPrice = idealEntry;
        orderType = "LIMIT";
      }

      const sl = normalize(entryPrice + last.atr * atrCfg.slMultiplier, pair);
      const tp = normalize(entryPrice - last.atr * atrCfg.tpMultiplier, pair);
      const rr = ((entryPrice - tp) / (sl - entryPrice));

      if (rr < cfg.risk.minRR) {
        log.debug(`${pair} SELL descartado — R:R ${rr.toFixed(2)} < ${cfg.risk.minRR}`);
      } else {
        return {
          pair, direction: "SELL", score, orderType,
          entry:    0,
          sl, tp,
          rr:       parseFloat(rr.toFixed(2)),
          atr:      last.atr,
          factors,
          htfBias,
          smcZones: {
            obs:       smc.nearBearOB,
            fvgs:      smc.nearBearFVG,
            structure: smc.structure.filter(s => s.type.includes("BEAR")),
          },
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

module.exports = { generateSignal, calcScore, isActiveSession };
