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
        sponsorId
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

// ── Admin Affiliate Endpoints ────────────────────────────────────

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
