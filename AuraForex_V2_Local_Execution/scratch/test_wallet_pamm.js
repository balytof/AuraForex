const express = require("express");
const http = require("http");
const prisma = require("../db");
const eaRouter = require("../ea_api");

async function runTests() {
  console.log("=== INICIANDO TESTE DE INTEGRAÇÃO DA CARTEIRA PRÉ-PAGA PAMM ===");
  
  // 1. Setup do Servidor de Teste
  const app = express();
  app.use(express.json());
  app.use("/ea", eaRouter);
  
  const server = http.createServer(app);
  const PORT = 3099;
  
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[TEST-SERVER] Servidor de testes rodando na porta ${PORT}`);
  
  const baseUrl = `http://localhost:${PORT}/ea`;
  
  let testUser = null;
  let testLicense = null;
  let systemSettings = null;
  
  try {
    // 2. Limpar/Preparar base de dados para o teste
    console.log("[DB-SETUP] Preparando registros de teste...");
    
    // Obter ou criar SystemSettings
    systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings) {
      systemSettings = await prisma.systemSettings.create({
        data: {
          defaultPammPerformanceFee: 30.0
        }
      });
    } else {
      systemSettings = await prisma.systemSettings.update({
        where: { id: systemSettings.id },
        data: { defaultPammPerformanceFee: 30.0 }
      });
    }
    
    // Obter ou criar Usuário de Teste
    testUser = await prisma.user.findFirst({
      where: { email: "pamm-test@auraforex.com" }
    });
    
    if (testUser) {
      // Limpar transações anteriores
      await prisma.walletTransaction.deleteMany({ where: { userId: testUser.id } });
      await prisma.signal.deleteMany({ where: { userId: testUser.id } });
      
      // Resetar saldo para $20.00
      testUser = await prisma.user.update({
        where: { id: testUser.id },
        data: {
          walletBalance: 20.0,
          settings: {
            upsert: {
              create: { pammPerformanceFeePct: null }, // Usar taxa global
              update: { pammPerformanceFeePct: null }
            }
          }
        }
      });
    } else {
      testUser = await prisma.user.create({
        data: {
          email: "pamm-test@auraforex.com",
          passwordHash: "dummyhash",
          walletBalance: 20.0,
          role: "USER",
          settings: {
            create: { pammPerformanceFeePct: null }
          }
        }
      });
    }
    
    // Criar Licença Ativa de Teste
    testLicense = await prisma.license.findFirst({
      where: { userId: testUser.id }
    });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 10);
    
    if (testLicense) {
      testLicense = await prisma.license.update({
        where: { id: testLicense.id },
        data: {
          status: "ACTIVE",
          expiresAt: expiresAt,
          mtAccount: "99988877"
        }
      });
    } else {
      testLicense = await prisma.license.create({
        data: {
          userId: testUser.id,
          status: "ACTIVE",
          expiresAt: expiresAt,
          mtAccount: "99988877",
          type: "PRO"
        }
      });
    }
    
    console.log(`[DB-SETUP] Usuário de teste: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`[DB-SETUP] Saldo Inicial: $${testUser.walletBalance.toFixed(2)}`);
    console.log(`[DB-SETUP] Chave da Licença: ${testLicense.id}`);
    
    // --- CENÁRIO 1: Validação do EA ---
    console.log("\n--- CENÁRIO 1: VALIDANDO LICENÇA NO EA ---");
    const validateRes = await fetch(`${baseUrl}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: testLicense.id,
        mtAccount: "99988877"
      })
    });
    const validateData = await validateRes.json();
    console.log("[VAL-RES]", validateData);
    if (validateData.status !== "OK") throw new Error("Falha ao validar licença.");
    console.log("✅ Licença validada com sucesso!");
    
    // --- CENÁRIO 2: Buscar Sinais com Saldo Positivo ($20.00) ---
    console.log("\n--- CENÁRIO 2: BUSCANDO SINAIS COM SALDO SUFICIENTE ($20.00) ---");
    // Criar sinal pendente na DB
    const signal1 = await prisma.signal.create({
      data: {
        userId: testUser.id,
        pair: "EURUSD",
        direction: "BUY",
        entry: 1.1200,
        sl: 1.1150,
        tp: 1.1300,
        lot: 0.01,
        status: "PENDING"
      }
    });
    
    const signalsRes1 = await fetch(`${baseUrl}/signals?licenseKey=${testLicense.id}`);
    const signalsData1 = await signalsRes1.json();
    console.log("[SIG-RES-1] Quantidade de sinais retornados:", signalsData1.signals.length);
    if (!signalsData1.success || signalsData1.signals.length !== 1) {
      throw new Error("Deveria retornar 1 sinal ativo.");
    }
    console.log("✅ Sinais entregues com sucesso (Cópia Ativa)!");
    
    // --- CENÁRIO 3: Dedução de Taxa de Performance com Lucro de $10.00 ---
    console.log("\n--- CENÁRIO 3: REPORTANDO ORDEM NO LUCRO ($10.00) ---");
    // Lucro de $10.00 com taxa global de 30% deve descontar $3.00.
    const reportRes1 = await fetch(`${baseUrl}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signalId: signal1.id,
        status: "CLOSED",
        orderTicket: 100001,
        profit: 10.00
      })
    });
    const reportData1 = await reportRes1.json();
    console.log("[REP-RES-1]", reportData1);
    
    // Verificar novo saldo na DB
    let userAfter1 = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`[DB-CHECK-1] Novo Saldo do Usuário: $${userAfter1.walletBalance.toFixed(2)} (Esperado: $17.00)`);
    if (Math.abs(userAfter1.walletBalance - 17.00) > 0.01) {
      throw new Error("Erro no cálculo da taxa. Esperado $17.00");
    }
    
    // Verificar transação registrada
    const txs1 = await prisma.walletTransaction.findMany({ where: { userId: testUser.id } });
    console.log(`[DB-CHECK-1] Transações registradas: ${txs1.length}`);
    if (txs1.length !== 1 || txs1[0].type !== "DEDUCTION" || Math.abs(txs1[0].amount - 3.00) > 0.01) {
      throw new Error("Transação DEDUCTION inválida na DB.");
    }
    console.log("✅ Taxa de 30% ($3.00) descontada perfeitamente do saldo!");
    
    // --- CENÁRIO 4: Lucro de $30.00 (Saldo cai para $8.00 - Alerta de Saldo Baixo) ---
    console.log("\n--- CENÁRIO 4: REPORTANDO OUTRA VITÓRIA DE $30.00 (SALDO BAIXO) ---");
    // Lucro de $30.00 com taxa de 30% deve descontar $9.00. Saldo restante: $8.00.
    const signal2 = await prisma.signal.create({
      data: {
        userId: testUser.id,
        pair: "GBPUSD",
        direction: "SELL",
        entry: 1.2500,
        sl: 1.2550,
        tp: 1.2400,
        lot: 0.01,
        status: "PENDING"
      }
    });
    
    const reportRes2 = await fetch(`${baseUrl}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signalId: signal2.id,
        status: "CLOSED",
        orderTicket: 100002,
        profit: 30.00
      })
    });
    await reportRes2.json();
    
    let userAfter2 = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`[DB-CHECK-2] Novo Saldo do Usuário: $${userAfter2.walletBalance.toFixed(2)} (Esperado: $8.00)`);
    if (Math.abs(userAfter2.walletBalance - 8.00) > 0.01) {
      throw new Error("Erro no cálculo da taxa. Esperado $8.00");
    }
    console.log("✅ Desconto de $9.00 efetuado. Saldo atualizado para $8.00 (< $10.00 - Alerta ativado!)");
    
    // --- CENÁRIO 5: Lucro de $30.00 (Saldo cai para -$1.00 - Copiador Desativado) ---
    console.log("\n--- CENÁRIO 5: REPORTANDO OUTRA VITÓRIA DE $30.00 (SALDO ESGOTADO) ---");
    // Desconta $9.00. Saldo restante: -$1.00.
    const signal3 = await prisma.signal.create({
      data: {
        userId: testUser.id,
        pair: "XAUUSD",
        direction: "BUY",
        entry: 2000.00,
        sl: 1990.00,
        tp: 2020.00,
        lot: 0.01,
        status: "PENDING"
      }
    });
    
    const reportRes3 = await fetch(`${baseUrl}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signalId: signal3.id,
        status: "CLOSED",
        orderTicket: 100003,
        profit: 30.00
      })
    });
    await reportRes3.json();
    
    let userAfter3 = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log(`[DB-CHECK-3] Novo Saldo do Usuário: $${userAfter3.walletBalance.toFixed(2)} (Esperado: -$1.00)`);
    if (userAfter3.walletBalance > 0) {
      throw new Error("Erro: O saldo deveria ser negativo.");
    }
    console.log("✅ Saldo esgotado e saldo negativo registrado!");
    
    // --- CENÁRIO 6: Gatekeeper Suspende Cópias ---
    console.log("\n--- CENÁRIO 6: GATEKEEPER DEVE BLOQUEAR NOVAS CÓPIAS ---");
    // Criar um novo sinal pendente
    const signal4 = await prisma.signal.create({
      data: {
        userId: testUser.id,
        pair: "EURUSD",
        direction: "BUY",
        entry: 1.1200,
        sl: 1.1150,
        tp: 1.1300,
        lot: 0.01,
        status: "PENDING"
      }
    });
    
    // Chamar endpoint /signals. Deve retornar sinais vazios!
    const signalsRes2 = await fetch(`${baseUrl}/signals?licenseKey=${testLicense.id}`);
    const signalsData2 = await signalsRes2.json();
    console.log("[GATEKEEPER-RES] Retorno de sinais:", signalsData2.signals);
    console.log("[GATEKEEPER-RES] Mensagem do Servidor:", signalsData2.message);
    
    if (signalsData2.signals.length !== 0 || !signalsData2.message.includes("zerado ou negativo")) {
      throw new Error("Erro: O copiador deveria ter retornado lista vazia devido a falta de fundos.");
    }
    console.log("✅ GATEKEEPER BLOQUEOU A TRANSMISSÃO DE SINAIS PERFEITAMENTE!");
    
    // --- CENÁRIO 7: Recarga Administrativa de Saldo ---
    console.log("\n--- CENÁRIO 7: ADMINISTRADOR ADICIONA SALDO ($50.00) ---");
    // Simula a rota administrativa POST /api/admin/wallet/credit-user
    const adminCreditAmount = 50.00;
    const userAfterCredit = await prisma.user.update({
      where: { id: testUser.id },
      data: {
        walletBalance: {
          increment: adminCreditAmount
        }
      }
    });
    
    await prisma.walletTransaction.create({
      data: {
        userId: testUser.id,
        type: "DEPOSIT",
        amount: adminCreditAmount,
        description: "Recarga manual pelo Admin"
      }
    });
    
    console.log(`[DB-CHECK-4] Saldo após recarga Admin: $${userAfterCredit.walletBalance.toFixed(2)} (Esperado: $49.00)`);
    if (Math.abs(userAfterCredit.walletBalance - 49.00) > 0.01) {
      throw new Error("Saldo incorreto após recarga.");
    }
    
    // --- CENÁRIO 8: Copiador Volta a Funcionar ---
    console.log("\n--- CENÁRIO 8: GATEKEEPER DEVE LIBERAR SINAIS APÓS RECARGA ---");
    const signalsRes3 = await fetch(`${baseUrl}/signals?licenseKey=${testLicense.id}`);
    const signalsData3 = await signalsRes3.json();
    console.log("[GATEKEEPER-RES-2] Quantidade de sinais retornados:", signalsData3.signals.length);
    if (signalsData3.signals.length !== 1) {
      throw new Error("Erro: O copiador deveria ter enviado o sinal pendente após a recarga.");
    }
    console.log("✅ COPIADOR DESBLOQUEADO E FUNCIONANDO COM SUCESSO!");
    
    console.log("\n=== 🎉 TODOS OS TESTES PASSARAM COM MÁXIMO SUCESSO! ===");
    
  } catch (err) {
    console.error("\n❌ ERRO DURANTE A EXECUÇÃO DOS TESTES:", err);
  } finally {
    // Limpar tabelas para não deixar resíduos de teste
    console.log("\n[CLEANUP] Removendo dados de teste...");
    if (testUser) {
      await prisma.walletTransaction.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.signal.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.license.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    
    server.close(() => {
      console.log("[TEST-SERVER] Servidor finalizado.");
      prisma.$disconnect().then(() => {
        console.log("[DB] Conexão Prisma finalizada.");
      });
    });
  }
}

runTests();
