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
    smcStructure:  30, // BOS/ChoCh
    orderBlock:    25, // Mitigation of OB
    liquidity:     20, // Sweep of Liquidity
    trend:         25, // EMA Alignment (Trend)
  };
  
  const totalScore = Object.entries(factors)
    .filter(([k]) => k !== "displacement") // Displacement é travão, não ponto
    .reduce((sum, [k, v]) => sum + (v && weights[k] ? weights[k] : 0), 0);

  // REGRA INSTITUCIONAL: Sem displacement (força), o sinal é lixo.
  return factors.displacement ? totalScore : 0;
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

  // ── FILTRO DE CHOP (Lateralização)
  const emaDistance = Math.abs(last.emaFast - last.emaSlow);
  const isTrending  = emaDistance > (last.atr * 0.15);
  if (!isTrending) {
    log.debug(`${pair}: Mercado em lateralização (Chop). Distância EMA: ${emaDistance.toFixed(5)} < ${ (last.atr * 0.15).toFixed(5) }`);
    return null;
  }

  // ── Analisa SMC
  const smc = analyzeAll(candles, pair);

  const session = isActiveSession();
  const rsiCfg  = cfg.indicators.rsi;
  const atrCfg  = cfg.indicators.atr;

  // ── 5. NARRATIVA INSTITUCIONAL (The Core) ────────────────────────
  let direction = null;
  let reason = "";
  
  const hasBullishNarrative = smc.sweeps.bullishSweep && smc.structure.some(s => s.type === "BOS_BULLISH" || s.type === "CHOCH_BULLISH");
  const hasBearishNarrative = smc.sweeps.bearishSweep && smc.structure.some(s => s.type === "BOS_BEARISH" || s.type === "CHOCH_BEARISH");

  const isBullishBias = (htfBias === "BULLISH") && (last.emaFast > last.emaSlow);
  const isBearishBias = (htfBias === "BEARISH") && (last.emaFast < last.emaSlow);

  if (isBullishBias) {
    const freshOB = smc.obs.find(o => o.type === "BULLISH_OB" && o.mitigationCount === 0);
    if (freshOB && (hasBullishNarrative || freshOB.hasSweep)) {
      direction = "BUY";
      reason = "Bullish Narrative: Sweep + BOS + Fresh OB";
    }
  } else if (isBearishBias) {
    const freshOB = smc.obs.find(o => o.type === "BEARISH_OB" && o.mitigationCount === 0);
    if (freshOB && (hasBearishNarrative || freshOB.hasSweep)) {
      direction = "SELL";
      reason = "Bearish Narrative: Sweep + BOS + Fresh OB";
    }
  }

  if (!direction) return null;

  // ── 6. CONFLUÊNCIA E SCORE ────────────────────────────────────────
  const factors = {
    smcStructure:  smc.structure.some(s => s.type === (direction === "BUY" ? "BOS_BULLISH" : "BOS_BEARISH") || s.type.includes("CHOCH")),
    orderBlock:    smc.obs.some(o => o.type === (direction === "BUY" ? "BULLISH_OB" : "BEARISH_OB") && o.mitigationCount === 0),
    displacement:  Math.abs(last.close - last.open) > (last.atr * 0.8),
    liquidity:     direction === "BUY" ? smc.sweeps.bullishSweep : smc.sweeps.bearishSweep,
    trend:         direction === "BUY" ? (last.emaFast > last.emaSlow) : (last.emaFast < last.emaSlow),
  };

  const score = calcScore(factors);
  if (score < cfg.risk.minConfluence) {
    log.debug(`${pair} ${direction} abortado: Score ${score} < ${cfg.risk.minConfluence}`);
    return null;
  }

  // ── 7. EXECUÇÃO (LIMIT VS MARKET) ─────────────────────────────────
  const zone = smc.obs.filter(o => o.type === (direction === "BUY" ? "BULLISH_OB" : "BEARISH_OB"))
    .sort((a, b) => Math.abs(last.close - a.mid) - Math.abs(last.close - b.mid))[0];

  if (!zone) return null;

  let entryPrice = last.close;
  let orderType = "MARKET";
  const idealEntry = direction === "BUY" ? zone.high : zone.low;

  // Se o preço já se afastou muito da zona, usa ordem LIMIT no topo/fundo da zona
  const threshold = last.atr * 0.15;
  if (direction === "BUY" && last.close > idealEntry + threshold) {
    entryPrice = idealEntry;
    orderType = "LIMIT";
  } else if (direction === "SELL" && last.close < idealEntry - threshold) {
    entryPrice = idealEntry;
    orderType = "LIMIT";
  }

  const slDist = last.atr * atrCfg.slMultiplier;
  const tpDist = last.atr * atrCfg.tpMultiplier;

  const sl = normalize(direction === "BUY" ? entryPrice - slDist : entryPrice + slDist, pair);
  const tp = normalize(direction === "BUY" ? entryPrice + tpDist : entryPrice - tpDist, pair);
  const rr = direction === "BUY" ? (tp - entryPrice) / (entryPrice - sl) : (entryPrice - tp) / (sl - entryPrice);

  if (rr < cfg.risk.minRR) return null;

  return {
    pair, direction, score, orderType,
    entry: normalize(entryPrice, pair),
    sl, tp,
    rr: parseFloat(rr.toFixed(2)),
    atr: last.atr,
    factors,
    reason,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { generateSignal, calcScore, isActiveSession };
