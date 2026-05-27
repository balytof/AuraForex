import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  /**
   * GET /wallets/my
   * Retorna o endereço de depósito TRC20 do utilizador autenticado.
   * O cliente usa este endereço para enviar USDT e ativar a licença.
   */
  @Get('my')
  async getMyWallet(@Request() req: any) {
    const userId = req.user?.id || 'test-user-id';
    return this.walletsService.getOrCreateWallet(userId);
  }
}
