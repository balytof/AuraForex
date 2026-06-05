const cron = require('node-cron');
const prisma = require('../db');
const { getTokenBalance, sweepFunds } = require('../payments/cryptoGateway');

// Variável para evitar sobreposição se a execução demorar mais de 1 minuto
let isChecking = false;

async function checkPendingInvoices() {
    if (isChecking) return;
    isChecking = true;

    try {
        console.log("[PaymentMonitor] A procurar invoices PENDING na BSC...");
        
        const pendingInvoices = await prisma.cryptoInvoice.findMany({
            where: { status: 'PENDING' },
            include: { purchase: { include: { plan: true } } }
        });

        if (pendingInvoices.length === 0) {
            isChecking = false;
            return;
        }

        console.log(`[PaymentMonitor] Encontradas ${pendingInvoices.length} invoices pendentes.`);

        for (const invoice of pendingInvoices) {
            try {
                // 1. Ler o saldo atual de USDT na carteira temporária da invoice
                const balance = await getTokenBalance(invoice.walletAddress);
                
                if (balance > 0) {
                    console.log(`[PaymentMonitor] Saldo detetado! Carteira: ${invoice.walletAddress} | USDT: $${balance}`);
                    
                    // Se o saldo recebido for igual ou superior ao esperado
                    if (balance >= invoice.amountDue * 0.99) { // Margem de tolerância de 1%
                        
                        // Atualiza a invoice para PAID
                        await prisma.cryptoInvoice.update({
                            where: { id: invoice.id },
                            data: { 
                                status: 'PAID',
                                amountPaid: balance
                            }
                        });

                        const purchaseReq = invoice.purchase;
                        if (purchaseReq && purchaseReq.status !== 'APPROVED') {
                            if (purchaseReq.licenseType === "PAMM") {
                                // 1. Update Provider totalGasEarned
                                const providerToken = purchaseReq.transactionHash ? purchaseReq.transactionHash.replace("crypto_auto_", "") : "";
                                const provider = await prisma.provider.findUnique({
                                    where: { token: providerToken }
                                });
                                
                                if (provider) {
                                    await prisma.provider.update({
                                        where: { id: provider.id },
                                        data: { 
                                            totalGasEarned: { increment: purchaseReq.amount },
                                            availableGas: { increment: purchaseReq.amount }
                                        }
                                    });

                                    // 2. Upsert ClientSubscription totalGasPaid
                                    await prisma.clientSubscription.upsert({
                                        where: { userId: purchaseReq.userId },
                                        update: { 
                                            providerId: provider.id,
                                            totalGasPaid: { increment: purchaseReq.amount },
                                            status: "ACTIVE"
                                        },
                                        create: {
                                            userId: purchaseReq.userId,
                                            providerId: provider.id,
                                            totalGasPaid: purchaseReq.amount,
                                            status: "ACTIVE"
                                        }
                                    });
                                }
                            } else {
                                // 1. Calcular Expiração para Licença
                                const days = purchaseReq.plan ? purchaseReq.plan.durationDays : 30;
                                const existingLicense = await prisma.license.findFirst({
                                    where: { userId: purchaseReq.userId, status: "ACTIVE" },
                                    orderBy: { expiresAt: 'desc' }
                                });

                                let expiresAt = new Date();
                                if (existingLicense && existingLicense.expiresAt > new Date()) {
                                    expiresAt = new Date(existingLicense.expiresAt);
                                    expiresAt.setDate(expiresAt.getDate() + days);
                                } else {
                                    expiresAt.setDate(expiresAt.getDate() + days);
                                }

                                await prisma.license.updateMany({
                                    where: { userId: purchaseReq.userId, status: "ACTIVE" },
                                    data: { status: "EXPIRED" }
                                });

                                await prisma.license.create({
                                    data: {
                                        userId: purchaseReq.userId,
                                        planId: purchaseReq.planId,
                                        type: purchaseReq.plan?.name || "PRO",
                                        status: "ACTIVE",
                                        expiresAt: expiresAt
                                    }
                                });

                                // 2. Distribuir Bónus de Afiliados
                                if (!purchaseReq.isBonusProcessed) {
                                    const baseAmount = purchaseReq.amount;
                                    const bonusLevels = [0.06, 0.04, 0.02, 0.01, 0.01];
                                    let currentUser = await prisma.user.findUnique({ where: { id: purchaseReq.userId } });

                                    for (let i = 0; i < bonusLevels.length; i++) {
                                        if (!currentUser || !currentUser.sponsorId) break;
                                        const sponsor = await prisma.user.findUnique({ where: { id: currentUser.sponsorId } });
                                        if (!sponsor) break;

                                        const bonusAmount = parseFloat((baseAmount * bonusLevels[i]).toFixed(2));
                                        await prisma.bonusTransaction.create({
                                            data: {
                                                receiverId: sponsor.id,
                                                sourceUserId: purchaseReq.userId,
                                                purchaseId: purchaseReq.id,
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
                                }
                            }

                            // 3. Atualizar PurchaseRequest
                            await prisma.purchaseRequest.update({
                                where: { id: purchaseReq.id },
                                data: { status: 'APPROVED', isBonusProcessed: true }
                            });
                        }

                        console.log(`[PaymentMonitor] Invoice ${invoice.id} APROVADA com sucesso. Licença Emitida.`);

                        // Inicia o processo de Sweep em background
                        // Não damos await aqui para não bloquear a verificação de outras invoices
                        processSweep(invoice);
                    }
                }
            } catch (err) {
                console.error(`[PaymentMonitor] Erro ao processar invoice ${invoice.id}:`, err.message);
            }
        }
    } catch (e) {
        console.error("[PaymentMonitor] Erro Geral:", e.message);
    } finally {
        isChecking = false;
    }
}

async function processSweep(invoice) {
    try {
        // Marca como "FORWARDING" para evitar duplicados
        await prisma.cryptoInvoice.update({
            where: { id: invoice.id },
            data: { status: 'FORWARDING' }
        });

        // O endereço da Cold Wallet do Admin vem das variáveis de ambiente
        const adminColdWallet = process.env.ADMIN_COLD_WALLET;
        if (!adminColdWallet) {
            console.error("[PaymentMonitor] ERRO: ADMIN_COLD_WALLET não definida no .env!");
            return;
        }

        const txHash = await sweepFunds(invoice.privateKeyEnc, adminColdWallet);
        
        // Se a varredura for concluída
        await prisma.cryptoInvoice.update({
            where: { id: invoice.id },
            data: { 
                status: 'COMPLETED',
                forwardTxHash: txHash
            }
        });
        console.log(`[PaymentMonitor] Varredura da invoice ${invoice.id} concluída! Hash: ${txHash}`);

    } catch (err) {
        console.error(`[PaymentMonitor] Erro na varredura da invoice ${invoice.id}:`, err.message);
        
        // Em caso de falha de gás ou da rede, marca como PAID novamente para que possamos tentar manualmente ou num retry job
        await prisma.cryptoInvoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID' }
        });
    }
}

// Configura o CronJob para rodar a cada 1 minuto
cron.schedule('* * * * *', () => {
    checkPendingInvoices();
});

console.log("[PaymentMonitor] Cron de Monitoramento de Pagamentos Crypto INICIADO (BSC).");

module.exports = { checkPendingInvoices };
