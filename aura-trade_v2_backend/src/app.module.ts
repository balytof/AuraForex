import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TronModule } from './tron/tron.module';

@Module({
  imports: [AuthModule, UsersModule, TronModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
