import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  ApiKey,
  DepositAccount,
  Payout,
  CryptoTransaction,
  KycVerification,
  LedgerEntry,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      DepositAccount,
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
