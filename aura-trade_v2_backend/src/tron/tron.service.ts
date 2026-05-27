import { Injectable, Logger } from '@nestjs/common';
import * as TronWeb from 'tronweb';

@Injectable()
export class TronService {
  private readonly logger = new Logger(TronService.name);
  private tronWeb: any;

  constructor() {
    // Inicializar na Shasta Testnet (Ambiente de Testes Seguro)
    const fullNode = 'https://api.shasta.trongrid.io';
    const solidityNode = 'https://api.shasta.trongrid.io';
    const eventServer = 'https://api.shasta.trongrid.io';
    
    // Opcional: Para produção necessitamos de uma API Key da TronGrid
    this.tronWeb = new TronWeb({
      fullHost: fullNode,
      // privateKey central (Gas Wallet) virá do .env futuramente
    });

    this.logger.log('🚀 TronWeb inicializado na rede Shasta (Testnet). Nenhum fundo real em risco.');
  }

  /**
   * Gera uma nova carteira TRC20 (Par de Chaves: Pública e Privada)
   * A chave privada deve ser IMEDIATAMENTE encriptada antes de ir para a base de dados.
   */
  async generateWallet(): Promise<{ addressBase58: string; privateKey: string }> {
    try {
      const account = await this.tronWeb.createAccount();
      
      this.logger.log(`Nova carteira gerada com sucesso: ${account.address.base58}`);
      
      return {
        addressBase58: account.address.base58,
        privateKey: account.privateKey,
      };
    } catch (error) {
      this.logger.error('Falha ao gerar nova carteira TRC20', error);
      throw new Error('Não foi possível gerar carteira de depósito.');
    }
  }

  /**
   * (Placeholder) Função Sweep: Vai transferir USDT da carteira do cliente para a Cold Wallet
   */
  async sweepToColdWallet(userPrivateKey: string, amountUSDT: number): Promise<string> {
    const coldWalletAddress = process.env.COLD_WALLET_ADDRESS;
    if (!coldWalletAddress) {
      throw new Error('Endereço da Cold Wallet não está configurado no sistema.');
    }

    this.logger.log(`A iniciar SWEEP de ${amountUSDT} USDT para a Cold Wallet: ${coldWalletAddress}...`);
    
    // Lógica futura de Smart Contract USDT
    // 1. Instanciar contrato USDT
    // 2. Assinar transação com userPrivateKey
    // 3. Executar envio
    
    return "MOCK_TX_HASH_12345";
  }
}
