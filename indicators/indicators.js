/**
 * ============================================================
 *  APEX SMC — indicators/indicators.js
 *  Todos os indicadores técnicos calculados localmente.
 *  Sem dependências externas — matemática pura.
 * ============================================================
 */

const cfg = require("../config/config").indicators;

// ── EMA ───────────────────────────────────────────────────
function ema(data, period) {
  if (data.length < period) return [];
  const k   = 2 / (period + 1);
  let   val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = new Array(period - 1).fill(null);
  out.push(val);
  for (let i = period; i < data.length; i++) {
    val = data[i] * k + val * (1 - k);
    out.push(val);
  }
  return out;
}

// ── SMA ───────────────────────────────────────────────────
function sma(data, period) {
  const out = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    out.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return out;
}

// ── ATR ───────────────────────────────────────────────────
function atr(highs, lows, closes, period = cfg.atr.period) {
  const tr = [null];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    ));
  }
  const validTr = tr.filter(v => v !== null);
  if (validTr.length < period) return [];

  let atrVal = validTr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out  = new Array(period).fill(null);
  out.push(atrVal);
  for (let i = period; i < validTr.length; i++) {
    atrVal = (atrVal * (period - 1) + validTr[i]) / period;
    out.push(atrVal);
  }
  return out;
}

// ── RSI ───────────────────────────────────────────────────
function rsi(closes, period = cfg.rsi.period) {
  if (closes.length < period + 1) return [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  const out = new Array(period).fill(null);
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d,  0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}

// ── MACD ─────────────────────────────────────────────────
function macd(closes, fast = cfg.macd.fast, slow = cfg.macd.slow, signal = cfg.macd.signal) {
  const emaFast   = ema(closes, fast);
  const emaSlow   = ema(closes, slow);
  const macdLine  = emaFast.map((v, i) =>
    v !== null && emaSlow[i] !== null ? v - emaSlow[i] : null
  );
  const validMacd = macdLine.filter(v => v !== null);
  const sigLine   = ema(validMacd, signal);
  const nullCount = macdLine.filter(v => v === null).length;
  const histogram = macdLine.map((v, i) => {
    const si = i - nullCount - (signal - 1);
    return v !== null && si >= 0 && sigLine[si] !== null ? v - sigLine[si] : null;
  });
  return { macdLine, sigLine, histogram };
}

// ── BOLLINGER BANDS ───────────────────────────────────────
function bollingerBands(closes, period = cfg.bb.period, stdDev = cfg.bb.stdDev) {
  const out = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((a, b) => a + b, 0) / period;
    const std   = Math.sqrt(slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period);
    out.push({ upper: mean + std * stdDev, middle: mean, lower: mean - std * stdDev, std });
  }
  return out;
}

// ── FIBONACCI ────────────────────────────────────────────
function fibonacci(high, low) {
  const diff = high - low;
  return {
    r3: high + diff * 1.618,
    r2: high + diff * 0.618,
    r1: high + diff * 0.382,
    pivot: (high + low) / 2,
    s1: low - diff * 0.382,
    s2: low - diff * 0.618,
    s3: low - diff * 1.618,
  };
}

/**
 * Calcula todos os indicadores de uma vez
 * @param {Array} candles - Array de { open, high, low, close }
 * @returns {Object} Todos os valores dos indicadores
 */
function calcAll(candles) {
  const closes = candles.map(c => c.close);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const n      = candles.length;

  const emaFast = ema(closes, cfg.ema.fast);
  const emaSlow = ema(closes, cfg.ema.slow);
  const rsiVals = rsi(closes);
  const atrVals = atr(highs, lows, closes);
  const macdRes = macd(closes);
  const bbVals  = bollingerBands(closes);

  // Últimos valores (mais recentes)
  const last = {
    emaFast:   emaFast[n - 1],
    emaSlow:   emaSlow[n - 1],
    rsi:       rsiVals[n - 1],
    rsiPrev:   rsiVals[n - 2],
    atr:       atrVals[atrVals.length - 1],
    macd:      macdRes.macdLine[n - 1],
    macdSig:   macdRes.sigLine[macdRes.sigLine.length - 1],
    macdHist:  macdRes.histogram[n - 1],
    macdHistP: macdRes.histogram[n - 2],
    bb:        bbVals[n - 1],
    close:     closes[n - 1],
    high:      highs[n - 1],
    low:       lows[n - 1],
    open:      candles[n - 1].open,
  };

  return { emaFast, emaSlow, rsiVals, atrVals, macdRes, bbVals, last };
}

module.exports = { ema, sma, atr, rsi, macd, bollingerBands, fibonacci, calcAll };
