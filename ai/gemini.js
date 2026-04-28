/**
 * ============================================================
 *  APEX SMC — ai/gemini.js
 *  Integração com Google Gemini AI para análise de bias.
 * ============================================================
 */

const fetch = require("node-fetch");
const config = require("../config/config");
const log = require("../utils/logger");

async function analyzeBias(pair, marketSummary) {
  const apiKey = config.credentials.geminiApiKey;
  if (!apiKey || apiKey === "COLOQUE_AQUI_SUA_CHAVE_GEMINI") {
    log.warn(`[AI] Chave Gemini não configurada. Usando bias neutro.`);
    return { bias: "neutral", confidence: 0 };
  }

  const prompt = `
Você é um analista especialista em Smart Money Concepts (SMC).
Analise os dados abaixo para o par ${pair} e determine o bias direcional (bullish, bearish ou neutral).
Responda APENAS em formato JSON: {"bias": "bullish/bearish/neutral", "confidence": 0-100, "reason": "explicação curta"}

DADOS:
${JSON.stringify(marketSummary)}
  `.trim();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());
    
    log.info(`[AI] Bias ${pair}: ${result.bias.toUpperCase()} (${result.confidence}%)`);
    return result;
  } catch (e) {
    log.error(`[AI] Erro ao analisar bias para ${pair}: ${e.message}`);
    return { bias: "neutral", confidence: 0 };
  }
}

module.exports = { analyzeBias };
