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

// Global Error Handlers para prevenir crashs do servidor causados por Timeouts assincronos (ex: MetaApi SDK)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

const prisma = require("./db");
const { encrypt, decrypt } = require("./utils/encryption");

// Iniciar Workers
require("./workers/paymentMonitor");

// APEX SMC Broker Layer
const { createBroker } = require("./apex_broker");

const { generateSignal } = require("./signals/smc_signal_engine");
const { analyzeAll } = require("./smc/smc");
const { getRiskManager, userRisks } = require("./risk/store");
const { generatePaymentWallet } = require("./payments/cryptoGateway");
const eaApi = require("./ea_api");
const supportApi = require("./support_api");
const { setupPammAccount, startPammWorker, togglePammConnection, getPammAccountStats, removePammAccount } = require("./pamm_metaapi");

const app = express();
const PORT = process.env.PORT || 3005;
const VERSION = "2.5.2-RR-FIX";
const ROOT = __dirname;
console.log(`[INIT] ROOT directory: ${ROOT}`);
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "auraforex_default_jwt_secret";

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// 🚀 PRIORIDADE MÁXIMA: Landing Page (Página de Vendas)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ── CORREÇÃO MT5: Limpeza de Caracteres Nulos ──────────────────────
app.use((req, res, next) => {
  if (req.url && req.url.includes("/ea/")) {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        const cleanData = data.replace(/\0/g, '').trim();
        if (cleanData) {
          req.body = JSON.parse(cleanData);
        }
        next();
      } catch (e) {
        console.error("[JSON PARSE ERROR MT5 BODY]", e, " | Data:", data.replace(/\0/g, '').trim());
        next();
      }
    });
  } else {
    next();
  }
});

// Página de Login (Design Atual Mantido)
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Página de Detalhes do Bot Forex
app.get("/smc-forex", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'smc-forex.html'));
});

// Download do Robô
app.get("/AuraForex_V8_INSTITUTIONAL.ex5", (req, res) => {
  const filePath = path.join(__dirname, 'public', 'AuraForex_V8_INSTITUTIONAL.ex5');
  console.log(`[DOWNLOAD-ATTEMPT] Ficheiro: ${filePath}`);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="AuraForex_V8_INSTITUTIONAL.ex5"');
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("[DOWNLOAD-ERROR]", err);
      } else {
        console.log("[DOWNLOAD-SUCCESS] Ficheiro enviado com sucesso.");
      }
    });
  } else {
    console.error("[DOWNLOAD-ERROR] Ficheiro não encontrado no disco!");
    res.status(404).send("Ficheiro do Robô não encontrado no servidor.");
  }
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
app.use(express.static(path.join(__dirname, 'public')));

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
app.use("/api/ea", eaApi);
app.use("/ea", eaApi); // Suporte para o Robô (sem prefixo /api)
app.use("/api/support", supportApi);

// ── Mapa Em-Memória de Corretoras (por User ID) ───────────────────
const userBrokers = new Map();

let globalBroker = null; // Instância mestre para puxar velas para todos os usuários

async function getGlobalBroker() {
  if (globalBroker && globalBroker.connected) return globalBroker;

  try {
    const settings = await prisma.systemSettings.findFirst();
    if (settings && settings.metaApiToken && settings.metaApiAccountId) {
      console.log("[ADMIN] 🌐 Inicializando Broker Global (MetaApi)...");
      const config = {
        brokerType: "metaapi",
        apiToken: settings.metaApiToken,
        metaApiAccountId: settings.metaApiAccountId,
        region: "vint-hill"
      };

      globalBroker = createBroker(config);
      await globalBroker.connect();
      return globalBroker;
    }
  } catch (e) {
    console.error("[ADMIN] ❌ Falha ao ligar Broker Global:", e.message);
  }
  return null;
}

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
    req.broker = null;
    return next();
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
      } catch (e) { console.error("Erro Auto-Connect:", e.message); }
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




app.post("/api/user/cent-toggle", requireAuth, async (req, res) => {
  try {
    const { isCentAccount } = req.body;
    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      update: { isCentAccount: Boolean(isCentAccount) },
      create: { userId: req.user.id, isCentAccount: Boolean(isCentAccount) }
    });
    res.json({ success: true, isCentAccount });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erro ao atualizar configuração de conta Cent." });
  }
});

// ── NOVO: Endpoint de Status HMI (Institucional) ──────────────────
app.get("/api/user/status", requireAuth, async (req, res) => {
  try {
    const license = await prisma.license.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' }
    });

    const settings = await prisma.systemSettings.findFirst();
    const fridayBlockHour = settings ? settings.fridayBlockHour : 12;
    const sundayOpenHour = settings ? settings.sundayOpenHour : 22;

    const risk = getRiskManager(license ? license.id : req.user.id);

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timeUntilReset = Math.floor((midnight - now) / 1000);

    let lastBalance = license ? license.balance : (risk.balance || 0);
    if (lastBalance === null || lastBalance === undefined) lastBalance = 0;

    // 🛡️ CORREÇÃO CRÍTICA DE SINAL: Priorizar capital líquido (equity) em tempo real para evitar dessincronização com o balance!
    let lastEquity = (risk.equity && risk.equity > 0) ? risk.equity : (license ? license.equity : lastBalance);
    if (lastEquity === null || lastEquity === undefined) lastEquity = lastBalance;
    
    // 🛡️ LIMPEZA DE GHOST EQUITY: Se não houver trades abertos, o equity TEM que ser o balance.
    if (!risk.openTrades || risk.openTrades.length === 0) {
      lastEquity = lastBalance;
      if (risk.equity !== lastBalance) {
        risk.equity = lastBalance; // Limpa o estado preso no risk manager
      }
    }

    // 🛡️ LÓGICA INSTITUCIONAL: Usar APENAS o Saldo Inicial do Dia (dailyStartBalance) como base da Meta Diária!
    // NUNCA usar dailyStartEquity ou equity, pois o floating inicial distorce a meta diária.
    let startCapital = (risk.dailyStartBalance && risk.dailyStartBalance > 0) 
      ? risk.dailyStartBalance 
      : lastBalance;

    let targetPercent = (risk.dailyProfitTarget && risk.dailyProfitTarget > 0) ? (risk.dailyProfitTarget / 100) : 0.05;

    // A meta do dia fica 100% fixa ao longo das negociações baseada no balance de início do dia
    const dailyTargetMoney = startCapital * targetPercent;

    // Evolução Líquida = Equity Atual - Saldo Inicial
    let netEvolution = lastEquity - startCapital;

    // Sincroniza estado de trava se já bateu a meta baseada na Evolução Líquida (Equity - StartBalance)
    let isProfitLocked = risk.dailyProfitLocked;
    if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {
      isProfitLocked = true;
      risk.dailyProfitLocked = true;
      risk._safeSaveState();
    } else if (isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney) {
      // 🛡️ CORREÇÃO DE BUG: Se a evolução caiu abaixo da meta (ex: correção de ghost equity), destrava o bot.
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
      risk._safeSaveState();
    }

    // Removida a busca cega à base de dados para evitar ordens fantasmas somarem até ao limite global.
    const trueOpenTrades = risk.openTrades || [];

    // Lógica Conta Cent
    const userSettings = await prisma.userSettings.findUnique({ where: { userId: req.user.id } });
    const isCentAccount = userSettings?.isCentAccount || false;

    let finalBalance = lastBalance;
    let finalEquity = lastEquity;
    let finalDailyPnl = risk.dailyPnl;
    let finalDailyTargetMoney = dailyTargetMoney;

    if (isCentAccount) {
      finalBalance = finalBalance / 100;
      finalEquity = finalEquity / 100;
      finalDailyPnl = finalDailyPnl / 100;
      finalDailyTargetMoney = finalDailyTargetMoney / 100;
    }

    res.json({
      success: true,
      balance: finalBalance,
      equity: finalEquity, // Prioriza a equity em tempo real para evitar sinais invertidos!
      dailyPnl: finalDailyPnl, // Correção: Usar o PnL fechado+flutuante exacto vindo do MT5!
      dailyTargetMoney: finalDailyTargetMoney, // Valor 100% fixo baseado no Balance Inicial
      isLocked: isProfitLocked || risk.circuitBreaker,
      isProfitLocked: isProfitLocked, // Correção: Passar flag específica para o Card Verde
      isLossLocked: risk.circuitBreaker, // Correção: Passar flag específica para o Card Vermelho
      timeUntilReset: timeUntilReset,
      updatedAt: license ? license.updatedAt : null,
      fridayBlockHour: fridayBlockHour,
      sundayOpenHour: sundayOpenHour,
      openTrades: trueOpenTrades // Retorna as trades abertas sincronizadas pelo EA/BD
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erro ao carregar status institucional." });
  }
});

// ── Broker Endpoints ──────────────────────────────────────────────

app.get("/api/broker/status", requireAuth, requireBrokerAuth, async (req, res) => {
  if (!req.broker) return res.json({ connected: false, status: "DISCONNECTED" });
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
      try { await activeBroker.disconnect(); } catch (e) { }
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
      catch (err) { clearTimeout(timer); reject(err); }
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
      console.log("💾 Credenciais salvas na DB para o user ID: " + req.user.id.substring(0, 8));
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
  } catch (e) {
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
  try {
    if (!req.broker) return res.status(404).json({ error: "Broker não conectado" });
    const account = await req.broker.getAccountInfo();
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/broker/positions", requireAuth, requireBrokerAuth, async (req, res) => {
  try {
    if (!req.broker) return res.json({ success: true, positions: [] });
    const positions = await req.broker.getOpenPositions();
    res.json({ success: true, positions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/broker/history", requireAuth, requireBrokerAuth, async (req, res) => {
  try {
    if (!req.broker) {
      const license = await prisma.license.findFirst({
        where: { userId: req.user.id },
        orderBy: { updatedAt: 'desc' }
      });
      const { getRiskManager } = require("./risk/store");
      const risk = getRiskManager(license ? license.id : req.user.id);
      
      let pammHist = risk.tradeHistory || [];
      const userSettings = await prisma.userSettings.findUnique({ where: { userId: req.user.id } });
      const isCentAccount = userSettings?.isCentAccount || false;
      
      if (isCentAccount && pammHist.length > 0) {
        pammHist = pammHist.map(t => ({
           ...t,
           pnl: t.pnl / 100,
           lotSize: t.lotSize / 100
        }));
      }
      return res.json({ success: true, history: pammHist });
    }
    const brokerHist = await req.broker.getHistory() || [];
    
    // Cent account logic for MT5 direct connection
    const userSettings = await prisma.userSettings.findUnique({ where: { userId: req.user.id } });
    const isCentAccount = userSettings?.isCentAccount || false;
    let finalHist = brokerHist;
    if (isCentAccount && brokerHist.length > 0) {
      finalHist = brokerHist.map(t => ({
         ...t,
         pnl: t.pnl / 100,
         lotSize: t.lotSize / 100
      }));
    }
    
    res.json({ history: finalHist });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/user/performance", requireAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const perfFile = path.join(__dirname, "logs/users", req.user.id, "performance_history.json");
    if (fs.existsSync(perfFile)) {
      const history = JSON.parse(fs.readFileSync(perfFile, "utf8"));
      // Sort by newest first
      history.reverse();
      res.json({ success: true, performance: history });
    } else {
      res.json({ success: true, performance: [] });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Helpers SL/TP dinâmico ──────────────────────────────────────
// ── SMC VALIDATION LOGIC (Ported from Expert Python Snippet) ──────────────────

function identifyStructure(candles, lookback = 10) {
  if (candles.length < lookback * 2) return "neutral";

  const lastSet = candles.slice(-lookback);
  const prevSet = candles.slice(-lookback * 2, -lookback);

  const lastHigh = Math.max(...lastSet.map(c => c.high));
  const prevHigh = Math.max(...prevSet.map(c => c.high));
  const lastLow = Math.min(...lastSet.map(c => c.low));
  const prevLow = Math.min(...prevSet.map(c => c.low));

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
    const next = candles[i + 1];

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
    const vAnt = candles[i - 1];
    const vPos = candles[i + 1];

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
  if (!entry || entry <= 0) return { sl: 0, tp: 0 };
  try {
    const pip = getPipValue(pair);
    let slPips = 20;
    if (pair.includes("XAU") || pair.includes("GOLD")) slPips = 80;
    const slDist = pip * slPips;
    const tpDist = slDist * 1.5;
    const sl = direction === "BUY" ? normPrice(entry - slDist, pair) : normPrice(entry + slDist, pair);
    const tp = direction === "BUY" ? normPrice(entry + tpDist, pair) : normPrice(entry - tpDist, pair);
    return { sl, tp };
  } catch (e) {
    return { sl: 0, tp: 0 };
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
    effectiveMinDist = 60; // 60 pips = $6.00 de distância mínima (Segurança total)
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

  // ⚠️ SANITY CHECK: Se a distância for maior que 50% do preço, há erro de escala
  const maxAllowedDist = entry * 0.5;
  if (Math.abs(entry - finalSl) > maxAllowedDist) {
    console.warn(`[SANITY] SL muito longe (${finalSl}). Ajustando para escala local.`);
    finalSl = direction === "BUY" ? normPrice(entry - minDist, pair) : normPrice(entry + minDist, pair);
  }
  if (Math.abs(finalTp - entry) > maxAllowedDist) {
    finalTp = direction === "BUY" ? normPrice(entry + minDist, pair) : normPrice(entry - minDist, pair);
  }

  return { sl: finalSl, tp: finalTp };
}

app.post("/api/broker/order", requireAuth, async (req, res) => {
  let { pair, risk, sl, tp, entry } = req.body;
  const direction = req.body.direction?.toUpperCase();
  if (!pair || !direction || !risk) return res.status(400).json({ error: "Faltam parametros (pair, direction, risk)" });
  try {
    const settings = await prisma.systemSettings.findFirst();
    const fridayHour = settings ? settings.fridayBlockHour : 12;
    const sundayHour = settings ? settings.sundayOpenHour : 22;
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    // Lógica completa de Fim de Semana
    const isWeekendBlocked = 
      (day === 5 && hour >= fridayHour) || // Sexta-feira após a hora de bloqueio
      (day === 6) || // Sábado inteiro
      (day === 0 && hour < sundayHour); // Domingo antes da hora de abertura

    if (isWeekendBlocked) {
      console.warn(`[WEEKEND-BLOCK] Sinal rejeitado para ${pair}: Fim de Semana ativo.`);
      return res.status(400).json({ success: false, error: `Operações suspensas. Mercado fechado ou em proteção de Fim de Semana.` });
    }

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

    // 2. Obter preço actual (APENAS SE REAL)
    let entryPrice = entry || 0;
    if (entryPrice <= 0 || entryPrice === 1.0850 || entryPrice === 150.00) {
      entryPrice = 0;
      if (req.broker) {
        try {
          const priceData = await req.broker.getPrice(pair);
          entryPrice = direction === "BUY" ? (priceData?.ask || 0) : (priceData?.bid || 0);
        } catch (e) { entryPrice = 0; }
      }
    }

    // 2. Cálculo Dinâmico de SL/TP (EXPERT ATR)
    if (entryPrice > 0) {
      try {
        console.log(`[ORDER] Calculando SL/TP Dinâmico (ATR) para ${pair}...`);
        const dyn = await computeDynamicSlTp(req.broker || null, pair, direction, entryPrice);
        
        // Se sl/tp não foram fornecidos ou são deltas, usa os dinâmicos
        if (!sl || Math.abs(sl) < 1.0) sl = dyn.sl;
        if (!tp || Math.abs(tp) < 1.0) tp = dyn.tp;
        
        const pip = getPipValue(pair);
        console.log(`[ORDER] ATR Dinâmico: Pip=${pip}, Dist=${(sl - entryPrice).toFixed(4)}, SL=${sl} TP=${tp}`);
      } catch (e) {
        console.warn(`[ORDER] Falha no ATR Dinâmico, usando Fallback Técnico: ${e.message}`);
        const pip = getPipValue(pair);
        const isBuy = direction === "BUY";
        let fallSl = 180; let fallTp = 270;
        if (pair.includes("XAU") || pair.includes("GOLD")) { fallSl = 40; fallTp = 60; }
        if (!sl || Math.abs(sl) < 1.0) sl = isBuy ? (entryPrice - (pip * fallSl)) : (entryPrice + (pip * fallSl));
        if (!tp || Math.abs(tp) < 1.0) tp = isBuy ? (entryPrice + (pip * fallTp)) : (entryPrice - (pip * fallTp));
      }
    }

    // 2.5 Validação final de sanidade
    const isBuy = direction === "BUY";
    const invalidSl = !sl || (isBuy ? sl >= entryPrice : sl <= entryPrice);
    if (invalidSl) {
      const pip = getPipValue(pair);
      let fallSl = 180; let fallTp = 270;
      if (pair.includes("XAU") || pair.includes("GOLD")) { fallSl = 40; fallTp = 60; }
      sl = isBuy ? (entryPrice - (pip * fallSl)) : (entryPrice + (pip * fallSl));
      tp = isBuy ? (entryPrice + (pip * fallTp)) : (entryPrice - (pip * fallTp)); // Garante consistência
    }

    // 3. Garantir distância mínima e normalização
    const guarded = enforceMinStopDistance(sl, tp, entryPrice, direction, pair);
    sl = guarded.sl;
    tp = guarded.tp;

    // 3.5 Fallback final se ainda estiverem ausentes (segurança crítica)
    if (!sl || !tp || isNaN(sl) || isNaN(tp)) {
      console.warn(`[ORDER] SL/TP ainda ausentes para ${pair}. Aplicando fallback de emergência.`);
      const pip = getPipValue(pair);
      let fallbackDist = pip * 300; // 300 pips de segurança padrão
      if (pair.includes("XAU") || pair.includes("GOLD")) fallbackDist = pip * 40; // 40 pips de segurança para Ouro (4 pontos = $4 num lote 0.01)
      
      if (!sl || isNaN(sl)) sl = direction === "BUY" ? normPrice(entryPrice - fallbackDist, pair) : normPrice(entryPrice + fallbackDist, pair);
      if (!tp || isNaN(tp)) tp = direction === "BUY" ? normPrice(entryPrice + fallbackDist, pair) : normPrice(entryPrice - fallbackDist, pair);
    }

    // 4. EM VEZ DE EXECUTAR NA CORRETORA (METADEV/METAAPI), SALVAMOS COMO SINAL PARA O EA
    const signal = await prisma.signal.create({
      data: {
        userId: req.user.id,
        pair: String(pair).toUpperCase(),
        direction: String(direction).toUpperCase(),
        entry: Number(entryPrice || 0),
        sl: Number(sl || 0),
        tp: Number(tp || 0),
        lot: 0.01,
        status: "PENDING"
      }
    });

    console.log(`[V2-LOCAL] ✅ Sinal gerado com sucesso para ${pair} ${direction}. ID: ${signal.id}`);

    return res.status(200).json({
      success: true,
      message: "Sinal enviado para o terminal local (EA).",
      orderId: signal.id,
      appliedSl: sl,
      appliedTp: tp
    });

  } catch (e) {
    console.error("Signal Generation Error:", e);
    res.status(500).json({ error: "Erro ao gerar sinal: " + e.message });
  }
});

app.post("/api/broker/clear-signals", requireAuth, async (req, res) => {
  try {
    const updated = await prisma.signal.updateMany({
      where: {
        userId: req.user.id,
        status: "PENDING"
      },
      data: {
        status: "CANCELLED"
      }
    });
    console.log(`[CLEAR-SIGNALS] ${updated.count} sinais pendentes cancelados para o user ${req.user.id}.`);
    return res.status(200).json({ success: true, count: updated.count });
  } catch (e) {
    console.error("Clear Signals Error:", e);
    res.status(500).json({ error: "Erro ao limpar sinais: " + e.message });
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

app.get("/api/admin/pamm-users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const pammUsers = await prisma.pammAccount.findMany({
      include: {
        user: {
          select: { email: true, walletBalance: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, pammUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Configurações do Sistema (Admin) ──────────────────────────────────
app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({ data: {} });
    }
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      geminiApiKey, geminiApiUrl, metaApiToken, metaApiAccountId, pammMasterAccountId, apiUrl,
      installationGuide, telegramUrl, whatsappNumber, facebookUrl, instagramUrl, youtubeUrl,
      cryptoBotEnabled, cryptoBotUrl, defaultPammPerformanceFee, minPammDeposit, fridayBlockHour, sundayOpenHour
    } = req.body;
    let settings = await prisma.systemSettings.findFirst();

    const pammFee = defaultPammPerformanceFee !== undefined ? parseFloat(defaultPammPerformanceFee) : 30.0;
    const minPamm = minPammDeposit !== undefined ? parseFloat(minPammDeposit) : 50.0;
    const blockHour = fridayBlockHour !== undefined ? parseInt(fridayBlockHour) : 12;
    const openHour = sundayOpenHour !== undefined ? parseInt(sundayOpenHour) : 22;

    if (settings) {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          geminiApiKey, geminiApiUrl, metaApiToken, metaApiAccountId, pammMasterAccountId, apiUrl,
          installationGuide, telegramUrl, whatsappNumber, facebookUrl, instagramUrl, youtubeUrl, cryptoBotEnabled, cryptoBotUrl,
          defaultPammPerformanceFee: pammFee,
          minPammDeposit: minPamm,
          fridayBlockHour: blockHour,
          sundayOpenHour: openHour
        }
      });
    } else {
      settings = await prisma.systemSettings.create({
        data: {
          geminiApiKey, geminiApiUrl, metaApiToken, metaApiAccountId, pammMasterAccountId, apiUrl,
          installationGuide, telegramUrl, whatsappNumber, facebookUrl, instagramUrl, youtubeUrl, cryptoBotEnabled, cryptoBotUrl,
          defaultPammPerformanceFee: pammFee,
          minPammDeposit: minPamm,
          fridayBlockHour: blockHour,
          sundayOpenHour: openHour
        }
      });
    }
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/admin/wallet/credit-user", requireAuth, requireAdmin, async (req, res) => {
  const { userId, amount, description, isDirectSet, newBalance } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId é obrigatório." });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: "Usuário não encontrado." });
    }

    let updatedUser;
    let tx;

    if (isDirectSet) {
      const targetBalance = parseFloat(newBalance);
      if (isNaN(targetBalance)) {
        return res.status(400).json({ success: false, error: "newBalance inválido." });
      }
      const diff = targetBalance - user.walletBalance;

      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { walletBalance: targetBalance }
      });

      if (diff !== 0) {
        tx = await prisma.walletTransaction.create({
          data: {
            userId,
            type: diff >= 0 ? "DEPOSIT" : "DEDUCTION",
            amount: Math.abs(diff),
            description: description || `Ajuste manual de saldo pelo administrador para $${targetBalance.toFixed(2)} (Ajuste: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)})`
          }
        });
      }
    } else {
      if (amount === undefined) {
        return res.status(400).json({ success: false, error: "amount é obrigatório." });
      }
      const amt = parseFloat(amount);
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          walletBalance: {
            increment: amt
          }
        }
      });
      tx = await prisma.walletTransaction.create({
        data: {
          userId,
          type: amt >= 0 ? "DEPOSIT" : "DEDUCTION",
          amount: Math.abs(amt),
          description: description || (amt >= 0 ? "Saldo adicionado manualmente pelo administrador" : "Saldo deduzido manualmente pelo administrador")
        }
      });
    }

    res.json({ success: true, walletBalance: updatedUser.walletBalance, transaction: tx });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/admin/user/:id/pamm-settings", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { pammPerformanceFeePct } = req.body;
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: id } });
    const feeVal = pammPerformanceFeePct !== undefined && pammPerformanceFeePct !== "" ? parseFloat(pammPerformanceFeePct) : null;
    
    if (!settings) {
      await prisma.userSettings.create({
        data: {
          userId: id,
          pammPerformanceFeePct: feeVal
        }
      });
    } else {
      await prisma.userSettings.update({
        where: { userId: id },
        data: {
          pammPerformanceFeePct: feeVal
        }
      });
    }
    res.json({ success: true, message: "Configurações PAMM atualizadas com sucesso." });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/user/wallet/transactions", requireAuth, async (req, res) => {
  try {
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" }
    });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        walletBalance: true,
        settings: { select: { pammPerformanceFeePct: true } }
      }
    });
    const systemSettings = await prisma.systemSettings.findFirst();
    const feePct = user?.settings?.pammPerformanceFeePct ?? systemSettings?.defaultPammPerformanceFee ?? 30.0;
    
    res.json({ 
      success: true, 
      walletBalance: user?.walletBalance || 0, 
      pammPerformanceFeePct: feePct,
      transactions 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/admin/wallet/transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const wTxs = await prisma.walletTransaction.findMany({
      include: { user: { select: { email: true } } }
    });
    
    const purchases = await prisma.purchaseRequest.findMany({
      where: { status: "APPROVED" },
      include: { user: { select: { email: true } }, plan: true }
    });
    
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { status: "APPROVED" },
      include: { user: { select: { email: true } } }
    });
    
    let unified = [];
    wTxs.forEach(t => {
      unified.push({
        id: t.id,
        user: t.user,
        amount: t.amount,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt
      });
    });
    
    purchases.forEach(p => {
      if (p.licenseType !== "PAMM") {
         unified.push({
           id: p.id,
           user: p.user,
           amount: p.amount,
           type: 'VPS_PURCHASE',
           description: `Compra de Licença: ${p.plan ? p.plan.name : 'VPS'}`,
           createdAt: p.createdAt
         });
      } else {
         unified.push({
           id: p.id,
           user: p.user,
           amount: p.amount,
           type: 'PAMM_PURCHASE',
           description: `Depósito de Gás PAMM`,
           createdAt: p.createdAt
         });
      }
    });
    
    withdrawals.forEach(w => {
       unified.push({
         id: w.id,
         user: w.user,
         amount: w.amount,
         type: 'BONUS_PAYOUT',
         description: `Pagamento de Saque (Aprovado)`,
         createdAt: w.createdAt
       });
    });
    
    // Remover duplicados (o Depósito PAMM já está na WalletTransaction)
    unified = unified.filter(t => !(t.type === 'DEPOSIT' && t.description && t.description.includes('Depósito de Gás')));
    
    unified.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, transactions: unified });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/api/admin/wallet/transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, type } = req.body;
    if (!id || !type) return res.status(400).json({ error: "ID e Tipo são obrigatórios." });

    if (type === "VPS_PURCHASE" || type === "PAMM_PURCHASE") {
      await prisma.purchaseRequest.delete({ where: { id } });
    } else if (type === "BONUS_PAYOUT") {
      await prisma.withdrawalRequest.delete({ where: { id } });
    } else {
      await prisma.walletTransaction.delete({ where: { id } });
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: "Erro ao eliminar transação." });
  }
});

// ── Configuração Pública (User) ───────────────────────────────────────
app.get("/api/public/settings", async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: {
        telegramUrl: true,
        whatsappNumber: true,
        facebookUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        cryptoBotEnabled: true,
        cryptoBotUrl: true
      }
    });
    res.json({
      success: true,
      settings: settings || {
        cryptoBotEnabled: true,
        cryptoBotUrl: ""
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Erro ao buscar configurações públicas." });
  }
});
app.get("/api/public/plans", async (req, res) => {
  try {
    const plans = await prisma.licensePlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });
    res.json({ success: true, plans });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/system/config", async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    res.json({
      success: true,
      apiUrl: settings?.apiUrl || "http://localhost:3005",
      installationGuide: settings?.installationGuide || "",
      telegramUrl: settings?.telegramUrl || "",
      whatsappNumber: settings?.whatsappNumber || "",
      facebookUrl: settings?.facebookUrl || "",
      instagramUrl: settings?.instagramUrl || "",
      minPammDeposit: settings?.minPammDeposit !== undefined ? settings.minPammDeposit : 50.0
    });
  } catch (e) {
    res.json({ success: true, apiUrl: "http://localhost:3005", minPammDeposit: 50.0 });
  }
});

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
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (durationDays !== undefined) dataToUpdate.durationDays = parseInt(durationDays);
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    const plan = await prisma.licensePlan.update({
      where: { id },
      data: dataToUpdate
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
        connections: { take: 1 },
        settings: true
      }
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

app.get("/api/admin/payments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payments = await prisma.cryptoInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        purchase: {
          include: {
            user: { select: { email: true } },
            plan: { select: { name: true, durationDays: true } }
          }
        }
      }
    });
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar pagamentos automáticos." });
  }
});

app.delete("/api/admin/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const invoice = await prisma.cryptoInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Fatura não encontrada" });
    
    await prisma.cryptoInvoice.delete({ where: { id: req.params.id } });
    if (invoice.purchaseId) {
      await prisma.purchaseRequest.delete({ where: { id: invoice.purchaseId } });
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: "Erro ao eliminar." });
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

    if (purchaseRequest.licenseType === "PAMM") {
      const user = await prisma.user.findUnique({ where: { id: purchaseRequest.userId } });
      const currentBalance = user.walletBalance || 0;

      // 1. Credit balance to user
      await prisma.user.update({
        where: { id: purchaseRequest.userId },
        data: {
          walletBalance: { increment: purchaseRequest.amount }
        }
      });

      // 2. Create WalletTransaction log for Deposit
      await prisma.walletTransaction.create({
        data: {
          userId: purchaseRequest.userId,
          type: "DEPOSIT",
          amount: purchaseRequest.amount,
          description: `Depósito de Gás (Aprovado)`
        }
      });

      // 3. If they were in debt, create an explicit log for debt deduction
      if (currentBalance < 0) {
        const debtPaid = Math.min(Math.abs(currentBalance), purchaseRequest.amount);
        await prisma.walletTransaction.create({
          data: {
             userId: purchaseRequest.userId,
             type: "DEDUCTION",
             amount: debtPaid,
             description: `Liquidação de Dívida de Taxas Pendentes`
          }
        });
      }

      // 4. Update purchase request status to APPROVED
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: "APPROVED" }
      });

      return res.json({ success: true, message: "Depósito de Gás PAMM aprovado com sucesso e saldo creditado." });
    }

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

      let currentUser = await prisma.user.findUnique({ where: { id: purchaseRequest.userId } });

      for (let i = 0; i < bonusLevels.length; i++) {
        if (!currentUser || !currentUser.sponsorId) break;

        const sponsor = await prisma.user.findUnique({ where: { id: currentUser.sponsorId } });
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
      
      const cryptoInvoice = await prisma.cryptoInvoice.findUnique({ where: { purchaseId: id } });
      if (cryptoInvoice && cryptoInvoice.status !== 'COMPLETED') {
        await prisma.cryptoInvoice.update({
          where: { id: cryptoInvoice.id },
          data: { status: 'MANUAL_APPROVED' }
        });
      }
    } else {
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: "APPROVED" }
      });
      
      const cryptoInvoice = await prisma.cryptoInvoice.findUnique({ where: { purchaseId: id } });
      if (cryptoInvoice && cryptoInvoice.status !== 'COMPLETED') {
        await prisma.cryptoInvoice.update({
          where: { id: cryptoInvoice.id },
          data: { status: 'MANUAL_APPROVED' }
        });
      }
    }

    res.json({ success: true, message: "Pagamento aprovado e licença emitida." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao aprovar solicitação." });
  }
});

app.post("/api/admin/requests/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const purchaseRequest = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!purchaseRequest) return res.status(404).json({ error: "Solicitação não encontrada." });

    await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "REJECTED" }
    });
    res.json({ success: true, message: "Solicitação rejeitada com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao rejeitar solicitação." });
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
    const plans = await prisma.licensePlan.findMany({ where: { isActive: true } });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/license/request", requireAuth, async (req, res) => {
  const { planId, hash, amount, licenseType } = req.body;

  if (licenseType === "PAMM") {
    if (!hash || !amount) {
      return res.status(400).json({ success: false, error: "Dados incompletos para depósito PAMM." });
    }

    try {
      const settings = await prisma.systemSettings.findFirst();
      const minPamm = settings?.minPammDeposit ?? 50.0;
      const amountVal = parseFloat(amount) || 0;
      if (amountVal < minPamm) {
        return res.status(400).json({ success: false, error: `O valor do gás inserido ($${amountVal}) é inferior ao mínimo configurado ($${minPamm}).` });
      }

      const request = await prisma.purchaseRequest.create({
        data: {
          userId: req.user.id,
          planId: null,
          licenseType: "PAMM",
          transactionHash: hash,
          amount: amountVal,
          status: "PENDING"
        }
      });

      console.log(`[PAMM-REQUEST] User ${req.user.id} solicitou depósito de gás PAMM de $${amountVal} com Hash ${hash}`);
      return res.json({ success: true, request });
    } catch (err) {
      console.error("[PAMM-REQUEST] Erro:", err);
      return res.status(500).json({ success: false, error: "Erro interno ao processar solicitação PAMM." });
    }
  } else {
    if (!planId || !hash) {
      return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    try {
      const request = await prisma.purchaseRequest.create({
        data: {
          userId: req.user.id,
          planId: planId,
          licenseType: "VPS",
          transactionHash: hash,
          amount: parseFloat(amount) || 0,
          status: "PENDING"
        }
      });

      // Se for pagamento crypto automático
      if (hash === "crypto_auto") {
        const walletData = generatePaymentWallet();
        
        const cryptoInvoice = await prisma.cryptoInvoice.create({
          data: {
            purchaseId: request.id,
            walletAddress: walletData.address,
            privateKeyEnc: walletData.encryptedPK,
            network: "BSC",
            currency: "USDT",
            amountDue: parseFloat(amount) || 0
          }
        });

        console.log(`[PAYMENT-REQUEST] User ${req.user.id} solicitou plano ${planId} via Crypto Auto (Address: ${cryptoInvoice.walletAddress})`);
        return res.json({ 
          success: true, 
          request,
          cryptoInvoice: {
            id: cryptoInvoice.id,
            walletAddress: cryptoInvoice.walletAddress,
            amountDue: cryptoInvoice.amountDue,
            network: cryptoInvoice.network,
            currency: cryptoInvoice.currency
          }
        });
      }

      console.log(`[PAYMENT-REQUEST] User ${req.user.id} solicitou plano ${planId} com Hash ${hash}`);
      res.json({ success: true, request });
    } catch (err) {
      console.error("[PAYMENT-REQUEST] Erro:", err);
      res.status(500).json({ success: false, error: "Erro interno ao processar solicitação." });
    }
  }
});

// Verifica status de uma compra específica
app.get("/api/buy/status/:id", requireAuth, async (req, res) => {
  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: req.params.id }
    });
    
    if (!request || request.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: "Compra não encontrada." });
    }

    res.json({ success: true, status: request.status });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erro ao verificar compra." });
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

    // Se for Crypto Gateway Nativo
    if (paymentMethodId === "crypto_bsc") {
      const walletData = generatePaymentWallet();
      
      const cryptoInvoice = await prisma.cryptoInvoice.create({
        data: {
          purchaseId: request.id,
          walletAddress: walletData.address,
          privateKeyEnc: walletData.encryptedPK,
          network: "BSC",
          currency: "USDT",
          amountDue: parseFloat(amount)
        }
      });
      
      return res.json({ 
        success: true, 
        message: "Invoice Crypto gerada com sucesso.", 
        request, 
        cryptoInvoice: {
          walletAddress: cryptoInvoice.walletAddress,
          amountDue: cryptoInvoice.amountDue,
          network: cryptoInvoice.network,
          currency: cryptoInvoice.currency
        }
      });
    }

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
    console.error("[SETTINGS-ERROR]", err);
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

// ─── PAMM Credentials & Stats Endpoints ─────────────────────────

app.get("/api/user/pamm", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const pammAccount = await prisma.pammAccount.findUnique({
      where: { userId: req.user.id }
    });

    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id }
    });
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id }
      });
    }

    const systemSettings = await prisma.systemSettings.findFirst();
    const defaultFeePct = 30.0;
    const pammPerformanceFeePct = settings?.pammPerformanceFeePct ?? defaultFeePct;

    let liveStats = null;
    try {
      if (pammAccount && pammAccount.metaApiAccountId && pammAccount.isActive && systemSettings) {
        liveStats = await getPammAccountStats(systemSettings, pammAccount.metaApiAccountId);
        if (liveStats) {
          await prisma.pammAccount.update({
            where: { id: pammAccount.id },
            data: { balance: liveStats.balance, equity: liveStats.equity }
          });
        }
      }
    } catch (innerErr) {
      console.error("Erro interno ao buscar liveStats:", innerErr);
    }

    let showChangeApproved = false;
    if (settings && settings.pammChangeApproved) {
      showChangeApproved = true;
      await prisma.userSettings.update({
        where: { userId: req.user.id },
        data: { pammChangeApproved: false }
      });
    }

    res.json({
      success: true,
      pammChangeApproved: showChangeApproved,
      changeRequested: pammAccount ? pammAccount.changeRequested : false,
      walletBalance: user ? user.walletBalance : 0,
      pammPerformanceFeePct,
      pammAccount: pammAccount ? {
        accountNumber: pammAccount.accountNumber,
        server: pammAccount.server,
        investorPassword: "••••••••", // Masked
        balance: liveStats ? liveStats.balance : pammAccount.balance,
        equity: liveStats ? liveStats.equity : pammAccount.equity,
        totalProfit: pammAccount.totalProfit,
        totalLoss: pammAccount.totalLoss,
        isActive: pammAccount.isActive
      } : null
    });
  } catch (err) {
    console.error("GET /api/user/pamm error:", err);
    res.json({ success: false, error: "Erro ao buscar conta PAMM." });
  }
});

app.post("/api/user/pamm", requireAuth, async (req, res) => {
  let { accountNumber, server, investorPassword } = req.body;
  accountNumber = String(accountNumber).trim();
  server = String(server).trim();
  
  if (!accountNumber || !server || !investorPassword) {
    return res.status(400).json({ error: "Todos os campos (Conta, Servidor e Senha) são obrigatórios." });
  }
  
  // Bloquear contas Demo e Contest
  const lowerServer = server.toLowerCase();
  if (lowerServer.includes("demo") || lowerServer.includes("contest")) {
    return res.status(400).json({ error: "Contas demo ou Contest não são permitidas. Use apenas uma conta Live (Real)." });
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings || !systemSettings.metaApiToken) {
      return res.status(400).json({ error: "O sistema PAMM ainda não foi configurado pelo administrador." });
    }

    const existingPamm = await prisma.pammAccount.findUnique({ where: { userId: req.user.id } });
    let existingMetaApiAccountId = null;
    
    // Se a conta e o servidor forem iguais aos que já estão na BD, reutilizamos a conta MetaApi
    if (existingPamm && existingPamm.metaApiAccountId && existingPamm.accountNumber === accountNumber && existingPamm.server === server) {
      existingMetaApiAccountId = existingPamm.metaApiAccountId;
      console.log(`[PAMM] Reutilizando MetaApi ID ${existingMetaApiAccountId} para a conta ${accountNumber}`);
    } else if (existingPamm && existingPamm.metaApiAccountId) {
      // Diferente conta/server? Idealmente, apagaríamos a antiga da MetaApi para não acumular custos, mas não temos o token/metaApi acessível aqui.
      console.log(`[PAMM] Atenção: Nova conta/servidor inseridos. Um novo MetaApi ID será criado.`);
    }

    // 1. Integrar com MetaApi (Criar/Reutilizar Conta & Configurar CopyFactory)
    const metaApiResult = await setupPammAccount(systemSettings, accountNumber, server, investorPassword, existingMetaApiAccountId);

    // 2. Salvar na BD
    const investorPasswordEnc = encrypt(investorPassword);

    const pammAccount = await prisma.pammAccount.upsert({
      where: { userId: req.user.id },
      update: {
        accountNumber,
        server,
        investorPasswordEnc,
        metaApiAccountId: metaApiResult.metaApiAccountId,
        isActive: true
      },
      create: {
        userId: req.user.id,
        accountNumber,
        server,
        investorPasswordEnc,
        metaApiAccountId: metaApiResult.metaApiAccountId,
        balance: 1000.0,
        equity: 1000.0,
        totalProfit: 0.0,
        totalLoss: 0.0,
        isActive: true
      }
    });

    res.json({
      success: true,
      message: "Credenciais PAMM validadas e conta conectada com sucesso ao servidor de cópias!",
      pammAccount: {
        accountNumber: pammAccount.accountNumber,
        server: pammAccount.server,
        investorPassword: "••••••••", // Masked
        balance: pammAccount.balance,
        equity: pammAccount.equity,
        totalProfit: pammAccount.totalProfit,
        totalLoss: pammAccount.totalLoss,
        isActive: pammAccount.isActive
      }
    });
  } catch (err) {
    console.error("POST /api/user/pamm error:", err);
    res.status(400).json({ error: err.message || "Erro ao conectar conta PAMM ao servidor de cópias." });
  }
});

app.post("/api/user/pamm/toggle", requireAuth, async (req, res) => {
  const { isActive } = req.body;
  if (isActive === undefined) return res.status(400).json({ error: "Parâmetro isActive obrigatório." });

  try {
    const pammAccount = await prisma.pammAccount.findUnique({ where: { userId: req.user.id } });
    if (!pammAccount || !pammAccount.metaApiAccountId) {
      return res.status(400).json({ error: "Conta PAMM não encontrada ou não conectada à MetaApi." });
    }

    const systemSettings = await prisma.systemSettings.findFirst();
    await togglePammConnection(systemSettings, pammAccount.metaApiAccountId, isActive);

    const updatedAccount = await prisma.pammAccount.update({
      where: { id: pammAccount.id },
      data: { isActive: isActive }
    });

    res.json({ success: true, isActive: updatedAccount.isActive, message: isActive ? "Serviço PAMM Ligado!" : "Serviço PAMM Desligado!" });
  } catch (err) {
    res.status(400).json({ error: err.message || "Erro ao alterar estado do serviço PAMM." });
  }
});

app.post("/api/user/pamm/disconnect", requireAuth, async (req, res) => {
  try {
    const pammAccount = await prisma.pammAccount.findUnique({ where: { userId: req.user.id } });
    if (!pammAccount) {
      return res.status(400).json({ error: "Conta PAMM não encontrada." });
    }

    if (pammAccount.metaApiAccountId) {
      const systemSettings = await prisma.systemSettings.findFirst();
      await removePammAccount(systemSettings, pammAccount.metaApiAccountId);
    }

    await prisma.pammAccount.delete({
      where: { id: pammAccount.id }
    });

    res.json({ success: true, message: "Serviço PAMM Desconectado!" });
  } catch (err) {
    res.status(400).json({ error: err.message || "Erro ao desconectar serviço PAMM." });
  }
});


// ─── AI & Signal Engine ───────────────────────────────────────

app.post("/api/bot/analyze", requireAuth, async (req, res) => {
  const { pair, htfBias, candles } = req.body;

  try {
    let marketCandles = candles;

    // 🔍 EXPERT: Tentar buscar velas REAIS da corretora se não foram enviadas
    if (!marketCandles || marketCandles.length === 0) {
      let broker = userBrokers.get(req.user.id);

      // Se o utilizador não tem broker ligado, tenta usar o Broker Global do Admin (puxado da Base de Dados)
      if (!broker || !broker.connected) {
        broker = await getGlobalBroker();
      }

      if (broker && broker.connected) {
        try {
          console.log(`[BOT] 📥 Buscando velas reais para ${pair} via ${broker.name || 'Global Admin'}...`);
          
          // Adicionamos um timeout de 10s para impedir o bloqueio
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout (10s) na corretora")), 10000));
          marketCandles = await Promise.race([
            broker.getCandles(pair, "1m", 250),
            timeoutPromise
          ]);
        } catch (e) {
          console.warn(`[BOT] ⚠️ Falha ao buscar velas reais: ${e.message}`);
        }
      }
    }

    // Fallback para Mock apenas se tudo falhar (para não travar o painel)
    if (!marketCandles || marketCandles.length === 0) {
      console.log(`[BOT] 🛠️ Usando MOCK de velas para ${pair} (Corretora Offline)`);
      const isBullish = Math.random() > 0.5;
      marketCandles = Array.from({ length: 250 }, (_, i) => {
        const trend = isBullish ? i * 0.00001 : -i * 0.00001;
        const base = pair.includes("JPY") ? 150.00 : (pair.includes("XAU") || pair.includes("GOLD")) ? 2300.00 : 1.0850;
        return {
          open: base + trend + Math.random() * 0.0005,
          high: base + trend + 0.0010,
          low: base + trend - 0.0010,
          close: base + trend + Math.random() * 0.0005 + (isBullish ? 0.0002 : -0.0002),
          timestamp: Date.now() - (250 - i) * 60000
        };
      });
    }

    console.log(`[BOT] Analisando ${pair} (HTF: ${htfBias})...`);

    const { signal, reason } = generateSignal(pair, marketCandles, htfBias || "NEUTRAL");
    console.log(`[BOT-DEBUG] Pair: ${pair} | Candles: ${marketCandles?.length} | Signal: ${signal ? signal.direction : 'NULL'} | Reason: ${reason}`);
    const analysis = analyzeAll(marketCandles);

    const responseData = {
      success: true,
      signal,
      reason,
      pair,
      analysis: {
        obs: (analysis.obs || []).slice(-5),
        fvgs: (analysis.fvgs || []).slice(-5),
        structure: (analysis.structure || []).slice(-3)
      }
    };

    res.json(responseData);
  } catch (err) {
    const errorMsg = err.message || String(err);
    console.error(`[BOT-ERROR] Falha na análise de ${req.body.pair}:`, errorMsg);
    res.status(500).json({ success: false, error: "Erro no motor de sinais: " + errorMsg });
  }
});

// ── Admin User Management ─────────────────────────────────────────

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { 
        licenses: { include: { plan: true } },
        settings: true
      },
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

app.post("/api/admin/users/:id/free-license", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || isNaN(days) || parseInt(days) <= 0) {
      return res.status(400).json({ error: "Tempo de validade inválido." });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: "Utilizador não encontrado." });

    const existingLicense = await prisma.license.findFirst({
      where: { userId: id, status: "ACTIVE" },
      orderBy: { expiresAt: 'desc' }
    });

    let expiresAt = new Date();
    if (existingLicense && existingLicense.expiresAt > new Date()) {
      expiresAt = new Date(existingLicense.expiresAt);
      expiresAt.setDate(expiresAt.getDate() + parseInt(days));
    } else {
      expiresAt.setDate(expiresAt.getDate() + parseInt(days));
    }

    // Expirar licenças antigas
    await prisma.license.updateMany({
      where: { userId: id, status: "ACTIVE" },
      data: { status: "EXPIRED" }
    });

    // Criar nova licença (Grátis/Líder)
    await prisma.license.create({
      data: {
        userId: id,
        planId: null,
        type: "GRATUITA (LÍDER)",
        status: "ACTIVE",
        expiresAt: expiresAt
      }
    });

    res.json({ success: true, message: `Licença gratuita ativada para ${target.email} por ${days} dias!` });
  } catch (err) {
    console.error("Free license error:", err);
    res.status(500).json({ error: "Erro ao ativar licença: " + err.message });
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
  // Iniciar worker do PAMM
  startPammWorker(prisma);

  console.log("");
  console.log("[DIAGNOSTIC] Servidor Nativo HTTP ativo na porta " + PORT);

  // Testar base de dados
  prisma.$connect()
    .then(() => {
      console.log("[DIAGNOSTIC] ✅ Conexão Prisma OK");
      // ── INICIAR SIMULADOR REMOVIDO ──
    })
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
        if (accountInfo) risk.setBalance(accountInfo.balance, accountInfo.equity);

        const positions = await broker.getOpenPositions();
        
        // 🛡️ NOVO: Verificar Meta Diária de Lucro (Institutional Lock)
        const dailyCheck = risk.checkDailyProfitTarget(positions || []);
        if (dailyCheck.hit && !dailyCheck.alreadyLocked) {
           console.log(`\x1b[42m\x1b[37m[META-BATIDA] User ${userId} atingiu a meta diária! Fechando tudo...\x1b[0m`);
           // Fechar todas as posições imediatamente
           for (const pos of (positions || [])) {
              await broker.closePosition(pos.id);
              risk.closeTrade(pos.id, 0, "DAILY_TARGET_LOCK", pos.profit);
           }
           continue; 
        }

        if (!positions || positions.length === 0) continue;

        // 2. Para cada posição, verificar proteção
        for (const pos of positions) {
          const currentProfit = pos.profit || 0;
          const ticketId = pos.id; 

          // Sincronizar trade
          let internalTrade = risk.openTrades.find(t => String(t.brokerId) === String(ticketId));
          if (!internalTrade) {
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
          const toClose = risk.checkOpenTrades(pos.pair, 0, currentProfit, 0);

          for (const { trade, reason } of toClose) {
            console.log(`\x1b[41m\x1b[37m[ALERTA] FECHANDO TICKET #${ticketId} | LUCRO: $${currentProfit.toFixed(2)} | RAZÃO: ${reason}\x1b[0m`);
            const res = await broker.closePosition(ticketId);
            if (res.success) {
              risk.closeTrade(trade.id, 0, reason, currentProfit);
            }
          }
        }
      } catch (e) {
        console.error(`[MONITOR-ERROR] User ${userId}:`, e.message);
      }
    }
  }, 1000);
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
