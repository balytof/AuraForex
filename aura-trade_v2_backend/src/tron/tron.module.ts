import { Module } from '@nestjs/common';
import { TronService } from './tron.service';

@Module({
  providers: [TronService]
})
export class TronModule {}
