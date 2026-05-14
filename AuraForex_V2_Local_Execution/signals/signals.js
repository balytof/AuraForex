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

function getSymbolSpecs(symbol) {
  const s = symbol.toUpperCase();
  if (s.includes("XAU") || s.includes("GOLD")) {
    return { digits: 2, pip: 0.1, minStop: 0.50, name: "GOLD" };
  }
  if (s.includes("JPY")) {
    return { digits: 3, pip: 0.01, minStop: 0.030, name: "JPY" };
  }
  if (s.includes("BTC") || s.includes("ETH")) {
    return { digits: 2, pip: 1.0, minStop: 10.0, name: "CRYPTO" };
  }
  return { digits: 5, pip: 0.0001, minStop: 0.00030, name: "FOREX" };
}

function normalizePrice(price, pair) {
  const specs = getSymbolSpecs(pair);
  return Number(price.toFixed(specs.digits));
}

function validateStops(entry, sl, tp, symbol) {
  const specs = getSymbolSpecs(symbol);
  const slDistance = Math.abs(entry - sl);
  const tpDistance = Math.abs(entry - tp);
  return slDistance >= specs.minStop && tpDistance >= specs.minStop;
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

  const sl = normalizePrice(direction === "BUY" ? entryPrice - slDist : entryPrice + slDist, pair);
  const tp = normalizePrice(direction === "BUY" ? entryPrice + tpDist : entryPrice - tpDist, pair);
  const nEntry = normalizePrice(entryPrice, pair);
  
  if (!validateStops(nEntry, sl, tp, pair)) {
    log.debug(`${pair}: Paragem (Stops) inválida para a corretora.`);
    return null;
  }

  const rr = direction === "BUY" ? (tp - nEntry) / (nEntry - sl) : (nEntry - tp) / (sl - nEntry);

  if (rr < cfg.risk.minRR) return null;

  return {
    pair, direction, score, orderType,
    entry: nEntry,
    sl, tp,
    rr: parseFloat(rr.toFixed(2)),
    atr: last.atr,
    factors,
    reason,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { generateSignal, calcScore, isActiveSession };
