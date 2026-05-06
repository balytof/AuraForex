const express = require("express");
const router = express.Router();
const prisma = require("./db");



function formatForMT5(signal) {
  return {
    id: String(signal.id || Date.now().toString()),
    pair: String(signal.pair).toUpperCase(),
    direction: String(signal.direction).toUpperCase(),
    entry: Number(signal.entry || 0),
    sl: Number(signal.sl || 0),
    tp: Number(signal.tp || 0),
    lot: Number(signal.lot || 0.01)
  };
}




/**
 * ── ENDPOINT: VALIDATE ──────────────────────────────────────────────
 */
router.post("/validate", async (req, res) => {
  const { licenseKey, mtAccount } = req.body;
  console.log(`[EA-API] 🛡️ Tentativa de Validação: Conta ${mtAccount} | Licença ${licenseKey}`);

  try {
    const license = await prisma.license.findUnique({
      where: { id: licenseKey },
      include: { user: true }
    });

    if (!license || license.status !== "ACTIVE") {
      return res.status(401).json({ status: "ERROR", message: "Licença inválida ou expirada." });
    }

    // Amarrar a conta MT5
    await prisma.license.update({
      where: { id: licenseKey },
      data: { mtAccount: String(mtAccount) }
    });

    console.log(`[EA-API] ✅ OK: ${license.user.email}`);
    res.type('application/json');
    res.send('{"status":"OK"}');

  } catch (err) {
    console.error("[EA-API] ❌ Erro:", err.message);
    res.type('application/json');
    res.send('{"status":"ERROR"}');
  }
});

/**
 * ── ENDPOINT: SIGNALS ───────────────────────────────────────────────
 */
router.get("/signals", async (req, res) => {
  const { licenseKey } = req.query;

  if (!licenseKey) return res.status(400).json({ error: "licenseKey obrigatória." });

  try {
    // 1. Encontrar o dono da licença
    const license = await prisma.license.findUnique({
      where: { id: licenseKey }
    });

    if (!license) return res.json({ signals: [] });

    // 2. Buscar sinais para o userId dono da licença
      take: 10,
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (pendingSignals.length === 0) {
      return res.json({ signals: [] });
    }

    // Formata os sinais para o MT5 (V4 Magic)
    const formattedSignals = pendingSignals.map(sig => ({
      id: sig.id,
      pair: sig.pair,
      direction: sig.direction,
      entry: 0, // V5: Execução local
      sl: sig.sl,
      tp: sig.tp,
      lot: sig.lot,
      atr: sig.atr
    }));

    console.log(`[EA-API] 📤 Enviando ${formattedSignals.length} sinais para a licença ${licenseKey}`);
    res.json({ signals: formattedSignals });

  } catch (err) {
    console.error("[EA-API] Erro ao buscar sinais no DB:", err);
    res.status(500).json({ error: "Erro interno ao buscar sinais." });
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
    const isInternalSignal = signalId.startsWith("TEST_") || signalId.startsWith("MANUAL_");
    
    if (!isInternalSignal) {
      await prisma.signal.update({
        where: { id: signalId },
        data: {
          status: status, // EXECUTED, FAILED
          brokerId: orderTicket ? orderTicket.toString() : null,
          executedAt: status === "EXECUTED" ? new Date() : null
        }
      });
    }

    console.log(`[EA-REPORT] Sinal ${signalId} reportado como: ${status} (Ticket: ${orderTicket || 'N/A'})`);

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

module.exports = {
  router
};

