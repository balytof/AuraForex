import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TronService } from '../tron/tron.service';
import * as crypto from 'crypto';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly ENCRYPTION_KEY = process.env.JWT_SECRET?.substring(0, 32) || 'chave_de_32_caracteres_aqui!!!!!';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tronService: TronService,
  ) {}

  /**
   * Cria ou devolve a carteira de depósito de um utilizador.
   * Cada utilizador tem UM endereço único e permanente para depósitos.
   */
  async getOrCreateWallet(userId: string): Promise<{ addressBase58: string }> {
    // Verificar se o utilizador já tem uma carteira
    const existing = await this.prisma.wallet.findFirst({ where: { userId } });
    if (existing) {
      return { addressBase58: existing.addressBase58 };
    }

    // Gerar nova carteira TRC20
    const { addressBase58, privateKey } = await this.tronService.generateWallet();

    // Encriptar a chave privada antes de guardar na BD
    const encryptedKey = this.encrypt(privateKey);

    await this.prisma.wallet.create({
      data: {
        userId,
        addressBase58,
        privateKeyHash: encryptedKey,
        balanceUSDT: 0,
      },
    });

    this.logger.log(`Nova carteira criada para utilizador ${userId}: ${addressBase58}`);
    return { addressBase58 };
  }

  /**
   * Encripta a chave privada com AES-256 antes de a guardar na base de dados.
   * Mesmo que a BD seja comprometida, a chave é ilegível sem a chave mestra.
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.ENCRYPTION_KEY),
      iv,
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Desencripta a chave privada (apenas em memória, para assinar transações Sweep)
   */
  decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.ENCRYPTION_KEY),
      iv,
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
