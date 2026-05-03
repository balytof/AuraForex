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
