/**
 * ============================================================
 * APEX SMC — ANALYSIS CORE
 * ============================================================
 */

class SMCDetector {
  static getSymbolSpecs(symbol) {
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

  static detectOrderBlocks(candles, lookback = 10) {
    const obs = [];
    for (let i = lookback; i < candles.length - 3; i++) {
      const c = candles[i];
      const impulse = candles.slice(i + 1, i + 4);
      if (c.close < c.open) {
        const impUp = impulse.every(ic => ic.close > ic.open);
        const range = impulse.reduce((mx, ic) => Math.max(mx, ic.close - ic.open), 0);
        if (impUp && range > (c.high - c.low) * 1.5) {
          obs.push({ type: "BULLISH_OB", high: c.high, low: c.low, mid: (c.high + c.low) / 2, index: i, strength: range / (c.high - c.low) });
        }
      }
      if (c.close > c.open) {
        const impDn = impulse.every(ic => ic.close < ic.open);
        const range = impulse.reduce((mx, ic) => Math.max(mx, ic.open - ic.close), 0);
        if (impDn && range > (c.high - c.low) * 1.5) {
          obs.push({ type: "BEARISH_OB", high: c.high, low: c.low, mid: (c.high + c.low) / 2, index: i, strength: range / (c.high - c.low) });
        }
      }
    }
    return obs;
  }

  static detectFairValueGaps(candles, minGapPips = 5) {
    const fvgs = [];
    const pip = 0.0001;
    for (let i = 0; i < candles.length - 2; i++) {
      const c1 = candles[i], c3 = candles[i + 2];
      if (c3.low > c1.high && (c3.low - c1.high) / pip >= minGapPips)
        fvgs.push({ type: "BULLISH_FVG", top: c3.low, bottom: c1.high, index: i + 1, gapSize: (c3.low - c1.high) / pip });
      if (c3.high < c1.low && (c1.low - c3.high) / pip >= minGapPips)
        fvgs.push({ type: "BEARISH_FVG", top: c1.low, bottom: c3.high, index: i + 1, gapSize: (c1.low - c3.high) / pip });
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
      structure.push({ type: "BOS_BULLISH", level: swingHighs[swingHighs.length - 2].price, confirmed: true });
    if (swingLows.length >= 2 && last.close < swingLows[swingLows.length - 2].price)
      structure.push({ type: "BOS_BEARISH", level: swingLows[swingLows.length - 2].price, confirmed: true });
    if (swingHighs.length && swingLows.length) {
      const lh = swingHighs[swingHighs.length - 1], ll = swingLows[swingLows.length - 1];
      if (ll.index > lh.index && last.close > lh.price) structure.push({ type: "CHOCH_BULLISH", level: lh.price, confirmed: true });
      if (lh.index > ll.index && last.close < ll.price) structure.push({ type: "CHOCH_BEARISH", level: ll.price, confirmed: true });
    }
    return { structure, swingHighs, swingLows };
  }

  static detectLiquidity(candles, tolerance = 0.0005) {
    const equalHighs = [], equalLows = [];
    for (let i = 0; i < candles.length - 1; i++) {
      for (let j = i + 1; j < candles.length; j++) {
        if (Math.abs(candles[i].high - candles[j].high) <= tolerance)
          equalHighs.push({ level: (candles[i].high + candles[j].high) / 2, indices: [i, j] });
        if (Math.abs(candles[i].low - candles[j].low) <= tolerance)
          equalLows.push({ level: (candles[i].low + candles[j].low) / 2, indices: [i, j] });
      }
    }
    return { equalHighs, equalLows };
  }

  static detectLiquiditySweep(candles, swingHighs, swingLows) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    
    // Sweep de Liquidez Bullish (Preço limpa fundo e sobe)
    let bullishSweep = false;
    const lastSwingLow = swingLows[swingLows.length - 1]?.price || 0;
    if (lastSwingLow > 0 && prev.low < lastSwingLow && last.close > lastSwingLow) {
      bullishSweep = true;
    }

    // Sweep de Liquidez Bearish (Preço limpa topo e desce)
    let bearishSweep = false;
    const lastSwingHigh = swingHighs[swingHighs.length - 1]?.price || 0;
    if (lastSwingHigh > 0 && prev.high > lastSwingHigh && last.close < lastSwingHigh) {
      bearishSweep = true;
    }

    return { bullishSweep, bearishSweep };
  }
}

function analyzeAll(candles) {
  const obs = SMCDetector.detectOrderBlocks(candles);
  const fvgs = SMCDetector.detectFairValueGaps(candles);
  const structureData = SMCDetector.detectStructure(candles);
  const liquidity = SMCDetector.detectLiquidity(candles);
  const sweeps = SMCDetector.detectLiquiditySweep(candles, structureData.swingHighs, structureData.swingLows);

  return {
    obs,
    fvgs,
    structure: structureData.structure,
    swingHighs: structureData.swingHighs,
    swingLows: structureData.swingLows,
    liquidity,
    sweeps
  };
}

module.exports = { SMCDetector, analyzeAll };
