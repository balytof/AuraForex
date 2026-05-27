import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TronService } from './tron.service';
import { PrismaService } from '../prisma/prisma.service';

export const TRON_QUEUE = 'tron-deposit-checker';

@Processor(TRON_QUEUE)
export class TronProcessor extends WorkerHost {
  private readonly logger = new Logger(TronProcessor.name);

  constructor(
    private readonly tronService: TronService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  /**
   * WORKER PRINCIPAL: Executa quando um job "check-deposit" chega à fila.
   * Verifica se o cliente depositou na blockchain e, se sim, faz o Sweep imediatamente.
   */
  async process(job: Job): Promise<void> {
    const { walletId, userId, expectedAmountUSDT } = job.data;

    this.logger.log(`🔍 [JOB #${job.id}] A verificar depósito para carteira ${walletId}...`);

    try {
      // 1. Buscar carteira na BD
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        this.logger.warn(`[JOB #${job.id}] Carteira ${walletId} não encontrada.`);
        return;
      }

      // 2. Verificar saldo atual na Blockchain
      const currentBalance = await this.tronService.getUSDTBalance(wallet.addressBase58);
      this.logger.log(`[JOB #${job.id}] Saldo detectado: ${currentBalance} USDT`);

      if (currentBalance >= expectedAmountUSDT) {
        this.logger.log(`✅ [JOB #${job.id}] Depósito confirmado! A iniciar SWEEP para Cold Wallet...`);

        // 3. SWEEP IMEDIATO: Transferir USDT para a Hardware Wallet
        const txHash = await this.tronService.sweepToColdWallet(
          wallet.privateKeyHash, // Chave privada desencriptada (apenas em memória, nunca persistida)
          currentBalance,
        );

        // 4. Registar a transação na base de dados
        await this.prisma.transaction.create({
          data: {
            userId,
            txid: txHash,
            type: 'SWEEP',
            amountUSDT: currentBalance,
            status: 'CONFIRMED',
          },
        });

        // 5. Ativar licença do utilizador
        await this.prisma.license.updateMany({
          where: { userId },
          data: {
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 dias
          },
        });

        this.logger.log(`🎉 [JOB #${job.id}] Licença ativada e fundos seguros na Cold Wallet. TxHash: ${txHash}`);
      } else {
        this.logger.log(`⏳ [JOB #${job.id}] Aguardar... Saldo atual (${currentBalance}) < esperado (${expectedAmountUSDT})`);
        // Re-adicionar o job à fila para verificar novamente em 2 minutos
        await job.moveToDelayed(Date.now() + 2 * 60 * 1000);
      }
    } catch (error) {
      this.logger.error(`❌ [JOB #${job.id}] Erro ao processar depósito: ${error.message}`);
      throw error; // BullMQ vai re-tentar automaticamente
    }
  }
}
