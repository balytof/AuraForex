/**
 * ============================================================
 * APEX SMC — INSTITUTIONAL ANALYSIS ENGINE v2
 * ============================================================
 */

class InstitutionalSMC {
  // ============================================================
  // INSTITUTIONAL SYMBOL SPECS
  // ============================================================
  static getSymbolSpecs(symbol) {
    const s = symbol.toUpperCase();
    if (s.includes("XAU") || s.includes("GOLD")) {
      return { digits: 2, pip: 0.01, minStop: 0.50, name: "GOLD" };
    }
    if (s.includes("JPY")) {
      return { digits: 3, pip: 0.001, minStop: 0.030, name: "JPY" };
    }
    if (s.includes("BTC") || s.includes("ETH")) {
      return { digits: 2, pip: 1.0, minStop: 10.0, name: "CRYPTO" };
    }
    return { digits: 5, pip: 0.00001, minStop: 0.00030, name: "FOREX" };
  }

  static getPipValue(pair) {
    return this.getSymbolSpecs(pair).pip;
  }

  // ============================================================
  // ATR (True Range Measurement)
  // ============================================================
  static calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    let trs = [];
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];
      // Max(H-L, |H-PC|, |L-PC|)
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

  static detectDisplacement(candles, index) {
    const c = candles[index];
    const bodySize = Math.abs(c.close - c.open);
    const candleSize = c.high - c.low;
    const atr = this.calculateATR(candles.slice(0, index), 14);

    const bodyDominance = bodySize / candleSize > 0.7;
    const atrExpansion = bodySize > atr * 1.2;

    return bodyDominance && atrExpansion;
  }

  static detectOrderBlocks(candles, lookback = 20) {
    const obs = [];
    for (let i = lookback; i < candles.length - 5; i++) {
      const c = candles[i];
      const nextCandles = candles.slice(i + 1, i + 6);
      
      // BULLISH OB: Down candle followed by displacement up
      if (c.close < c.open) {
        const displacement = this.detectDisplacement(candles, i + 1);
        const breaksHigh = candles[i + 1].close > c.high || candles[i + 2].close > c.high;
        
        if (displacement && breaksHigh) {
          obs.push({
            type: "BULLISH_OB",
            high: c.high,
            low: c.low,
            mid: (c.high + c.low) / 2,
            index: i,
            fresh: true,
            mitigated: false
          });
        }
      }

      // BEARISH OB: Up candle followed by displacement down
      if (c.close > c.open) {
        const displacement = this.detectDisplacement(candles, i + 1);
        const breaksLow = candles[i + 1].close < c.low || candles[i + 2].close < c.low;

        if (displacement && breaksLow) {
          obs.push({
            type: "BEARISH_OB",
            high: c.high,
            low: c.low,
            mid: (c.high + c.low) / 2,
            index: i,
            fresh: true,
            mitigated: false
          });
        }
      }
    }

    // Mitigation Logic: Check if price returned to OB
    const last = candles[candles.length - 1];
    obs.forEach(ob => {
      for (let j = ob.index + 3; j < candles.length; j++) {
        if (ob.type === "BULLISH_OB" && candles[j].low <= ob.high) ob.mitigated = true;
        if (ob.type === "BEARISH_OB" && candles[j].high >= ob.low) ob.mitigated = true;
      }
    });

    return obs.filter(ob => !ob.mitigated);
  }

  static detectFairValueGaps(candles, pair) {
    const fvgs = [];
    const specs = this.getSymbolSpecs(pair);
    const minGapPips = 5;
    
    for (let i = 0; i < candles.length - 2; i++) {
      const c1 = candles[i], c3 = candles[i + 2];
      const gapSize = c3.low - c1.high;
      if (gapSize / specs.pip >= minGapPips) {
        fvgs.push({ type: "BULLISH_FVG", top: c3.low, bottom: c1.high, index: i + 1 });
      }
      const gapSizeBear = c1.low - c3.high;
      if (gapSizeBear / specs.pip >= minGapPips) {
        fvgs.push({ type: "BEARISH_FVG", top: c1.low, bottom: c3.high, index: i + 1 });
      }
    }
    return fvgs;
  }

  static detectStructure(candles, lookback = 20) {
    const swingHighs = [], swingLows = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
      const slice = candles.slice(i - lookback, i + lookback + 1);
      if (candles[i].high === Math.max(...slice.map(c => c.high))) swingHighs.push({ price: candles[i].high, index: i });
      if (candles[i].low === Math.min(...slice.map(c => c.low)))   swingLows.push({ price: candles[i].low,  index: i });
    }

    const structure = [];
    const last = candles[candles.length - 1];
    if (swingHighs.length >= 2 && last.close > swingHighs[swingHighs.length - 2].price)
      structure.push({ type: "BOS_BULLISH", level: swingHighs[swingHighs.length - 2].price });
    if (swingLows.length >= 2 && last.close < swingLows[swingLows.length - 2].price)
      structure.push({ type: "BOS_BEARISH", level: swingLows[swingLows.length - 2].price });

    return { structure, swingHighs, swingLows };
  }

  static getSessionStatus() {
    const hour = new Date().getUTCHours();
    const london = hour >= 8 && hour <= 16;
    const ny = hour >= 13 && hour <= 21;
    return { london, ny, highLiquidity: london || ny };
  }
}

function analyzeAll(candles, pair = "EURUSD") {
  const specs = InstitutionalSMC.getSymbolSpecs(pair);
  const obs = InstitutionalSMC.detectOrderBlocks(candles);
  const fvgs = InstitutionalSMC.detectFairValueGaps(candles, pair);
  const structureData = InstitutionalSMC.detectStructure(candles);
  const session = InstitutionalSMC.getSessionStatus();

  return {
    obs,
    fvgs,
    structure: structureData.structure,
    session,
    specs
  };
}

module.exports = { InstitutionalSMC, analyzeAll };
