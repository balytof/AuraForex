const express = require("express");
const router = express.Router();
const prisma = require("./db");

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
      where: { id: licenseKey }
    });

    if (!license || license.status !== "ACTIVE") {
      return res.status(403).json({ error: "Licença inválida." });
    }

    // Busca sinais PENDENTES para o usuário dono da licença
    const signals = await prisma.signal.findMany({
      where: {
        userId: license.userId,
        status: "PENDING"
      },
      orderBy: { createdAt: "asc" }
    });

    return res.json({ success: true, signals });

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
  const { signalId, status, orderTicket } = req.body;

  if (!signalId || !status) {
    return res.status(400).json({ error: "signalId e status são obrigatórios." });
  }

  try {
    await prisma.signal.update({
      where: { id: signalId },
      data: {
        status: status, // EXECUTED, FAILED
        brokerId: orderTicket ? orderTicket.toString() : null,
        executedAt: status === "EXECUTED" ? new Date() : null
      }
    });

    console.log(`[EA-REPORT] Sinal ${signalId} atualizado para: ${status} (Ticket: ${orderTicket || 'N/A'})`);
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
  const { licenseKey, balance, equity } = req.body;

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

    return res.json({ success: true });
  } catch (err) {
    console.error("[EA-BALANCE] Erro ao atualizar saldo:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

module.exports = router;
