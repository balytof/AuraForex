import { Injectable, Logger } from '@nestjs/common';
import TronWeb from 'tronweb';

// Endereço do Smart Contract oficial do USDT na rede Tron (TRC20)
const USDT_CONTRACT_MAINNET = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_CONTRACT_TESTNET = 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs'; // Shasta

@Injectable()
export class TronService {
  private readonly logger = new Logger(TronService.name);
  private tronWeb: any;
  private usdtContractAddress: string;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    this.tronWeb = new TronWeb({
      fullHost: isProduction
        ? 'https://api.trongrid.io'
        : 'https://api.shasta.trongrid.io',
      headers: process.env.TRON_API_KEY
        ? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
        : {},
    });

    this.usdtContractAddress = isProduction
      ? USDT_CONTRACT_MAINNET
      : USDT_CONTRACT_TESTNET;

    this.logger.log(
      isProduction
        ? '🏦 TronWeb em modo PRODUÇÃO (Mainnet). Fundos REAIS em operação.'
        : '🧪 TronWeb em modo TESTE (Shasta Testnet). Nenhum fundo real em risco.',
    );
  }

  /**
   * Gera um novo par de chaves TRC20 (Endereço Público + Chave Privada)
   */
  async generateWallet(): Promise<{ addressBase58: string; privateKey: string }> {
    const account = await this.tronWeb.createAccount();
    this.logger.log(`Nova carteira gerada: ${account.address.base58}`);
    return {
      addressBase58: account.address.base58,
      privateKey: account.privateKey,
    };
  }

  /**
   * Consulta o saldo de USDT (TRC20) de um endereço na blockchain
   */
  async getUSDTBalance(addressBase58: string): Promise<number> {
    try {
      const contract = await this.tronWeb.contract().at(this.usdtContractAddress);
      const result = await contract.balanceOf(addressBase58).call();
      // USDT tem 6 casas decimais na rede Tron
      return Number(result) / 1_000_000;
    } catch (error) {
      this.logger.error(`Erro ao consultar saldo de ${addressBase58}: ${error.message}`);
      return 0;
    }
  }

  /**
   * SWEEP: Transfere USDT da carteira temporária do cliente para a Cold Wallet (Hardware Wallet)
   * Esta função nunca persiste a chave privada — apenas a usa em memória para assinar.
   */
  async sweepToColdWallet(decryptedPrivateKey: string, amountUSDT: number): Promise<string> {
    const coldWalletAddress = process.env.COLD_WALLET_ADDRESS;

    if (!coldWalletAddress) {
      throw new Error('COLD_WALLET_ADDRESS não configurado no ficheiro .env do servidor.');
    }

    try {
      // Criar instância temporária com a chave privada da carteira do cliente
      const tempTronWeb = new TronWeb({
        fullHost: this.tronWeb.fullNode.host,
        privateKey: decryptedPrivateKey,
      });

      const contract = await tempTronWeb.contract().at(this.usdtContractAddress);
      const amountSun = Math.floor(amountUSDT * 1_000_000); // Converter para unidades mínimas

      const tx = await contract
        .transfer(coldWalletAddress, amountSun)
        .send({ feeLimit: 10_000_000 }); // 10 TRX de limite de taxa

      this.logger.log(`✅ SWEEP concluído! ${amountUSDT} USDT → Cold Wallet. TxHash: ${tx}`);
      return tx;
    } catch (error) {
      this.logger.error(`❌ SWEEP falhado: ${error.message}`);
      throw error;
    }
  }
}
