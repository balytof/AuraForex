import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TronModule } from './tron/tron.module';

@Module({
  imports: [
    // Carregar variáveis de ambiente do ficheiro .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Redis + BullMQ (Job Queue para monitorização da blockchain)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Módulos do Sistema
    PrismaModule,
    AuthModule,
    UsersModule,
    TronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
