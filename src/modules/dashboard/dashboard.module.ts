import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  ApiKey,
  Wallet,
  Payout,
  CryptoTransaction,
  KycVerification,
  LedgerEntry,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      Wallet,
      Payout,
      CryptoTransaction,
      KycVerification,
      LedgerEntry,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
