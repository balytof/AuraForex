/**
 * ============================================================
 * APEX SMC — ANALYSIS CORE
 * ============================================================
 */

class SMCDetector {
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
}

function analyzeAll(candles) {
  const obs = SMCDetector.detectOrderBlocks(candles);
  const fvgs = SMCDetector.detectFairValueGaps(candles);
  const structureData = SMCDetector.detectStructure(candles);
  const liquidity = SMCDetector.detectLiquidity(candles);

  return {
    obs,
    fvgs,
    structure: structureData.structure,
    swingHighs: structureData.swingHighs,
    swingLows: structureData.swingLows,
    liquidity
  };
}

module.exports = { SMCDetector, analyzeAll };
