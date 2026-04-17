/**
 * ============================================================
 *  AuraForex — API Server
 *  Serves dashboard + proxies broker API calls
 * ============================================================
 */

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

// Broker Adapters
const OandaAdapter = require("./broker-adapters/oanda");
const CapitalAdapter = require("./broker-adapters/capital");
const MetaApiAdapter = require("./broker-adapters/metaapi");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const isProd = process.env.NODE_ENV === "production";

// ── Security Middlewares ─────────────────────────────────────────
app.set("trust proxy", 1); // Trus proxy se estiver atrás de um Nginx

// 1. Helmet para Security Headers (configurando Content-Security-Policy para aceitar scripts inline pelo Live Reload caso não esteja em PROD)
app.use(helmet({
  contentSecurityPolicy: isProd ? undefined : false,
}));

// 2. CORS Limits
app.use(cors({
  origin: "*", // Mude para o seu domínio real em produção ex: "https://auraforex.com"
  credentials: true
}));

// 3. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Rate Limiting (Proteção contra Brute Force)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Limite de 200 requests por IP
  message: { error: "Muitas requisições deste IP, tente mais tarde." }
});
app.use("/api/", apiLimiter);

// 5. Sessões Seguras em Memória (Isolamento Multi-Utilizador)
app.use(session({
  secret: process.env.SESSION_SECRET || "auraforex_super_secret_key_123!@#",
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: isProd, // Deve ser true em Produção (requer HTTPS validado pelo Nginx)
    httpOnly: true, // Bloqueia acesso ao cookie via JS e evita XSS
    maxAge: 4 * 60 * 60 * 1000, // Sessão de 4 horas
    sameSite: 'lax'
  }
}));

// ── Active Brokers Map (Segregação de Usuários) ───────────────────
// Em vez de 1 variável, usamos um Map mapeando o sessionId do Express à instância da corretora
const userBrokers = new Map();

function getBrokerAdapter(type) {
  switch (type) {
    case "oanda":   return new OandaAdapter();
    case "capital": return new CapitalAdapter();
    case "metaapi": return new MetaApiAdapter();
    default:        throw new Error(`Corretora desconhecida: ${type}`);
  }
}

// ── Live Reload (Apenas Modo Desenvolvedor) ───────────────────────
let lastModTimes = {};
function getFileModTimes() {
  const exts = [".html", ".css", ".js"];
  const times = {};
  try {
    const files = fs.readdirSync(ROOT);
    for (const file of files) {
      if (exts.includes(path.extname(file).toLowerCase())) {
        times[file] = fs.statSync(path.join(ROOT, file)).mtimeMs;
      }
    }
  } catch (e) {}
  return times;
}
lastModTimes = getFileModTimes();

function hasFilesChanged() {
  const current = getFileModTimes();
  for (const [file, mtime] of Object.entries(current)) {
    if (!lastModTimes[file] || lastModTimes[file] !== mtime) {
      lastModTimes = current;
      return true;
    }
  }
  return false;
}

if (!isProd) {
  app.get("/__reload_check", (req, res) => {
    res.json({ changed: hasFilesChanged() });
  });
}

// ── Middleware para verificar Autenticação do Broker ────────────
function requireBrokerAuth(req, res, next) {
  const activeBroker = userBrokers.get(req.sessionID);
  if (!activeBroker || !activeBroker.connected) {
    return res.status(403).json({ error: "Nenhuma corretora conectada nesta sessão." });
  }
  req.broker = activeBroker;
  next();
}

// ── API Router ──────────────────────────────────────────────────

// Status (Aberto)
app.get("/api/broker/status", (req, res) => {
  const activeBroker = userBrokers.get(req.sessionID);
  if (!activeBroker) {
    return res.json({ connected: false, broker: null });
  }
  return res.json(activeBroker.getStatus());
});

// Substituir brokers em RAM no servidor
app.post("/api/broker/connect", async (req, res) => {
  const { brokerType, credentials } = req.body;

  if (!brokerType || !credentials) {
    return res.status(400).json({ success: false, error: "brokerType e credentials são obrigatórios" });
  }

  try {
    // Desconectar corretora existente deste mesmo utilizador
    let activeBroker = userBrokers.get(req.sessionID);
    if (activeBroker && activeBroker.connected) {
      try { await activeBroker.disconnect(); } catch (e) {}
    }

    activeBroker = getBrokerAdapter(brokerType);
    const result = await activeBroker.connect(credentials);

    if (!result.success) {
      return res.status(401).json(result);
    }

    // Vincular instância de corretora à sessão atual
    userBrokers.set(req.sessionID, activeBroker);

    console.log(`✅ [Sessão: ${req.sessionID.substring(0,8)}] Conectado: ${activeBroker.name} | Saldo: ${result.accountInfo.balance}`);
    return res.json(result);
  } catch (e) {
    console.error("❌ Erro no Connect:", e.message);
    return res.status(500).json({ success: false, error: "Erro interno no servidor ao conectar." });
  }
});

app.post("/api/broker/disconnect", async (req, res) => {
  const activeBroker = userBrokers.get(req.sessionID);
  if (activeBroker) {
    const name = activeBroker.name;
    await activeBroker.disconnect();
    userBrokers.delete(req.sessionID);
    console.log(`🔌 [Sessão: ${req.sessionID.substring(0,8)}] Desconectado: ${name}`);
  }
  return res.json({ success: true });
});

// Endpoints Protegidos
app.get("/api/broker/account", requireBrokerAuth, async (req, res) => {
  try {
    const info = await req.broker.getAccountInfo();
    res.json(info);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/positions", requireBrokerAuth, async (req, res) => {
  try {
    const positions = await req.broker.getOpenPositions();
    res.json({ positions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/history", requireBrokerAuth, async (req, res) => {
  try {
    const history = await req.broker.getHistory(req.query);
    res.json({ history });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/broker/order", requireBrokerAuth, async (req, res) => {
  const { pair, direction, lotSize, sl, tp } = req.body;
  if (!pair || !direction || !lotSize) {
    return res.status(400).json({ error: "pair, direction e lotSize são obrigatórios" });
  }
  try {
    console.log(`📊 [Sessão: ${req.sessionID.substring(0,8)}] Ordem: ${direction} ${pair} | Lote: ${lotSize}`);
    const result = await req.broker.placeOrder({ pair, direction, lotSize, sl, tp });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/broker/position/:id", requireBrokerAuth, async (req, res) => {
  try {
    const result = await req.broker.closePosition(req.params.id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/candles", requireBrokerAuth, async (req, res) => {
  const { pair, timeframe, count } = req.query;
  if (!pair) return res.status(400).json({ error: "pair é obrigatório" });
  try {
    const candles = await req.broker.getCandles(pair, timeframe || "H1", parseInt(count) || 250);
    res.json({ candles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/broker/price", requireBrokerAuth, async (req, res) => {
  const { pair } = req.query;
  if (!pair) return res.status(400).json({ error: "pair é obrigatório" });
  try {
    const price = await req.broker.getPrice(pair);
    res.json(price);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Static Files & Catch All ──────────────────────────────────────

const LIVE_RELOAD_SCRIPT = `
<script>
  (function() {
    setInterval(async () => {
      try {
        const res = await fetch('/__reload_check');
        const data = await res.json();
        if (data.changed) location.reload();
      } catch(e) {}
    }, 1500);
  })();
</script>
`;

app.use((req, res) => {
  let urlPath = req.path;
  if (urlPath === "/" || urlPath === "") urlPath = "/smc_bot_dashboard.html";

  const filePath = path.join(ROOT, urlPath);
  
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (urlPath !== "/smc_bot_dashboard.html") return res.status(404).send("Not Found");
    return res.status(404).send("Dashboard file not found.");
  }

  // Directory Traversal Security
  const resolvedRoot = path.resolve(ROOT);
  const resolvedFilePath = path.resolve(filePath);
  if (!resolvedFilePath.startsWith(resolvedRoot)) {
    return res.status(403).send("Forbidden");
  }

  if (urlPath.endsWith(".html") && !isProd) {
    let html = fs.readFileSync(filePath, "utf-8");
    html = html.replace("</body>", `${LIVE_RELOAD_SCRIPT}\n</body>`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  }

  res.sendFile(resolvedFilePath);
});

// ── Startup ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════╗");
  console.log("  ║                                                      ║");
  console.log("  ║   🔒  AuraForex — Secure API Server                 ║");
  console.log("  ║                                                      ║");
  console.log(`  ║   🌐  http://localhost:${PORT}                          ║`);
  console.log(`  ║   🛡️  Sessões Seguras: ATIVADO                      ║`);
  console.log(`  ║   ⏱️  Rate Limiting:   ATIVADO                      ║`);
  console.log(`  ║   🔄  Live reload:     ${!isProd ? "ATIVADO                      " : "DESATIVADO (PROD)            "}║`);
  console.log("  ║                                                      ║");
  console.log("  ╚══════════════════════════════════════════════════════╝");
  console.log("  Ctrl+C para parar o servidor\n");
});
