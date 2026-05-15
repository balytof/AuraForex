/**
 * ============================================================
 * APEX SMC — INSTITUTIONAL ANALYSIS ENGINE v2
 * ============================================================
 */

class InstitutionalSMC {
  // ============================================================
  // INSTITUTIONAL SYMBOL SPECS (Exact User Spec)
  // ============================================================
  static getSymbolSpecs(symbol) {
    const s = symbol.toUpperCase();
    
    // GOLD
    if (s.includes("XAU") || s.includes("GOLD")) {
      return {
        digits: 2,
        point: 0.01,
        pip: 0.1,
        minStopPips: 50,  // $5.00 move
        maxStopPips: 500, // $50.00 move
        name: "GOLD"
      };
    }
    
    // JPY
    if (s.includes("JPY")) {
      return {
        digits: 3,
        point: 0.001,
        pip: 0.01,
        minStopPips: 10,
        maxStopPips: 100,
        name: "JPY"
      };
    }
    
    // FOREX DEFAULT
    return {
      digits: 5,
      point: 0.00001,
      pip: 0.0001,
      minStopPips: 10,
      maxStopPips: 100,
      name: "FOREX"
    };
  }

  // ============================================================
  // UNIT CONVERTERS
  // ============================================================
  static atrToPips(atr, symbol) {
    const specs = this.getSymbolSpecs(symbol);
    return atr / specs.pip;
  }

  static calculateInstitutionalSL(entry, atr, direction, symbol) {
    const specs = this.getSymbolSpecs(symbol);
    let atrPips = this.atrToPips(atr, symbol);

    // Institutional Clamp: Garante que o stop não seja absurdo
    atrPips = Math.max(specs.minStopPips, atrPips);
    atrPips = Math.min(specs.maxStopPips, atrPips);

    const stopDistance = atrPips * specs.pip;
    let sl = (direction === "BUY") ? (entry - stopDistance) : (entry + stopDistance);
    
    return Number(sl.toFixed(specs.digits));
  }

  static calculateInstitutionalTP(entry, atr, direction, symbol, multiplier = 2.0) {
    const specs = this.getSymbolSpecs(symbol);
    let atrPips = this.atrToPips(atr, symbol);
    
    // TP Clamp: Mínimo 1.5:1 do minStop
    atrPips = Math.max(specs.minStopPips * 1.5, atrPips * multiplier);
    
    const tpDistance = atrPips * specs.pip;
    let tp = (direction === "BUY") ? (entry + tpDistance) : (entry - tpDistance);
    
    return Number(tp.toFixed(specs.digits));
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
    if (!atr) return false;

    const bodyDominance = bodySize / candleSize > 0.7;
    const atrExpansion = bodySize > atr * 1.2;

    return bodyDominance && atrExpansion;
  }

  static detectOrderBlocks(candles, lookback = 20) {
    const obs = [];
    for (let i = lookback; i < candles.length - 5; i++) {
      const c = candles[i];
      if (c.close < c.open) {
        const displacement = this.detectDisplacement(candles, i + 1);
        if (displacement && candles[i + 1].close > c.high) {
          obs.push({ type: "BULLISH_OB", high: c.high, low: c.low, index: i, mitigated: false });
        }
      }
      if (c.close > c.open) {
        const displacement = this.detectDisplacement(candles, i + 1);
        if (displacement && candles[i + 1].close < c.low) {
          obs.push({ type: "BEARISH_OB", high: c.high, low: c.low, index: i, mitigated: false });
        }
      }
    }
    return obs;
  }

  static analyzeAll(candles, pair = "EURUSD") {
    const specs = this.getSymbolSpecs(pair);
    const obs = this.detectOrderBlocks(candles);
    const atr = this.calculateATR(candles, 14);

    return { obs, atr, specs };
  }
}

const analyzeAll = InstitutionalSMC.analyzeAll.bind(InstitutionalSMC);
module.exports = { InstitutionalSMC, analyzeAll };
