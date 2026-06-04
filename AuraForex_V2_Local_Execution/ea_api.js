const express = require("express");
const router = express.Router();
const prisma = require("./db");
const { getRiskManager } = require("./risk/store");

/**
 * ── ENDPOINT: VALIDATE ──────────────────────────────────────────────
 * O EA chama este endpoint ao iniciar para verificar se a licença é válida
 * e se está amarrada ao número da conta MetaTrader correto.
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/validate", async (req, res) => {
  const { licenseKey, mtAccount } = req.body;

  if (!licenseKey || !mtAccount) {
    return res.status(400).json({ status: "BLOCKED", error: "Dados incompletos (licenseKey, mtAccount)." });
  }

  try {
    const license = await prisma.license.findUnique({
      where: { id: licenseKey },
      include: { user: true }
    });

    if (!license) {
      return res.status(404).json({ status: "BLOCKED", error: "Licença não encontrada." });
    }

    if (license.status !== "ACTIVE" || new Date(license.expiresAt) < new Date()) {
      return res.status(403).json({ status: "BLOCKED", error: "Licença expirada ou inativa." });
    }

    // Se a licença ainda não tem conta MT, amarra agora (Primeiro uso)
    if (!license.mtAccount) {
      await prisma.license.update({
        where: { id: licenseKey },
        data: { mtAccount: mtAccount.toString() }
      });
      console.log(`[EA-AUTH] Licença ${licenseKey} amarrada à conta ${mtAccount}`);
    }
    // Se já tem, verifica se coincide
    else if (license.mtAccount !== mtAccount.toString()) {
      return res.status(403).json({ status: "BLOCKED", error: "Esta licença está vinculada a outra conta MetaTrader." });
    }

    return res.json({
      status: "OK",
      message: "Licença validada com sucesso.",
      user: license.user.email,
      expiresAt: license.expiresAt
    });

  } catch (err) {
    console.error("[EA-AUTH] Erro na validação:", err);
    return res.status(500).json({ status: "BLOCKED", error: "Erro interno no servidor." });
  }
});

/**
 * ── ENDPOINT: SIGNALS ───────────────────────────────────────────────
 * O EA chama este endpoint periodicamente (ex: a cada 1s) para buscar
 * novas ordens pendentes geradas pelas estratégias no servidor.
 * ─────────────────────────────────────────────────────────────────────
 */
router.get("/signals", async (req, res) => {
  const { licenseKey } = req.query;

  if (!licenseKey) {
    return res.status(400).json({ error: "licenseKey obrigatória." });
  }

  try {
    const license = await prisma.license.findUnique({
      where: { id: licenseKey },
      include: { user: true }
    });

    if (!license || license.status !== "ACTIVE") {
      return res.status(403).json({ error: "Licença inválida." });
    }

    // O EA local (MT5) não deve ser bloqueado por falta de saldo PAMM
    // O bloqueio de saldo (Gás) aplica-se apenas ao serviço PAMM (MetaApi)

    // LOG DE DIAGNÓSTICO (Expert Method)
    const pendingCount = await prisma.signal.count({ where: { status: "PENDING" } });
    console.log(`[EA-DEBUG] Licença: ${licenseKey} | Dono: ${license.userId} | Sinais Pendentes na DB: ${pendingCount}`);

    // Busca sinais PENDENTES para o usuário dono da licença
    // 🛡️ CORREÇÃO CRÍTICA (FANTASMAS): Ignorar sinais pendentes criados há mais de 2 minutos!
    const timeLimit = new Date(Date.now() - 2 * 60000); 

    const signals = await prisma.signal.findMany({
      where: {
        userId: license.userId,
        status: "PENDING",
        createdAt: { gte: timeLimit }
      },
      orderBy: { createdAt: "asc" }
    });

    if (signals.length > 0) {
      console.log(`[EA-DEBUG] ✅ Enviando ${signals.length} sinais para o robô.`);
    }

    // Heartbeat: Atualiza o updatedAt da licença para indicar que o EA está ativo
    await prisma.license.update({
      where: { id: licenseKey },
      data: { updatedAt: new Date() }
    });

    // Formata os sinais para garantir que o EA receba texto (string) e não IDs numéricos
    const formattedSignals = signals.map(s => ({
      id: String(s.id).trim(),
      pair: String(s.pair).trim().toUpperCase(),
      direction: String(s.direction).trim().toUpperCase(),
      entry: Number(s.entry || 0),
      sl: Number(s.sl || 0),
      tp: Number(s.tp || 0),
      lot: Number(s.lot || 0.01)
    }));

    console.log(`[EA-SIGNALS] Enviando ${formattedSignals.length} sinais para ${license.userId}`);
    return res.status(200).json({ success: true, signals: formattedSignals });

  } catch (err) {
    console.error("[EA-SIGNALS] Erro ao buscar sinais:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/**
 * ── ENDPOINT: REPORT ────────────────────────────────────────────────
 * O EA chama este endpoint após executar uma ordem para atualizar o status
 * no servidor (ajuda no dashboard e estatísticas).
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/report", async (req, res) => {
  const { signalId, status, orderTicket, profit } = req.body;

  if (!signalId || !status) {
    return res.status(400).json({ error: "signalId e status são obrigatórios." });
  }

  try {
    const signal = await prisma.signal.findUnique({
      where: { id: signalId },
      include: { user: { include: { settings: true } } }
    });

    if (!signal) {
      return res.status(404).json({ error: "Sinal não encontrado." });
    }

    // Atualizar sinal
    const updateData = {
      status: status
    };
    
    if (orderTicket) {
      updateData.brokerId = orderTicket.toString();
    }

    if (status === "EXECUTED") {
      updateData.executedAt = new Date();
    }

    await prisma.signal.update({
      where: { id: signalId },
      data: updateData
    });

    // 🛡️ SINCRONIA: Se o trade for FECHADO, adicioná-lo ao Histórico local para exibição na UI
    if (status === "CLOSED" && profit !== undefined) {
      const risk = getRiskManager(signal.userId);
      const closeTimeIso = new Date().toISOString();
      const tradeObj = {
         id: signalId,
         pair: signal.pair,
         direction: signal.direction,
         lotSize: signal.lotSize || 0.01,
         pnl: parseFloat(profit),
         closeTime: closeTimeIso,
         closedAt: closeTimeIso
      };
      
      if (!risk.tradeHistory) risk.tradeHistory = [];
      risk.tradeHistory.unshift(tradeObj);
      if (risk.tradeHistory.length > 100) risk.tradeHistory.pop(); // manter últimos 100
      
      // Salvar disco em background
      if (typeof risk._saveHistory === 'function') {
         setTimeout(() => risk._saveHistory(), 1000);
      }
    }

    console.log(`[EA-REPORT] Sinal ${signalId} atualizado para: ${status} (Ticket: ${orderTicket || 'N/A'})`);

    // Lógica de Dedução de Lucro por Ordem (Carteira Pré-Paga PAMM)
    if (status === "CLOSED" && profit !== undefined) {
      const profitVal = parseFloat(profit);
      if (profitVal > 0) {
        const systemSettings = await prisma.systemSettings.findFirst();
        const feePct = signal.user.settings?.pammPerformanceFeePct ?? systemSettings?.defaultPammPerformanceFee ?? 30.0;
        const feeAmount = profitVal * (feePct / 100);

        const updatedUser = await prisma.user.update({
          where: { id: signal.userId },
          data: {
            walletBalance: {
              decrement: feeAmount
            }
          }
        });

        await prisma.walletTransaction.create({
          data: {
            userId: signal.userId,
            type: "DEDUCTION",
            amount: feeAmount,
            description: `Taxa de Performance PAMM (${feePct}%) - Ordem #${orderTicket || signal.brokerId || 'N/A'}`
          }
        });

        console.log(`[EA-FEES] Taxa de $${feeAmount.toFixed(2)} (${feePct}%) deduzida de ${signal.user.email} (Novo saldo: $${updatedUser.walletBalance.toFixed(2)})`);

        if (updatedUser.walletBalance < 10) {
          console.warn(`[EA-ALERT] Saldo do usuário ${signal.user.email} está abaixo do limite de $10: $${updatedUser.walletBalance.toFixed(2)}`);
        }
      } else {
        console.log(`[EA-FEES] Sem dedução para ordem ${signalId} (lucro de $${profitVal.toFixed(2)})`);
      }
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("[EA-REPORT] Erro ao reportar execução:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/**
 * ── ENDPOINT: REPORT-BALANCE ─────────────────────────────────────────
 * O EA chama este endpoint periodicamente para atualizar o saldo e equity
 * da conta MetaTrader na base de dados.
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/report-balance", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "No body" });
  }

  const { 
    licenseKey, balance, equity, dailyPnl, realizedPnl, 
    dailyProfitTarget, dailyLossLimit,
    isLocked, isProfitLocked, isLossLocked 
  } = req.body;

  console.log(`[REPORT-BALANCE-DEBUG] Received from EA: License=${licenseKey}, Balance=${balance}, Equity=${equity}`);

  if (!licenseKey || balance === undefined || equity === undefined) {
    return res.status(400).json({ error: "Dados incompletos (licenseKey, balance, equity)." });
  }

  try {
    await prisma.license.update({
      where: { id: licenseKey },
      data: {
        balance: parseFloat(balance),
        equity: parseFloat(equity),
        updatedAt: new Date()
      }
    });

    // 🛡️ SINCRONIA INSTITUCIONAL: Atualizar RiskManager do servidor
    const lic = await prisma.license.findUnique({
      where: { id: licenseKey }
    });

    if (!lic) {
      return res.status(404).json({ error: "Licença não encontrada." });
    }

    const { getRiskManager } = require("./risk/store");
    const risk = getRiskManager(licenseKey); // Usa a licença para ter gestão de risco independente por conta

    // 🛡️ Sincronia Rápida de Equidade e Balance no Gestor de Risco
    risk.balance = parseFloat(balance);
    risk.equity = parseFloat(equity);
    risk.dailyPnl = parseFloat(dailyPnl || 0);
    risk.realizedPnl = parseFloat(realizedPnl || 0);
    
    // Sincroniza configurações de meta dinâmicas
    if (dailyProfitTarget !== undefined) risk.dailyProfitTarget = parseFloat(dailyProfitTarget);
    if (dailyLossLimit !== undefined) risk.dailyLossLimit = parseFloat(dailyLossLimit);
    
    // 🛡️ SINCRONIA INSTITUCIONAL DE OPEN TRADES: Receber diretamente do EA
    if (req.body.openTrades && Array.isArray(req.body.openTrades)) {
       risk.openTrades = req.body.openTrades.map(t => ({
         id: t.id,
         brokerId: t.id,
         pair: t.pair,
         direction: t.direction,
         profit: t.profit,
         lotSize: t.lotSize,
         openPrice: t.openPrice
       }));
    } else {
       risk.openTrades = [];
    }

    // 🛡️ SINCRONIA INSTITUCIONAL DE CLOSED TRADES (Histórico)
    if (req.body.closedTrades && Array.isArray(req.body.closedTrades)) {
       risk.closedTrades = req.body.closedTrades.map(t => ({
         id: t.id,
         brokerId: t.id,
         pair: t.pair,
         direction: t.direction,
         pnl: t.profit,
         lotSize: t.lotSize,
         closePrice: t.closePrice,
         closeTime: new Date(t.closeTime * 1000).toISOString()
       }));
    } else {
       if(!risk.closedTrades) risk.closedTrades = []; // Preserva se o EA não enviar
    }

    console.log(`[EA-SYNC-DEBUG] User: ${lic.userId} | License: ${licenseKey} | OpenTrades: ${risk.openTrades.length} | isLocked: ${isLocked} | isProfit: ${isProfitLocked} | isLoss: ${isLossLocked}`);

    // Sincroniza estados de trava vindo do EA
    if (isLocked !== undefined) {
      risk.dailyProfitLocked = isProfitLocked || false;
      risk.circuitBreaker = isLossLocked || false;
      
      if (isLocked) {
         console.log(`[EA-LOCK-DETECTED] Bloqueio aplicado para o User: ${lic.userId}`);
      }
    }

    // Verificar se bateu meta ou drawdown com os novos valores
    risk.checkDailyProfitTarget([]); 

    return res.json({ 
      success: true,
      isLocked: risk.dailyProfitLocked || risk.circuitBreaker,
      isProfitLocked: risk.dailyProfitLocked,
      isLossLocked: risk.circuitBreaker,
      dailyStartBalance: risk.dailyStartBalance
    });
  } catch (err) {
    console.error("[EA-BALANCE] Erro ao atualizar saldo:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

module.exports = router;
