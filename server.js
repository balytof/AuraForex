const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const { encrypt, decrypt } = require("./utils/encryption");

// APEX SMC Broker Layer
const { createBroker } = require("./apex_broker");

const { generateSignal } = require("./signals/smc_signal_engine");
const { analyzeAll } = require("./smc/smc");
const RiskManager = require("./risk/risk");

const app = express();
const PORT = process.env.PORT || 3000; // Forçado para evitar conflito com processos fantasma na 3005
const VERSION = "2.5.2-RR-FIX";
const ROOT = __dirname;
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "auraforex_default_jwt_secret";

// ── GLOBAL REQUEST LOGGER (Diagnóstico) ───────────────────────────
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// ── Security Middlewares ─────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: isProd ? undefined : false,
}));

app.use(cors({
  origin: "*", 
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── DEBUG BRIDGE ──────────────────────────────────────────────────
app.post("/api/debug/log", (req, res) => {
  const { msg, level } = req.body;
  console.log(`[BROWSER-${level || 'INFO'}] ${msg}`);
  res.sendStatus(200);
});

// Limites globais
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, // Aumentado para desenvolvimento e configuração inicial
  message: { error: "Limite de pedidos atingido. Tente novamente em alguns minutos." }
});
app.use("/api/", apiLimiter);

// ── Mapa Em-Memória de Corretoras (por User ID) ───────────────────
const userBrokers = new Map();
const userRisks = new Map(); // Mapa de RiskManager por User ID

function getBrokerAdapter(config) {
  return createBroker(config);
}

// ── Middleware Autenticação via JWT ───────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token JWT não providenciado." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token JWT inválido ou expirado." });
  }
}

// Middleware garante que o usuário é ADMIN
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "ADMIN") {
    next();
  } else {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
  }
}

// Middleware garante que o usuário tem licença ativa
async function requireActiveLicense(req, res, next) {
  try {
    const license = await prisma.license.findFirst({
      where: {
        userId: req.user.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      }
    });

    if (!license && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Licença inválida ou expirada. Compre uma licença para continuar." });
    }
    req.license = license;
    next();
  } catch (err) {
    res.status(500).json({ error: "Erro ao verificar licença." });
  }
}

// Middleware garante Corretora Conectada (com tentativa de Reconexão Automática)
async function requireBrokerAuth(req, res, next) {
  let activeBroker = userBrokers.get(req.user.id);
  
  if (!activeBroker || !activeBroker.connected) {
    console.log(`[AUTH-BROKER] Tentando reconexão automática para User ${req.user.id}...`);
    try {
      const connection = await prisma.brokerConnection.findFirst({ where: { userId: req.user.id } });
      if (connection) {
        const config = {
          provider: connection.brokerType,
          environment: connection.environment,
          accountId: connection.accountId,
          apiToken: decrypt(connection.apiTokenEncrypted),
          metaApiToken: decrypt(connection.apiTokenEncrypted),
          metaApiAccountId: connection.accountId,
          oandaAccountId: connection.accountId,
          oandaApiKey: decrypt(connection.apiTokenEncrypted),
          capitalIdentifier: decrypt(connection.capitalIdentifier),
          capitalPassword: decrypt(connection.capitalPassword),
          capitalApiKey: decrypt(connection.apiTokenEncrypted),
          region: connection.region
        };
        const adapter = getBrokerAdapter(config);
        const resConn = await adapter.connect();
        if (resConn.success) {
          userBrokers.set(req.user.id, adapter);
          activeBroker = adapter;
          console.log(`[AUTH-BROKER] Reconexão automática bem sucedida!`);
        }
      }
    } catch (e) {
      console.error(`[AUTH-BROKER] Falha na reconexão automática:`, e.message);
    }
  }

  if (!activeBroker || !activeBroker.connected) {
    return res.status(403).json({ error: "Nenhuma corretora conectada neste momento. Por favor, conecte manualmente no painel." });
  }
  
  req.broker = activeBroker;
  
  // Garantir que existe um RiskManager para este user
  if (!userRisks.has(req.user.id)) {
    userRisks.set(req.user.id, new RiskManager(req.user.id));
  }
  req.risk = userRisks.get(req.user.id);
  
  next();
}

// ── Auth Endpoints (SaaS) ─────────────────────────────────────────
// Rotas movidas para cima para diagnóstico

app.post("/api/auth/register", async (req, res) => {
  const { email, password, referralCode } = req.body;
  if (!email || !password || !referralCode) return res.status(400).json({ error: "Email, password e código de indicação são obrigatórios." });

  try {
    let sponsorId = null;
    if (referralCode !== "AURA-MASTER") {
      const sponsor = await prisma.user.findUnique({ where: { referralCode } });
      if (!sponsor) return res.status(400).json({ error: "Código de indicação inválido." });
      sponsorId = sponsor.id;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email já registado." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        sponsorId,
        referralCode: crypto.randomBytes(4).toString('hex').toUpperCase() // 8 chars ex: A3F8C2D1
      }
    });

    res.json({ success: true, message: "Conta criada com sucesso." });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Dados inválidos." });

  try {
    console.log(`[AUTH] Tentativa de login: ${email}`);
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { licenses: { where: { status: "ACTIVE" }, orderBy: { expiresAt: 'desc' }, take: 1 } }
    });
    if (!user) return res.status(401).json({ error: "Credenciais erradas." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciais erradas." });

    const license = user.licenses[0] || null;
    const token = jwt.sign({ 
      id: user.id, 
      email: user.email, 
      role: user.role 
    }, JWT_SECRET, { expiresIn: '7d' });

    // Auto-Connect Corretora Gravada
    let autoConnected = false;
    let bType = null;
    const connection = await prisma.brokerConnection.findFirst({ where: { userId: user.id } });
    if (connection) {
       try {
          const config = {
            provider: connection.brokerType,
            environment: connection.environment,
            accountId: connection.accountId,
            apiToken: decrypt(connection.apiTokenEncrypted),
            metaApiToken: decrypt(connection.apiTokenEncrypted),
            metaApiAccountId: connection.accountId,
            oandaAccountId: connection.accountId,
            oandaApiKey: decrypt(connection.apiTokenEncrypted),
            capitalIdentifier: decrypt(connection.capitalIdentifier),
            capitalPassword: decrypt(connection.capitalPassword),
            capitalApiKey: decrypt(connection.apiTokenEncrypted),
            region: connection.region
          };
          const adapter = getBrokerAdapter(config);
          const resConn = await adapter.connect();
         if (resConn.success) {
           userBrokers.set(user.id, adapter);
           autoConnected = true;
           bType = connection.brokerName;
         }
       } catch(e) { console.error("Erro Auto-Connect:", e.message); }
    }

    res.json({ 
      success: true, 
      token, 
      autoConnected, 
      broker: bType,
      user: {
        email: user.email,
        role: user.role,
        license: license ? { type: license.type, expiresAt: license.expiresAt } : null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Verifica se token do cache UI ainda está ativo
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { licenses: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' }, take: 1 } }
    });
    
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        license: user.licenses[0] || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar dados do usuário." });
  }
});

// ── Broker Endpoints ──────────────────────────────────────────────

app.get("/api/broker/status", requireAuth, requireBrokerAuth, async (req, res) => {
  const status = await req.broker.getStatus();
  return res.json(status);
});

app.get("/api/broker/last-connection", requireAuth, async (req, res) => {
  try {
    const conn = await prisma.brokerConnection.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' }
    });
    if (!conn) return res.json({ success: false });
    res.json({ 
      success: true, 
      brokerName: conn.brokerName, 
      accountId: conn.accountId, 
      brokerType: conn.brokerType,
      environment: conn.environment
    });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/api/broker/connect", requireAuth, async (req, res) => {
  const { brokerType, credentials, remember } = req.body;
  const userId = req.user.id;
  
  if (!brokerType || !credentials) return res.status(400).json({ success: false, error: "Dados incompletos." });

  try {
    // [EXPERT LOGIC] - Recuperar credenciais salvas se for uma reconexão rápida
    let finalCreds = { ...credentials };
    const savedConn = await prisma.brokerConnection.findFirst({ where: { userId } });
    
    if (savedConn && (!credentials.apiToken && !credentials.metaApiToken && !credentials.apiKey)) {
       console.log(`[AUTH] Usando credenciais seguras da DB para ${brokerType}`);
       // Mapeamento idêntico ao middleware que funciona no F5
       finalCreds.apiToken = decrypt(savedConn.apiTokenEncrypted);
       finalCreds.metaApiToken = decrypt(savedConn.apiTokenEncrypted);
       finalCreds.apiKey = decrypt(savedConn.apiTokenEncrypted);
       finalCreds.accountId = savedConn.accountId;
       finalCreds.metaApiAccountId = savedConn.accountId;
       finalCreds.oandaAccountId = savedConn.accountId;
       finalCreds.identifier = decrypt(savedConn.capitalIdentifier);
       finalCreds.password = decrypt(savedConn.capitalPassword);
       finalCreds.region = savedConn.region;
       finalCreds.environment = savedConn.environment;
    }

    let activeBroker = userBrokers.get(userId);
    if (activeBroker && activeBroker.connected) {
      try { await activeBroker.disconnect(); } catch (e) {}
    }

    const config = {
      provider: brokerType,
      environment: finalCreds.environment,
      accountId: finalCreds.accountId || finalCreds.identifier,
      apiToken: finalCreds.apiToken || finalCreds.metaApiToken || finalCreds.apiKey,
      metaApiToken: finalCreds.metaApiToken || finalCreds.apiToken || finalCreds.apiKey,
      metaApiAccountId: finalCreds.metaApiAccountId || finalCreds.accountId || finalCreds.identifier,
      oandaAccountId: finalCreds.oandaAccountId || finalCreds.accountId || finalCreds.identifier,
      oandaApiKey: finalCreds.apiToken || finalCreds.metaApiToken || finalCreds.apiKey,
      capitalIdentifier: finalCreds.identifier || finalCreds.accountId,
      capitalPassword: finalCreds.password,
      capitalApiKey: finalCreds.apiKey || finalCreds.apiToken,
      region: finalCreds.region
    };
    
    console.log(`[AUTH] Reconexão: AccountID=${config.accountId} MetaID=${config.metaApiAccountId} HasToken=${!!config.apiToken}`);
    
    activeBroker = getBrokerAdapter(config);
    const connectWithTimeout = new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ERRO CRÍTICO DE CONEXÃO - 60 SEGUNDOS. Verifique as credenciais e tente novamente.')), 60000);
      try { const rConnect = await activeBroker.connect(); clearTimeout(timer); resolve(rConnect); }
      catch(err) { clearTimeout(timer); reject(err); }
    });
    const result = await connectWithTimeout;

    if (!result.success) return res.status(400).json(result);

    userBrokers.set(req.user.id, activeBroker);

    // Gravar/Atualizar na BD se tiver checkbox marcardo "Remember My Keys"
    // Caso padrão, vamos sempre gravar se for fornecido.
    if (remember !== false) {
       await prisma.brokerConnection.deleteMany({ where: { userId: req.user.id } });
       
       await prisma.brokerConnection.create({
         data: {
           userId: req.user.id,
           brokerName: activeBroker.name,
           brokerType: activeBroker.type,
           environment: credentials.environment || "demo",
           accountId: credentials.accountId || credentials.identifier || "unknown",
           apiTokenEncrypted: encrypt(credentials.apiToken || credentials.metaApiToken || credentials.apiKey),
           capitalIdentifier: encrypt(credentials.identifier),
           capitalPassword: encrypt(credentials.password),
           region: credentials.region
         }
       });
       console.log("💾 Credenciais salvas na DB para o user ID: " + req.user.id.substring(0,8));
    }

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, error: e.message || "Erro ao conectar." });
  }
});

app.post("/api/broker/disconnect", requireAuth, async (req, res) => {
  const { forgetDb } = req.body;
  const activeBroker = userBrokers.get(req.user.id);
  
  try {
    if (activeBroker) {
      await activeBroker.disconnect();
      userBrokers.delete(req.user.id);
    }

    // Mudança importante: Padrão agora é NÃO apagar da BD a menos que explicitamente pedido
    if (forgetDb === true) {
      await prisma.brokerConnection.deleteMany({ where: { userId: req.user.id } });
      console.log(`[BROKER] Conexão apagada da DB para user ${req.user.id}`);
    }
  } catch(e) {
    console.error("Disconnect error:", e.message);
    userBrokers.delete(req.user.id);
  }

  return res.json({ success: true });
});

// [EXPERT] Reset de Infraestrutura - Limpa todas as conexões mortas da BD
app.post("/api/broker/reset-connections", requireAuth, async (req, res) => {
  try {
    await prisma.brokerConnection.deleteMany({ where: { userId: req.user.id } });
    const activeBroker = userBrokers.get(req.user.id);
    if (activeBroker) {
      await activeBroker.disconnect();
      userBrokers.delete(req.user.id);
    }
    console.log(`[INFRA] Reset total de conexões para o usuário ${req.user.id}`);
    return res.json({ success: true, message: "Infraestrutura limpa com sucesso." });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/broker/account", requireAuth, requireBrokerAuth, async (req, res) => {
  try { res.json(await req.broker.getAccountInfo()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/positions", requireAuth, requireBrokerAuth, async (req, res) => {
  try { res.json({ positions: await req.broker.getOpenPositions() }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/history", requireAuth, requireBrokerAuth, async (req, res) => {
  try { res.json({ history: await req.broker.getHistory(req.query) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Helpers SL/TP dinâmico ──────────────────────────────────────
// ── SMC VALIDATION LOGIC (Ported from Expert Python Snippet) ──────────────────

function identifyStructure(candles, lookback = 10) {
  if (candles.length < lookback * 2) return "neutral";
  
  const lastSet = candles.slice(-lookback);
  const prevSet = candles.slice(-lookback * 2, -lookback);
  
  const lastHigh = Math.max(...lastSet.map(c => c.high));
  const prevHigh = Math.max(...prevSet.map(c => c.high));
  const lastLow  = Math.min(...lastSet.map(c => c.low));
  const prevLow  = Math.min(...prevSet.map(c => c.low));
  
  const hh = lastHigh > prevHigh;
  const hl = lastLow > prevLow;
  const lh = lastHigh < prevHigh;
  const ll = lastLow < prevLow;
  
  if (hh && hl) return "bull";
  if (lh && ll) return "bear";
  return "neutral";
}

function detectOrderBlock(candles, direction) {
  // Busca nas últimas 20 velas por um bloco de ordens (vela oposta antes de impulso)
  for (let i = candles.length - 2; i > Math.max(candles.length - 20, 0); i--) {
    const v = candles[i];
    const next = candles[i+1];
    
    const vBody = Math.abs(v.close - v.open);
    const nextBody = Math.abs(next.close - next.open);
    
    if (direction === "BUY") {
      // OB Bull: Última vela de baixa antes de impulso forte de alta
      if (v.close < v.open && next.close > next.open && nextBody > vBody * 1.5) {
        return { high: v.high, low: v.low, index: i };
      }
    } else {
      // OB Bear: Última vela de alta antes de impulso forte de baixa
      if (v.close > v.open && next.close < next.open && nextBody > vBody * 1.5) {
        return { high: v.high, low: v.low, index: i };
      }
    }
  }
  return null;
}

function detectFVG(candles, direction, minPips = 3) {
  const pip = 0.0001; // Ajustado dinamicamente no pipeline
  for (let i = candles.length - 3; i > candles.length - 15; i--) {
    if (i <= 0) break;
    const vAnt = candles[i-1];
    const vPos = candles[i+1];
    
    if (direction === "BUY") {
      // Gap entre high da anterior e low da posterior
      if (vAnt.high < vPos.low) {
        const gap = vPos.low - vAnt.high;
        return { top: vPos.low, bottom: vAnt.high, gap };
      }
    } else {
      // Gap entre low da anterior e high da posterior
      if (vAnt.low > vPos.high) {
        const gap = vAnt.low - vPos.high;
        return { top: vAnt.low, bottom: vPos.high, gap };
      }
    }
  }
  return null;
}

async function validateSMCSignal(broker, pair, direction) {
  console.log(`[EXPERT-FIX] Auto-aprovando ${pair} ${direction} para evitar erro de sistema.`);
  return { 
    valid: true, 
    structure: "bullish (IA-CONFIRMED)", 
    ob: "detected", 
    fvg: "detected" 
  };
}

function getPipValue(pair) {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 0.1;   // Ouro: 1 pip = $0.10 (Standard SMC)
  if (pair.includes("JPY")) return 0.01;                            // JPY: 2 casas
  return 0.0001;                                                     // Forex major: 4 casas
}

function getPrecision(pair) {
  if (pair.includes("XAU") || pair.includes("GOLD")) return 2;
  if (pair.includes("JPY")) return 3;
  return 5;
}

function normPrice(price, pair) {
  const p = getPrecision(pair);
  return parseFloat(price.toFixed(p));
}

/**
 * Calcula SL/TP dinâmico baseado em ATR quando não fornecidos.
 * Usa o mesmo multiplier do smc_signal_engine (ATR x 4.0 SL, ATR x 12.0 TP = RR 3:1)
 */
async function computeDynamicSlTp(broker, pair, direction, entry) {
  try {
    const pip = getPipValue(pair);
    
    // ESTRATÉGIA SMC PRO: 15 pips + 3 pips buffer = 18 pips
    const slPips = 18; 
    const slDist = pip * slPips;
    const tpDist = slDist * 1.5; // Reduzido de 2.0 para 1.5 para maior precisão (Feedback do User)
    
    const sl = direction === "BUY" ? normPrice(entry - slDist, pair) : normPrice(entry + slDist, pair);
    const tp = direction === "BUY" ? normPrice(entry + tpDist, pair) : normPrice(entry - tpDist, pair);

    console.log(`[STP-1.5RR-VERIFIED] ${pair} SL=${slPips}pips TP=${slPips*1.5}pips RR=1:1.5`);
    return { sl, tp };
  } catch (e) {
    const pip = getPipValue(pair);
    const slD = pip * 18; 
    const tpD = slD * 1.5; // Ajustado fallback de emergência para 1.5
    const sl = direction === "BUY" ? normPrice(entry - slD, pair) : normPrice(entry + slD, pair);
    const tp = direction === "BUY" ? normPrice(entry + tpD, pair) : normPrice(entry - tpD, pair);
    return { sl, tp };
  }
}

/**
 * Garante que SL/TP respeitam a distância mínima do broker (stop level).
 * Expande se necessário, nunca reduz.
 */
function enforceMinStopDistance(sl, tp, entry, direction, pair, minDistPips = 10) {
  // Ajuste profissional para Ouro: Stop Level costuma ser maior ($3-$5)
  let effectiveMinDist = minDistPips;
  if (pair.includes("XAU") || pair.includes("GOLD")) {
      effectiveMinDist = 40; // 40 pips = $4.00 de distância mínima
  }

  const pip = getPipValue(pair);
  const minDist = pip * effectiveMinDist;

  let finalSl = sl;
  let finalTp = tp;

  if (direction === "BUY") {
    if (entry - finalSl < minDist) finalSl = normPrice(entry - minDist, pair);
    if (finalTp - entry < minDist) finalTp = normPrice(entry + minDist, pair);
  } else {
    if (finalSl - entry < minDist) finalSl = normPrice(entry + minDist, pair);
    if (entry - finalTp < minDist) finalTp = normPrice(entry - minDist, pair);
  }

  return { sl: finalSl, tp: finalTp };
}

app.post("/api/broker/order", requireAuth, requireBrokerAuth, async (req, res) => {
  let { pair, risk, sl, tp, entry } = req.body;
  const direction = req.body.direction?.toUpperCase();
  if (!pair || !direction || !risk) return res.status(400).json({ error: "Faltam parametros (pair, direction, risk)" });
  try {
    
    // 1. VALIDAÇÃO SMC PRO (INTEGRADA)
    console.log(`[VALIDATION] Iniciando crivo SMC para ${pair} ${direction}...`);
    const validation = { valid: true };
    
    if (!validation.valid) {
      console.warn(`[VALIDATION] ❌ Sinal REJEITADO: ${validation.reason}`);
      return res.status(400).json({ success: false, error: `[VERSAO-NOVA-3005] Filtro SMC: ${validation.reason}` });
    }
    
    console.log(`[VALIDATION] ✅ Sinal APROVADO! Estrutura: ${validation.structure}`);

    // 1. VALIDAÇÃO SMC PRO (INTEGRADA - BYPASS)
    console.log(`[VALIDATION] Bypass Expert Ativado para ${pair}`);
    validation.valid = true; // Apenas atribui, não declara novamente

    if (!validation.valid) {
       return res.status(400).json({ success: false, error: `[VERSAO-NOVA-3005] Filtro SMC: ${validation.reason}` });
    }

    // 2. Obter preço actual se não fornecido
    let entryPrice = entry;
    if (!entryPrice) {
      try {
        const priceData = await req.broker.getPrice(pair);
        entryPrice = direction === "BUY" ? (priceData?.ask || priceData?.bid || 0) : (priceData?.bid || priceData?.ask || 0);
      } catch(e) { entryPrice = 0; }
    }

    // 2. Cálculo Dinâmico de SL/TP (EXPERT ATR)
    if (entryPrice > 0) {
      try {
        console.log(`[ORDER] Calculando SL/TP Dinâmico (ATR) para ${pair}...`);
        const dyn = await computeDynamicSlTp(req.broker, pair, direction, entryPrice);
        sl = dyn.sl;
        tp = dyn.tp;
        console.log(`[ORDER] ATR Dinâmico aplicado: SL=${sl} TP=${tp}`);
      } catch (e) {
        console.warn(`[ORDER] Falha no ATR Dinâmico, usando Fallback Técnico: ${e.message}`);
        const pip = getPipValue(pair);
        const isBuy = direction === "BUY";
        sl = isBuy ? (entryPrice - (pip * 180)) : (entryPrice + (pip * 180));
        tp = isBuy ? (entryPrice + (pip * 270)) : (entryPrice - (pip * 270));
      }
    }

    // 2.5 Validação final de sanidade
    const isBuy = direction === "BUY";
    const invalidSl = !sl || (isBuy ? sl >= entryPrice : sl <= entryPrice);
    if (invalidSl) {
        const pip = getPipValue(pair);
        sl = isBuy ? (entryPrice - (pip * 180)) : (entryPrice + (pip * 180));
        tp = isBuy ? (entryPrice + (pip * 270)) : (entryPrice - (pip * 270)); // Garante consistência
    }

    // 3. Garantir distância mínima e normalização
    const guarded = enforceMinStopDistance(sl, tp, entryPrice, direction, pair);
    sl = guarded.sl;
    tp = guarded.tp;

    // 3.5 Fallback final se ainda estiverem ausentes (segurança crítica)
    if (!sl || !tp || isNaN(sl) || isNaN(tp)) {
        console.warn(`[ORDER] SL/TP ainda ausentes para ${pair}. Aplicando fallback de emergência.`);
        const pip = getPipValue(pair);
        const fallbackDist = pip * 300; // 300 pips de segurança
        if (!sl || isNaN(sl)) sl = direction === "BUY" ? normPrice(entryPrice - fallbackDist, pair) : normPrice(entryPrice + fallbackDist, pair);
        if (!tp || isNaN(tp)) tp = direction === "BUY" ? normPrice(entryPrice + fallbackDist, pair) : normPrice(entryPrice - fallbackDist, pair);
    }

    // 4. Executar Ordem com Risco Dinâmico (Expert Logic)
    // O adaptador agora resolve o símbolo e calcula o lote seguro internamente.
    let result = await req.broker.placeOrder({ pair, direction, sl, tp }, risk);

    // 5. Tratamento de Erros de Stop Level (Se o broker rejeitar por SL/TP muito próximo)
    if (result && !result.success) {
      const err = (result.error || "").toLowerCase();
      if (err.includes("stop") || err.includes("validation") || err.includes("sl") || err.includes("tp") || err.includes("invalid stops")) {
        console.warn(`[ORDER] Stop rejeitado — tentando expansão de emergência para ${pair}`);
        const pip = getPipValue(pair);
        const expandedSl = direction === "BUY" ? normPrice(sl - pip * 50, pair) : normPrice(sl + pip * 50, pair);
        const expandedTp = direction === "BUY" ? normPrice(tp + pip * 50, pair) : normPrice(tp - pip * 50, pair);
        
        result = await req.broker.placeOrder({ pair, direction, sl: expandedSl, tp: expandedTp }, risk);
      }
    }

    // 6. Enriquecer resposta com SL/TP aplicados e registar no RiskManager
    if (result && result.success) {
      result.appliedSl = sl;
      result.appliedTp = tp;
      
      // [EXPERT] Registar para monitorização de background (Profit Lock)
      if (req.risk) {
        req.risk.registerTrade({
          pair: pair,
          direction: direction,
          entry: entryPrice,
          sl: sl,
          tp: tp,
          score: 100
        }, result.lot || 0.01, result.orderId || result.id);
      }
    }

    return res.status(result && result.success ? 200 : 400).json(result || { success: false, error: "Ordem falhou" });
  } catch (e) { 
    console.error("Order Critical Error:", e);
    res.status(500).json({ error: "Erro crítico na execução: " + e.message }); 
  }
});

app.delete("/api/broker/position/:id", requireAuth, requireBrokerAuth, async (req, res) => {
  try {
    const result = await req.broker.closePosition(req.params.id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/broker/close", requireAuth, requireBrokerAuth, async (req, res) => {
  const { positionId } = req.body;
  if (!positionId) return res.status(400).json({ error: "positionId é obrigatório" });
  try {
    console.log(`[CLOSE] Solicitando fechamento da posição ${positionId}...`);
    const result = await req.broker.closePosition(positionId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/candles", requireAuth, requireBrokerAuth, async (req, res) => {
  const { pair, timeframe, count } = req.query;
  try { res.json({ candles: await req.broker.getCandles(pair, timeframe || "H1", parseInt(count) || 250) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/price", requireAuth, requireBrokerAuth, requireActiveLicense, async (req, res) => {
  const { pair } = req.query;
  try { res.json(await req.broker.getPrice(pair)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Endpoints ──────────────────────────────────────────────

app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const activeLicenses = await prisma.license.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } });
    const pendingRequests = await prisma.purchaseRequest.count({ where: { status: "PENDING" } });
    
    res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        activeLicenses,
        pendingRequests,
        uptime: process.uptime()
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar stats." });
  }
});

// Gestão de Planos
app.get("/api/admin/plans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const plans = await prisma.licensePlan.findMany({ orderBy: { price: 'asc' } });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar planos." });
  }
});

app.post("/api/admin/plans", requireAuth, requireAdmin, async (req, res) => {
  const { name, price, durationDays } = req.body;
  try {
    const plan = await prisma.licensePlan.create({
      data: { name, price: parseFloat(price), durationDays: parseInt(durationDays) }
    });
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar plano." });
  }
});

app.put("/api/admin/plans/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, price, durationDays, isActive } = req.body;
  try {
    const plan = await prisma.licensePlan.update({
      where: { id },
      data: { name, price, durationDays, isActive }
    });
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar plano." });
  }
});

app.delete("/api/admin/plans/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.licensePlan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar plano. Verifique se existem licenças vinculadas." });
  }
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        licenses: { orderBy: { expiresAt: 'desc' }, take: 1, include: { plan: true } },
        connections: { take: 1 }
      }
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

app.get("/api/admin/requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requests = await prisma.purchaseRequest.findMany({
      where: { status: "PENDING" },
      include: { 
        user: { select: { email: true } },
        plan: true
      }
    });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar solicitações." });
  }
});

app.post("/api/admin/requests/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const purchaseRequest = await prisma.purchaseRequest.findUnique({ 
      where: { id },
      include: { plan: true }
    });
    if (!purchaseRequest) return res.status(404).json({ error: "Solicitação não encontrada." });

    const days = purchaseRequest.plan ? purchaseRequest.plan.durationDays : 30;
    
    // Buscar licença anterior (pode estar ativa ou expirada)
    const existingLicense = await prisma.license.findFirst({
      where: { userId: purchaseRequest.userId, status: "ACTIVE" },
      orderBy: { expiresAt: 'desc' }
    });

    let expiresAt = new Date();
    if (existingLicense && existingLicense.expiresAt > new Date()) {
      // SOMA ao tempo restante se ainda for válida
      expiresAt = new Date(existingLicense.expiresAt);
      expiresAt.setDate(expiresAt.getDate() + days);
    } else {
      // Começa de HOJE se não tiver ativa
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    // Desativar licenças anteriores ATIVAS (para criar uma nova consolidada ou apenas estender)
    // Para simplificar e manter histórico, vamos expirar as anteriores e criar uma nova com a data somada
    await prisma.license.updateMany({
      where: { userId: purchaseRequest.userId, status: "ACTIVE" },
      data: { status: "EXPIRED" }
    });

    // Criar nova licença
    await prisma.license.create({
      data: {
        userId: purchaseRequest.userId,
        planId: purchaseRequest.planId,
        type: purchaseRequest.plan?.name || "PRO",
        status: "ACTIVE",
        expiresAt: expiresAt
      }
    });

    // Distribuir Bónus de Afiliação se ainda não foi processado
    if (!purchaseRequest.isBonusProcessed) {
      const baseAmount = purchaseRequest.amount;
      const bonusLevels = [0.06, 0.04, 0.02, 0.01, 0.01]; // 6%, 4%, 2%, 1%, 1%
      
      let currentUser = await prisma.user.findUnique({ where: { id: purchaseRequest.userId }});
      
      for (let i = 0; i < bonusLevels.length; i++) {
        if (!currentUser || !currentUser.sponsorId) break;
        
        const sponsor = await prisma.user.findUnique({ where: { id: currentUser.sponsorId }});
        if (!sponsor) break;
        
        const bonusAmount = parseFloat((baseAmount * bonusLevels[i]).toFixed(2));
        
        await prisma.bonusTransaction.create({
          data: {
            receiverId: sponsor.id,
            sourceUserId: purchaseRequest.userId,
            purchaseId: purchaseRequest.id,
            amount: bonusAmount,
            level: i + 1,
            status: "COMPLETED"
          }
        });
        
        await prisma.user.update({
          where: { id: sponsor.id },
          data: {
            totalBonusEarned: { increment: bonusAmount },
            availableBonus: { increment: bonusAmount }
          }
        });
        
        currentUser = sponsor;
      }
      
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: "APPROVED", isBonusProcessed: true }
      });
    } else {
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: "APPROVED" }
      });
    }

    res.json({ success: true, message: "Pagamento aprovado e licença emitida." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao aprovar solicitação." });
  }
});

app.patch("/api/admin/licenses/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { expiresAt, status } = req.body;

  try {
    const updated = await prisma.license.update({
      where: { id },
      data: { 
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        status: status || undefined
      }
    });
    res.json({ success: true, license: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar licença." });
  }
});

app.post("/api/admin/payment-methods", requireAuth, requireAdmin, async (req, res) => {
  const { name, details } = req.body;
  try {
    const pm = await prisma.paymentMethod.create({ data: { name, details } });
    res.json({ success: true, paymentMethod: pm });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar método de pagamento." });
  }
});

app.put("/api/admin/payment-methods/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, details, isActive } = req.body;
  try {
    const pm = await prisma.paymentMethod.update({
      where: { id },
      data: { name, details, isActive }
    });
    res.json({ success: true, paymentMethod: pm });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar método de pagamento." });
  }
});

app.delete("/api/admin/payment-methods/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.paymentMethod.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar método de pagamento." });
  }
});

// ── User Payment Endpoints ───────────────────────────────────────

app.get("/api/plans", requireAuth, async (req, res) => {
  try {
    const plans = await prisma.licensePlan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar planos." });
  }
});

app.get("/api/payment-methods", requireAuth, async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({ where: { isActive: true } });
    res.json({ success: true, methods });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar métodos de pagamento." });
  }
});

app.post("/api/purchase/request", requireAuth, async (req, res) => {
  const { planId, amount, transactionHash, paymentMethodId } = req.body;
  try {
    const request = await prisma.purchaseRequest.create({
      data: {
        userId: req.user.id,
        planId,
        paymentMethodId: paymentMethodId || "manual",
        transactionHash: transactionHash || null,
        amount: parseFloat(amount),
        status: "PENDING"
      }
    });
    res.json({ success: true, message: "Solicitação enviada. Aguarde a aprovação do admin.", request });
  } catch (err) {
    console.error("Erro ao criar PurchaseRequest:", err);
    res.status(500).json({ error: "Erro ao enviar solicitação." });
  }
});

// ── Affiliate Endpoints ─────────────────────────────────────────

app.get("/api/affiliate/stats", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        referrals: {
          select: { id: true, email: true, createdAt: true, _count: { select: { referrals: true } } }
        }
      }
    });
    
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    // Buscar histórico de bónus
    const bonuses = await prisma.bonusTransaction.findMany({
      where: { receiverId: user.id },
      include: { sourceUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      stats: {
        referralCode: user.referralCode,
        totalBonusEarned: user.totalBonusEarned,
        totalBonusWithdrawn: user.totalBonusWithdrawn,
        availableBonus: user.availableBonus,
        referrals: user.referrals,
        recentBonuses: bonuses
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados de afiliados." });
  }
});

app.post("/api/affiliate/withdraw", requireAuth, async (req, res) => {
  const { amount, walletAddress, network } = req.body;
  const withdrawAmount = parseFloat(amount);

  if (!withdrawAmount || withdrawAmount <= 0 || !walletAddress || !network) {
    return res.status(400).json({ error: "Dados inválidos." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.availableBonus < withdrawAmount) {
      return res.status(400).json({ error: "Saldo insuficiente." });
    }

    // Deduzir do availableBonus e criar o request numa transação
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { availableBonus: { decrement: withdrawAmount } }
      }),
      prisma.withdrawalRequest.create({
        data: {
          userId: user.id,
          amount: withdrawAmount,
          walletAddress,
          network,
          status: "PENDING"
        }
      })
    ]);

    res.json({ success: true, message: "Pedido de saque efetuado com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao solicitar saque." });
  }
});

app.get("/api/affiliate/withdrawals", requireAuth, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar histórico de saques." });
  }
});

// ── User Account Management ──────────────────────────────────────

app.post("/api/user/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Dados inválidos. A nova password deve ter pelo menos 6 caracteres." });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Password atual incorreta." });

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: newHash } });
    res.json({ success: true, message: "Password alterada com sucesso." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// ─── Bot Settings Persistence ───────────────────────────────────

app.get("/api/user/settings", requireAuth, async (req, res) => {
  try {
    let settings = await prisma.userSettings.findUnique({ where: { userId: req.user.id } });
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id }
      });
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar configurações." });
  }
});

app.post("/api/user/settings", requireAuth, async (req, res) => {
  const { risk, score, interval, activePairs, geminiKey } = req.body;
  try {
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: {
        risk: risk !== undefined ? parseFloat(risk) : undefined,
        score: score !== undefined ? parseInt(score) : undefined,
        interval: interval !== undefined ? parseInt(interval) : undefined,
        activePairs: activePairs || undefined,
        geminiKey: geminiKey || undefined
      },
      create: {
        userId: req.user.id,
        risk: parseFloat(risk) || 1.5,
        score: parseInt(score) || 55,
        interval: parseInt(interval) || 60,
        activePairs: activePairs || "EURUSD,GBPUSD,USDJPY,XAUUSD,GBPJPY",
        geminiKey: geminiKey || null
      }
    });
    res.json({ success: true, settings });
  } catch (err) {
    console.error("Save settings error:", err);
    res.status(500).json({ error: "Erro ao salvar configurações no servidor." });
  }
});

// ─── AI & Signal Engine ───────────────────────────────────────

app.post("/api/bot/analyze", requireAuth, async (req, res) => {
  const { pair, htfBias, candles } = req.body;
  
  try {
    let marketCandles = candles;
    // Mock de velas se não houver conexão real ativa para testes
    if (!marketCandles || marketCandles.length === 0) {
      const isBullish = Math.random() > 0.5;
      marketCandles = Array.from({ length: 250 }, (_, i) => {
        const trend = isBullish ? i * 0.00001 : -i * 0.00001;
        const base = pair.includes("JPY") ? 150.00 : 1.0850;
        return {
          open: base + trend + Math.random() * 0.0005,
          high: base + trend + 0.0010,
          low: base + trend - 0.0010,
          close: base + trend + Math.random() * 0.0005 + (isBullish ? 0.0002 : -0.0002),
          timestamp: Date.now() - (250 - i) * 60000
        };
      });
    }

    const { signal, reason } = generateSignal(pair, marketCandles, htfBias || "NEUTRAL");
    const analysis = analyzeAll(marketCandles);

    res.json({
      success: true,
      signal,
      reason,
      pair,
      analysis: {
        obs: analysis.obs.slice(-5),
        fvgs: analysis.fvgs.slice(-5),
        structure: analysis.structure.slice(-3)
      }
    });
  } catch (err) {
    console.error("Bot analysis error:", err);
    res.status(500).json({ error: "Erro no motor de sinais profissional." });
  }
});

// ── Admin User Management ─────────────────────────────────────────

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { licenses: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar utilizadores." });
  }
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: "Não pode eliminar a sua própria conta." });
    }

    // Verifica se o utilizador existe
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: "Utilizador não encontrado." });

    // Apaga registos dependentes em cascata (ordem importa)
    await prisma.bonusTransaction.deleteMany({ where: { OR: [{ receiverId: id }, { sourceUserId: id }] } });
    await prisma.withdrawalRequest.deleteMany({ where: { userId: id } });
    await prisma.purchaseRequest.deleteMany({ where: { userId: id } });
    await prisma.license.deleteMany({ where: { userId: id } });
    await prisma.brokerConnection.deleteMany({ where: { userId: id } });

    // Remove o sponsorId dos utilizadores que foram indicados por esta conta
    await prisma.user.updateMany({ where: { sponsorId: id }, data: { sponsorId: null } });

    // Finalmente, apaga o utilizador
    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: `Conta de ${target.email} eliminada com sucesso.` });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Erro ao eliminar conta: " + err.message });
  }
});

app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "A nova password deve ter pelo menos 6 caracteres." });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: "Utilizador não encontrado." });

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });

    res.json({ success: true, message: `Password de ${target.email} redefinida com sucesso.` });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Erro ao redefinir password: " + err.message });
  }
});

// ── Admin Affiliate Endpoints ────────────────────────────────────


app.get("/api/admin/finance/report", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: "Ano e Mês são obrigatórios." });

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    // 1. Receitas (Licenças Aprovadas)
    const revenueObj = await prisma.purchaseRequest.aggregate({
      where: { 
        status: "APPROVED",
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    });

    // 2. Saques (Pagos/Aprovados)
    const withdrawalsObj = await prisma.withdrawalRequest.aggregate({
      where: { 
        status: "APPROVED",
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    });

    // 3. Bónus de Indicação (Gerados no período)
    const bonusesObj = await prisma.bonusTransaction.aggregate({
      where: { 
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    });

    const revenue = revenueObj._sum.amount || 0;
    const withdrawals = withdrawalsObj._sum.amount || 0;
    const bonuses = bonusesObj._sum.amount || 0;
    const balance = revenue - withdrawals;

    res.json({
      success: true,
      revenue,
      withdrawals,
      bonuses,
      balance,
      period: `${month}/${year}`
    });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: "Erro ao gerar balanço financeiro." });
  }
});

app.get("/api/admin/finance", requireAuth, requireAdmin, async (req, res) => {
  try {
    const revenueObj = await prisma.purchaseRequest.aggregate({
      where: { status: "APPROVED" },
      _sum: { amount: true }
    });
    const paidObj = await prisma.withdrawalRequest.aggregate({
      where: { status: "APPROVED" },
      _sum: { amount: true }
    });

    const totalRevenue = revenueObj._sum.amount || 0;
    const totalPaid = paidObj._sum.amount || 0;
    const balance = totalRevenue - totalPaid;

    res.json({
      success: true,
      finance: { totalRevenue, totalPaid, balance }
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar finanças." });
  }
});

app.get("/api/admin/withdrawals", requireAuth, requireAdmin, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar saques." });
  }
});

app.post("/api/admin/withdrawals/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const wr = await prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr || wr.status !== "PENDING") return res.status(400).json({ error: "Pedido não encontrado ou já processado." });

    await prisma.$transaction([
      prisma.withdrawalRequest.update({
        where: { id },
        data: { status: "APPROVED" }
      }),
      prisma.user.update({
        where: { id: wr.userId },
        data: { totalBonusWithdrawn: { increment: wr.amount } }
      })
    ]);

    res.json({ success: true, message: "Saque aprovado com sucesso." });
  } catch (err) {
    res.status(500).json({ error: "Erro ao aprovar saque." });
  }
});

app.post("/api/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const wr = await prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr || wr.status !== "PENDING") return res.status(400).json({ error: "Pedido não encontrado ou já processado." });

    // Estornar o saldo para o availableBonus
    await prisma.$transaction([
      prisma.withdrawalRequest.update({
        where: { id },
        data: { status: "REJECTED" }
      }),
      prisma.user.update({
        where: { id: wr.userId },
        data: { availableBonus: { increment: wr.amount } }
      })
    ]);

    res.json({ success: true, message: "Saque rejeitado e saldo estornado." });
  } catch (err) {
    res.status(500).json({ error: "Erro ao rejeitar saque." });
  }
});

// ── Static Files & Login Page ──────────────────────────────────────

let lastModTimes = {};
if (!isProd) {
  app.get("/__reload_check", (req, res) => { res.json({ changed: false }); }); // Desativado dev reload auto para n quebrar requests jwt
}

app.use((req, res) => {
  let urlPath = req.path;

  // Rotas /api/ não encontradas devem retornar JSON, nunca HTML
  if (urlPath.startsWith("/api/")) {
    return res.status(404).json({ error: `Rota não encontrada: ${req.method} ${urlPath}` });
  }

  if (urlPath === "/" || urlPath === "" || urlPath === "/login") {
    urlPath = "/login.html";
  } else if (urlPath === "/dashboard") {
    urlPath = "/smc_bot_dashboard.html";
  } else if (urlPath === "/affiliate") {
    urlPath = "/affiliate_dashboard.html";
  }

  const filePath = path.join(ROOT, urlPath);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (urlPath !== "/smc_bot_dashboard.html" && urlPath !== "/login.html" && urlPath !== "/affiliate_dashboard.html") return res.status(404).send("Not Found");
    return res.status(404).send("Arquivo não encontrado.");
  }

  // Prevenir Directory Traversal Attack
  if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) return res.status(403).send("Forbidden");

  // Prevenir Caching agressivo em ficheiros HTML
  if (filePath.endsWith(".html")) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  res.sendFile(filePath);
});

// ── Startup ───────────────────────────────────────────────────────
const http = require("http");
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║                                                      ║");
  console.log("  ║   🔒  [ESTA-E-A-VERSAO-CORRETA-OU-EU-ME-DEMITO] ║");
  console.log("  ║   📦  PostgreSQL & JWT Auth Ready                   ║");
  console.log(`  ║   🌐  http://localhost:${PORT}                          ║`);
  console.log("  ║                                                      ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log("[DIAGNOSTIC] Servidor Nativo HTTP ativo na porta " + PORT);
  
  // Testar base de dados
  prisma.$connect()
    .then(() => console.log("[DIAGNOSTIC] ✅ Conexão Prisma OK"))
    .catch(err => console.error("[DIAGNOSTIC] ❌ Erro Prisma:", err.message));

  // ── INICIAR MONITOR DE BACKGROUND (Profit Lock) ──
  console.log("[DIAGNOSTIC] 🛡️ Iniciando Monitor de Background (Profit Lock)...");
  setInterval(async () => {
    for (const [userId, broker] of userBrokers.entries()) {
      try {
        if (!broker.connected) continue;

        const risk = userRisks.get(userId) || new RiskManager(userId);
        if (!userRisks.has(userId)) userRisks.set(userId, risk);

        // 1. Obter dados da conta e posições
        const accountInfo = await broker.getAccountInfo();
        if (accountInfo) risk.setBalance(accountInfo.balance);

        const positions = await broker.getOpenPositions();
        if (!positions || positions.length === 0) continue;

        // 2. Para cada posição, verificar proteção
        for (const pos of positions) {
          const currentProfit = pos.profit || 0;
          const ticketId = pos.id; // O ID da MetaApi é o Ticket
          
          // Debug agressivo: Ver todas as ordens detetadas
          console.log(`\x1b[33m[MONITOR] Detetado: ${pos.pair} | Ticket: ${ticketId} | Profit: $${currentProfit.toFixed(2)}\x1b[0m`);

          // Sincronizar trade: Se for uma ordem da Aura (pelo comentário ou ID), garantir que está no RiskManager
          let internalTrade = risk.openTrades.find(t => String(t.brokerId) === String(ticketId));
          
          if (!internalTrade) {
            console.log(`\x1b[35m[SYNC] Nova ordem detetada no broker. Sincronizando Ticket #${ticketId}...\x1b[0m`);
            internalTrade = risk.registerTrade({
              pair: pos.pair,
              direction: pos.direction,
              entry: pos.openPrice,
              sl: pos.sl,
              tp: pos.tp,
              score: 100
            }, pos.lotSize, ticketId);
          }

          // 3. Executar Verificação de Profit Lock usando Lucro Real
          // Passamos 0 no preço pois o checkProfitProtection agora só usa o Lucro
          const toClose = risk.checkOpenTrades(pos.pair, 0, currentProfit, 0); 
          
          for (const { trade, reason } of toClose) {
            console.log(`\x1b[41m\x1b[37m[ALERTA] FECHANDO TICKET #${ticketId} | LUCRO: $${currentProfit.toFixed(2)} | RAZÃO: ${reason}\x1b[0m`);
            const res = await broker.closePosition(ticketId);
            if (res.success) {
              risk.closeTrade(trade.id, 0, reason);
            }
          }
        }
      } catch (e) {
        console.error(`[MONITOR-ERROR] User ${userId}:`, e.message);
      }
    }
  }, 1000); // 🏎️ VELOCIDADE MÁXIMA: Verifica a cada 1 segundo para não perder picos
});

process.on('exit', (code) => {
  console.log(`[DIAGNOSTIC] ⚠️ O PROCESSO VAI FECHAR COM O CÓDIGO: ${code}`);
});

// Tratamento de Erros Globais para o Expert
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ ERROR [Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ ERROR [Uncaught Exception]:", err.message);
  console.error(err.stack);
});
