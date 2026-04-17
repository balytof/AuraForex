const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const { encrypt, decrypt } = require("./utils/encryption");

// Broker Adapters
const OandaAdapter = require("./broker-adapters/oanda");
const CapitalAdapter = require("./broker-adapters/capital");
const MetaApiAdapter = require("./broker-adapters/metaapi");

const app = express();
const PORT = process.env.PORT || 3001;
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

function getBrokerAdapter(type) {
  switch (type) {
    case "oanda":   return new OandaAdapter();
    case "capital": return new CapitalAdapter();
    case "metaapi": return new MetaApiAdapter();
    default:        throw new Error(`Corretora desconhecida: ${type}`);
  }
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

// Middleware garante Corretora Conectada
function requireBrokerAuth(req, res, next) {
  const activeBroker = userBrokers.get(req.user.id);
  if (!activeBroker || !activeBroker.connected) {
    return res.status(403).json({ error: "Nenhuma corretora conectada neste momento." });
  }
  req.broker = activeBroker;
  next();
}

// ── Auth Endpoints (SaaS) ─────────────────────────────────────────
// Rotas movidas para cima para diagnóstico


app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Dados inválidos." });

  try {
    console.log(`[AUTH] Tentativa de login: ${email}`);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais erradas." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciais erradas." });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Auto-Connect Corretora Gravada
    let autoConnected = false;
    let bType = null;
    const connection = await prisma.brokerConnection.findFirst({ where: { userId: user.id } });
    if (connection) {
       try {
         const credentials = {
           environment: connection.environment,
           accountId: connection.accountId,
           apiToken: decrypt(connection.apiTokenEncrypted),
           metaApiToken: decrypt(connection.apiTokenEncrypted),
           identifier: decrypt(connection.capitalIdentifier),
           password: decrypt(connection.capitalPassword),
           apiKey: decrypt(connection.apiTokenEncrypted),
           region: connection.region
         };
         const adapter = getBrokerAdapter(connection.brokerType);
         const resConn = await adapter.connect(credentials);
         if (resConn.success) {
           userBrokers.set(user.id, adapter);
           autoConnected = true;
           bType = connection.brokerName;
         }
       } catch(e) { console.error("Erro Auto-Connect:", e.message); }
    }

    res.json({ success: true, token, autoConnected, broker: bType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Verifica se token do cache UI ainda está ativo
app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── Broker Endpoints ──────────────────────────────────────────────

app.get("/api/broker/status", requireAuth, async (req, res) => {
  const activeBroker = userBrokers.get(req.user.id);
  if (!activeBroker) return res.json({ connected: false, broker: null });
  return res.json(activeBroker.getStatus());
});

app.post("/api/broker/connect", requireAuth, async (req, res) => {
  const { brokerType, credentials, remember } = req.body;
  console.log(`[DEBUG] Tentativa de conexão broker: ${brokerType} (User: ${req.user.id.substring(0,8)})`);
  if (!brokerType || !credentials) return res.status(400).json({ success: false, error: "Dados incompletos." });

  try {
    let activeBroker = userBrokers.get(req.user.id);
    if (activeBroker && activeBroker.connected) {
      try { await activeBroker.disconnect(); } catch (e) {}
    }

    activeBroker = getBrokerAdapter(brokerType);
    const result = await activeBroker.connect(credentials);

    if (!result.success) return res.status(401).json(result);

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
    return res.status(500).json({ success: false, error: "Erro interno no servidor ao conectar." });
  }
});

app.post("/api/broker/disconnect", requireAuth, async (req, res) => {
  const { forgetDb } = req.body;
  const activeBroker = userBrokers.get(req.user.id);
  
  if (activeBroker) {
    await activeBroker.disconnect();
    userBrokers.delete(req.user.id);
  }

  if (forgetDb !== false) {
    await prisma.brokerConnection.deleteMany({ where: { userId: req.user.id } });
  }

  return res.json({ success: true });
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

app.post("/api/broker/order", requireAuth, requireBrokerAuth, async (req, res) => {
  const { pair, direction, lotSize, sl, tp } = req.body;
  if (!pair || !direction || !lotSize) return res.status(400).json({ error: "Faltam parametros" });
  try {
    const result = await req.broker.placeOrder({ pair, direction, lotSize, sl, tp });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/broker/position/:id", requireAuth, requireBrokerAuth, async (req, res) => {
  try {
    const result = await req.broker.closePosition(req.params.id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/candles", requireAuth, requireBrokerAuth, async (req, res) => {
  const { pair, timeframe, count } = req.query;
  try { res.json({ candles: await req.broker.getCandles(pair, timeframe || "H1", parseInt(count) || 250) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/price", requireAuth, requireBrokerAuth, async (req, res) => {
  const { pair } = req.query;
  try { res.json(await req.broker.getPrice(pair)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Static Files & Login Page ──────────────────────────────────────

let lastModTimes = {};
if (!isProd) {
  app.get("/__reload_check", (req, res) => { res.json({ changed: false }); }); // Desativado dev reload auto para n quebrar requests jwt
}

app.use((req, res) => {
  let urlPath = req.path;
  
  if (urlPath === "/" || urlPath === "" || urlPath === "/login") {
    urlPath = "/login.html";
  } else if (urlPath === "/dashboard") {
    urlPath = "/smc_bot_dashboard.html";
  }

  const filePath = path.join(ROOT, urlPath);
  
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (urlPath !== "/smc_bot_dashboard.html" && urlPath !== "/login.html") return res.status(404).send("Not Found");
    return res.status(404).send("Arquivo não encontrado.");
  }

  // Prevenir Directory Traversal Attack
  if (!path.resolve(filePath).startsWith(path.resolve(ROOT))) return res.status(403).send("Forbidden");

  res.sendFile(filePath);
});

// ── Startup ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║                                                      ║");
  console.log("  ║   🔒  AuraForex SaaS API Server                     ║");
  console.log("  ║   📦  PostgreSQL & JWT Auth Ready                   ║");
  console.log(`  ║   🌐  http://localhost:${PORT}                          ║`);
  console.log("  ║                                                      ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log("");
});

// Tratamento de Erros Globais para o Expert
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ ERROR [Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ ERROR [Uncaught Exception]:", err.message);
  console.error(err.stack);
});
