import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TronService } from './tron.service';
import { TronProcessor, TRON_QUEUE } from './tron.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: TRON_QUEUE,
    }),
  ],
  providers: [TronService, TronProcessor],
  exports: [TronService],
})
export class TronModule {}
