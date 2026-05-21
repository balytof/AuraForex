// ============================================================
// APEX SMC — SIGNAL ENGINE PRO (MAGIC VERSION)
// ============================================================

const config = require("../config/config");
const { calcAll } = require("../indicators/indicators");

function getPrecision(pair = "") {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 2;
  if (pair.includes("JPY")) return 3;
  return 5;
}

function normalizePrice(price, pair = "") {
  const p = getPrecision(pair);
  return Number(Math.round(price + "e" + p) + "e-" + p);
}

function validatePriceRange(pair, price) {
  const p = String(pair).toUpperCase();
  if (p.includes("XAU") || p.includes("GOLD")) return price > 500;
  if (p.includes("JPY")) return price > 50 && price < 300;
  if (p.includes("EUR") || p.includes("GBP") || p.includes("USD") || p.includes("AUD")) return price > 0.3 && price < 3.0;
  return true;
}

const recentSignals = new Map();

function generateSignal(pair, candles, htfBias = "NEUTRAL") {
  // Reduzido para 5 minutos (300000 ms) para permitir mais sinais
  const SIGNAL_COOLDOWN = 5 * 60 * 1000;

  if (!candles || candles.length < 100) return { signal: null, reason: "Velas insuficientes" };

  try {
    const ind = calcAll(candles);
    const { last } = ind;
    
    // 🔧 1. CORRIGIR CÁLCULO DO ATR (SEGURO)
    const atr = last.atr;
    if (!atr || atr <= 0) return { signal: null, reason: "ATR inválido" };

    // ── TRAVA DE SANIDADE DE PREÇO
    if (!validatePriceRange(pair, last.close)) return { signal: null, reason: `Preço corrompido para ${pair}` };

    // 🚀 2. USAR MARGEM MÍNIMA DE SEGURANÇA
    const minStop = atr * 2.0; 
    let stopDist = Math.max(atr * 4.0, minStop);
    
    // 🚀 5. 🚨 CORREÇÃO PARA XAUUSD (OBRIGATÓRIO)
    if (pair.includes("XAU") || pair.includes("GOLD")) {
      if (stopDist < 1.0) stopDist = 1.0; // Em vez de rejeitar, forçamos um stop mínimo de $1 (100 pips)
    }

    const entry = normalizePrice(last.close, pair);

    // ================= BUY =================
    if ((htfBias === "BULLISH" || (htfBias === "NEUTRAL" && last.emaFast > last.emaSlow))) {
      const sl = normalizePrice(entry - stopDist, pair);
      const tp = normalizePrice(entry + (stopDist * 1.5), pair);

      // 🔧 3. CORRIGIR SL/TP COM VALIDAÇÃO LÓGICA
      if (sl >= entry || tp <= entry) return { signal: null, reason: "SL/TP inválido BUY" };

      // 🔧 4. 🔥 FILTRO ANTI-INVALID STOPS (ESSENCIAL)
      const minDistance = atr * 1.5;
      if (Math.abs(entry - sl) < minDistance || Math.abs(entry - tp) < minDistance) {
        return { signal: null, reason: "Stops muito próximos (anti-invalid)" };
      }

      const signalKey = `${pair}_BUY`;
      if (recentSignals.get(signalKey) && (Date.now() - recentSignals.get(signalKey) < SIGNAL_COOLDOWN)) return { signal: null, reason: "Cooldown ativo" };

      recentSignals.set(signalKey, Date.now());
      return {
        signal: { pair, direction: "BUY", entry: 0, sl, tp, atr, magic: true, timestamp: Date.now() },
        reason: "Sinal COMPRA MAGIC"
      };
    }

    // ================= SELL =================
    if ((htfBias === "BEARISH" || (htfBias === "NEUTRAL" && last.emaFast < last.emaSlow))) {
      const sl = normalizePrice(entry + stopDist, pair);
      const tp = normalizePrice(entry - (stopDist * 1.5), pair);

      // 🔧 3. CORRIGIR SL/TP COM VALIDAÇÃO LÓGICA
      if (sl <= entry || tp >= entry) return { signal: null, reason: "SL/TP inválido SELL" };

      // 🔧 4. 🔥 FILTRO ANTI-INVALID STOPS (ESSENCIAL)
      const minDistance = atr * 1.5;
      if (Math.abs(entry - sl) < minDistance || Math.abs(entry - tp) < minDistance) {
        return { signal: null, reason: "Stops muito próximos (anti-invalid)" };
      }

      const signalKey = `${pair}_SELL`;
      if (recentSignals.get(signalKey) && (Date.now() - recentSignals.get(signalKey) < SIGNAL_COOLDOWN)) return { signal: null, reason: "Cooldown ativo" };

      recentSignals.set(signalKey, Date.now());
      return {
        signal: { pair, direction: "SELL", entry: 0, sl, tp, atr, magic: true, timestamp: Date.now() },
        reason: "Sinal VENDA MAGIC"
      };
    }

  } catch (e) {
    return { signal: null, reason: "Erro motor: " + e.message };
  }
  return { signal: null, reason: "Sem tendência" };
}

module.exports = { generateSignal };
