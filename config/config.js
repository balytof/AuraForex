/**
 * ============================================================
 *  APEX SMC — config/config.js
 *  Todas as configurações do sistema num só lugar.
 *
 *  PARA MUDAR DE BROKER: altere apenas credentials.provider
 *  Opções: "oanda" | "fxcm" | "alphavantage" | "twelvedata"
 *          "mt5"   | "binance" | "csv"
 * ============================================================
 */

module.exports = {

  // ── PROVIDER ACTIVO ───────────────────────────────────────
  credentials: {
    provider: process.env.DATA_PROVIDER || "oanda",

    // Gemini AI (obrigatório)
    // Chave gratuita: https://aistudio.google.com/app/apikey
    geminiApiKey:    process.env.GEMINI_API_KEY    || "COLOQUE_AQUI_SUA_CHAVE_GEMINI",

    // OANDA — conta demo gratuita: oanda.com/register
    oandaApiKey:     process.env.OANDA_API_KEY     || "",
    oandaAccountId:  process.env.OANDA_ACCOUNT_ID  || "",
    oandaEnv:        "practice",

    // FXCM — conta demo: fxcm.com
    fxcmApiKey:      process.env.FXCM_API_KEY      || "",

    // Alpha Vantage — gratuito 25 req/dia: alphavantage.co/support/#api-key
    alphaVantageKey: process.env.ALPHA_VANTAGE_KEY || "",

    // Twelve Data — gratuito 8 req/min: twelvedata.com/register
    twelveDataKey:   process.env.TWELVE_DATA_KEY   || "",

    // MT5 — pasta onde o script MQL5 exporta os CSVs
    mt5DataPath:     process.env.MT5_DATA_PATH     || "./mt5_data",

    // Binance — dados públicos, sem chave para leitura
    binanceApiKey:   process.env.BINANCE_API_KEY   || "",

    // CSV local — para backtesting ou dados exportados
    csvDataPath:     process.env.CSV_DATA_PATH     || "./csv_data",

    // Saldo simulado para providers sem conta (alphavantage, twelvedata, csv, binance)
    simulatedBalance: 10000,
  },

  // ── PARES MONITORADOS ─────────────────────────────────────
  pairs: ["EUR_USD", "GBP_USD", "USD_JPY", "XAU_USD", "GBP_JPY"],

  // ── TIMEFRAMES ────────────────────────────────────────────
  timeframes: {
    htf: "H4",
    mtf: "H1",
    ltf: "M15",
  },

  // ── INDICADORES ───────────────────────────────────────────
  indicators: {
    ema:  { fast: 50, slow: 200 },
    rsi:  { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 },
    atr:  { period: 14, slMultiplier: 1.8, tpMultiplier: 2.0 }, // Reduzido de 3.2 para 2.0
    bb:   { period: 20, stdDev: 2 },
  },

  // ── GESTÃO DE RISCO ───────────────────────────────────────
  risk: {
    riskPerTradePct:  1.5,
    maxOpenTrades:    3,
    maxDailyLossPct:  5.0,
    minRR:            1.2, // Reduzido de 1.5 para 1.2
    minConfluence:    55,
    trailingAtrMult:  1.5,
    pipValueUSD:      10,
    simulatedBalance: 10000,
  },

  // ── SESSÕES DE MERCADO (UTC) ──────────────────────────────
  sessions: {
    london:  { open: 7,  close: 16 },
    newYork: { open: 12, close: 21 },
  },

  // ── CICLO DO BOT ─────────────────────────────────────────
  bot: {
    intervalSeconds: 60,
    candleCount:     250,
    demoMode:        true,
    logLevel:        "info",
  },
};
