/**
 * ============================================================
 *  APEX SMC — INSTITUTIONAL ANALYSIS ENGINE v2
 *  Smart Money Concepts + Institutional Context
 * ============================================================
 */

class InstitutionalSMC {
  // ============================================================
  // DYNAMIC PIP ENGINE
  // ============================================================
  static getPipValue(pair) {
    const p = pair.toUpperCase();
    if (p.includes("JPY")) return 0.01;
    if (p.includes("XAU") || p.includes("GOLD")) return 0.1;
    if (p.includes("BTC")) return 1;
    return 0.0001;
  }

  // ============================================================
  // ATR (Volatility Measurement)
  // ============================================================
  static calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    let trs = [];
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      );
      trs.push(tr);
    }
    const recent = trs.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / period;
  }

  // ============================================================
  // SESSION ENGINE
  // ============================================================
  static getSession() {
    const hour = new Date().getUTCHours();
    if (hour >= 7 && hour <= 10) return "LONDON_OPEN";
    if (hour >= 12 && hour <= 16) return "NEWYORK_OPEN";
    if (hour >= 7 && hour <= 16) return "LONDON_NEWYORK";
    return "OFF_SESSION";
  }

  static isTradableSession(pair) {
    const session = this.getSession();
    if (session !== "OFF_SESSION") return true;
    if (pair.includes("XAU")) return false; // Ouro só em sessão
    return false;
  }

  // ============================================================
  // VOLATILITY REGIME
  // ============================================================
  static detectVolatilityRegime(candles, atr) {
    const recent = candles.slice(-20);
    const avgRange = recent.reduce((sum, c) => sum + (c.high - c.low), 0) / recent.length;
    const ratio = avgRange / atr;
    if (ratio < 0.7) return "LOW_VOLATILITY";
    if (ratio > 1.8) return "EXTREME_VOLATILITY";
    return "NORMAL";
  }

  // ============================================================
  // DISPLACEMENT ENGINE
  // ============================================================
  static detectDisplacement(candles, atr) {
    const last = candles[candles.length - 1];
    const body = Math.abs(last.close - last.open);
    const range = Math.max(last.high - last.low, 0.00001);
    const bodyRatio = body / range;
    const atrExpansion = range / atr;
    const bullish = last.close > last.open;
    const bearish = last.close < last.open;

    return {
      bullish: bullish && bodyRatio >= 0.7 && atrExpansion >= 1.2,
      bearish: bearish && bodyRatio >= 0.7 && atrExpansion >= 1.2,
      strength: atrExpansion * bodyRatio,
      bodyRatio,
      atrExpansion
    };
  }

  // ============================================================
  // STRONG SWING DETECTION
  // ============================================================
  static detectSwings(candles, lookback = 5) {
    const highs = [];
    const lows = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (candles[j].high > candles[i].high) isHigh = false;
        if (candles[j].low < candles[i].low) isLow = false;
      }
      if (isHigh) highs.push({ index: i, price: candles[i].high });
      if (isLow) lows.push({ index: i, price: candles[i].low });
    }
    return { swingHighs: highs, swingLows: lows };
  }

  // ============================================================
  // STRONG BOS / CHOCH
  // ============================================================
  static detectStructure(candles, atr) {
    const swings = this.detectSwings(candles);
    const structure = [];
    const last = candles[candles.length - 1];
    const displacement = this.detectDisplacement(candles, atr);
    
    const prevHigh = swings.swingHighs[swings.swingHighs.length - 2];
    const prevLow = swings.swingLows[swings.swingLows.length - 2];

    // STRONG BULLISH BOS
    if (prevHigh && last.close > prevHigh.price && displacement.bullish) {
      structure.push({ type: "BOS_BULLISH", level: prevHigh.price, strength: displacement.strength, confirmed: true });
    }
    // STRONG BEARISH BOS
    if (prevLow && last.close < prevLow.price && displacement.bearish) {
      structure.push({ type: "BOS_BEARISH", level: prevLow.price, strength: displacement.strength, confirmed: true });
    }

    return { structure, swingHighs: swings.swingHighs, swingLows: swings.swingLows };
   // ============================================================
  // INSTITUTIONAL ORDER BLOCKS
  // ============================================================
  static detectOrderBlocks(candles, atr) {
    const obs = [];
    for (let i = 5; i < candles.length - 5; i++) {
      const candle = candles[i];
      const future = candles.slice(i + 1, i + 4);
      const futureMove = Math.abs(future[future.length - 1].close - candle.close);
      const impulse = futureMove / atr;

      // BULLISH OB
      if (candle.close < candle.open && impulse >= 1.5) {
        const mitigated = candles.slice(i + 4).some(c => c.low <= candle.high && c.high >= candle.low);
        obs.push({
          type: "BULLISH_OB",
          high: candle.high,
          low: candle.low,
          mid: (candle.high + candle.low) / 2,
          strength: impulse,
          mitigated,
          valid: !mitigated,
          createdIndex: i
        });
      }
      // BEARISH OB
      if (candle.close > candle.open && impulse >= 1.5) {
        const mitigated = candles.slice(i + 4).some(c => c.high >= candle.low && c.low <= candle.high);
        obs.push({
          type: "BEARISH_OB",
          high: candle.high,
          low: candle.low,
          mid: (candle.high + candle.low) / 2,
          strength: impulse,
          mitigated,
          valid: !mitigated,
          createdIndex: i
        });
      }
    }
    return obs.filter(ob => ob.valid).sort((a, b) => b.strength - a.strength).map(ob => ({
      ...ob,
      mitigationCount: ob.mitigated ? 1 : 0 // Compatibilidade com signals.js
    }));
  }

  // ============================================================
  // INSTITUTIONAL FVG
  // ============================================================
  static detectFVG(candles, pair) {
    const fvgs = [];
    const pip = this.getPipValue(pair);
    for (let i = 0; i < candles.length - 2; i++) {
      const c1 = candles[i], c2 = candles[i + 1], c3 = candles[i + 2];
      // BULLISH FVG
      if (c3.low > c1.high) {
        const gap = (c3.low - c1.high) / pip;
        if (gap >= 5) {
          fvgs.push({ type: "BULLISH_FVG", top: c3.low, bottom: c1.high, gapSize: gap, strength: gap / 10 });
        }
      }
      // BEARISH FVG
      if (c3.high < c1.low) {
        const gap = (c1.low - c3.high) / pip;
        if (gap >= 5) {
          fvgs.push({ type: "BEARISH_FVG", top: c1.low, bottom: c3.high, gapSize: gap, strength: gap / 10 });
        }
      }
    }
    return fvgs;
  }

  static detectLiquidity(candles, pair, tolerance = 0.0005) {
    const equalHighs = [], equalLows = [];
    const pip = this.getPipValue(pair);
    const realTolerance = tolerance;
    
    // Obter swings para evitar loop O(n2)
    const { swingHighs, swingLows } = this.detectStructure(candles);

    // Detecção de Equal Highs (Resistance Liquidity)
    for (let i = 0; i < swingHighs.length - 1; i++) {
      let cluster = [swingHighs[i]];
      for (let j = i + 1; j < swingHighs.length; j++) {
        if (Math.abs(swingHighs[i].price - swingHighs[j].price) <= realTolerance) {
          if (swingHighs[j].index - swingHighs[i].index > 5) { // Filtro de Tempo (mínimo 5 velas entre toques)
             cluster.push(swingHighs[j]);
          }
        }
      }
      if (cluster.length >= 2) {
        const level = cluster.reduce((sum, s) => sum + s.price, 0) / cluster.length;
        equalHighs.push({ level, count: cluster.length, indices: cluster.map(c => c.index) });
        i += cluster.length - 1; // Pular swings já processados
      }
    }

    // Detecção de Equal Lows (Support Liquidity)
    for (let i = 0; i < swingLows.length - 1; i++) {
      let cluster = [swingLows[i]];
      for (let j = i + 1; j < swingLows.length; j++) {
        if (Math.abs(swingLows[i].price - swingLows[j].price) <= realTolerance) {
          if (swingLows[j].index - swingLows[i].index > 5) {
            cluster.push(swingLows[j]);
          }
        }
      }
      if (cluster.length >= 2) {
        const level = cluster.reduce((sum, s) => sum + s.price, 0) / cluster.length;
        equalLows.push({ level, count: cluster.length, indices: cluster.map(c => c.index) });
        i += cluster.length - 1;
      }
    }

    return { equalHighs, equalLows };
  }

  // ============================================================
  // INSTITUTIONAL LIQUIDITY SWEEPS
  // ============================================================
  static detectLiquiditySweeps(candles, swingHighs, swingLows, atr) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    let bullishSweep = false;
    let bearishSweep = false;

    const lastLow = swingLows[swingLows.length - 1];
    const lastHigh = swingHighs[swingHighs.length - 1];

    // BULLISH SWEEP
    if (lastLow) {
      const reclaim = last.close > lastLow.price;
      const wick = last.close - last.low;
      const range = last.high - last.low;
      const rejection = wick / range >= 0.6;
      const sweep = prev.low < lastLow.price;
      bullishSweep = sweep && reclaim && rejection;
    }
    // BEARISH SWEEP
    if (lastHigh) {
      const reclaim = last.close < lastHigh.price;
      const wick = last.high - last.close;
      const range = last.high - last.low;
      const rejection = wick / range >= 0.6;
      const sweep = prev.high > lastHigh.price;
      bearishSweep = sweep && reclaim && rejection;
    }
    return { bullishSweep, bearishSweep };
  }

  // ============================================================
  // HTF BIAS
  // ============================================================
  static determineHTFBias(htfCandles) {
    const atr = this.calculateATR(htfCandles);
    const structure = this.detectStructure(htfCandles, atr);
    const bullish = structure.structure.some(s => s.type === "BOS_BULLISH");
    const bearish = structure.structure.some(s => s.type === "BOS_BEARISH");
    if (bullish) return "BULLISH";
    if (bearish) return "BEARISH";
    return "NEUTRAL";
  }
}

// ============================================================
// MAIN ANALYSIS WRAPPER
// ============================================================
function analyzeInstitutionalSMC(pair, ltfCandles, htfCandles) {
  if (!ltfCandles || ltfCandles.length < 100) return null;

  // SESSION FILTER
  if (!InstitutionalSMC.isTradableSession(pair)) {
    return { valid: false, reason: "OFF_SESSION" };
  }

  const atr = InstitutionalSMC.calculateATR(ltfCandles);

  // VOLATILITY FILTER
  const volatility = InstitutionalSMC.detectVolatilityRegime(ltfCandles, atr);
  if (volatility === "EXTREME_VOLATILITY") {
    return { valid: false, reason: "EXTREME_VOLATILITY" };
  }

  // HTF BIAS
  const htfBias = htfCandles ? InstitutionalSMC.determineHTFBias(htfCandles) : "NEUTRAL";

  // STRUCTURE
  const structure = InstitutionalSMC.detectStructure(ltfCandles, atr);

  // ORDER BLOCKS
  const obs = InstitutionalSMC.detectOrderBlocks(ltfCandles, atr);

  // FVG
  const fvgs = InstitutionalSMC.detectFVG(ltfCandles, pair);

  // SWEEPS
  const sweeps = InstitutionalSMC.detectLiquiditySweeps(ltfCandles, structure.swingHighs, structure.swingLows, atr);

  // DISPLACEMENT
  const displacement = InstitutionalSMC.detectDisplacement(ltfCandles, atr);

  return {
    valid: true,
    pair,
    atr,
    volatility,
    htfBias,
    displacement,
    structure: structure.structure,
    swingHighs: structure.swingHighs,
    swingLows: structure.swingLows,
    orderBlocks: obs,
    fvgs,
    sweeps,
    session: InstitutionalSMC.getSession()
  };
}

// Backward Compatibility Wrapper
function analyzeAll(candles, pair = "EURUSD", htfCandles = null) {
  const result = analyzeInstitutionalSMC(pair, candles, htfCandles);
  if (!result || !result.valid) return { obs: [], fvgs: [], structure: [], liquidity: { equalHighs: [], equalLows: [] }, sweeps: { bullishSweep: false, bearishSweep: false }, phase: "CONSOLIDATION" };
  
  return {
    obs: result.orderBlocks,
    fvgs: result.fvgs,
    structure: result.structure,
    swingHighs: result.swingHighs,
    swingLows: result.swingLows,
    liquidity: { equalHighs: [], equalLows: [] }, // O novo motor lida com sweeps diretamente
    sweeps: result.sweeps,
    phase: result.volatility,
    displacement: result.displacement,
    htfBias: result.htfBias
  };
}

module.exports = { InstitutionalSMC, analyzeInstitutionalSMC, analyzeAll };
