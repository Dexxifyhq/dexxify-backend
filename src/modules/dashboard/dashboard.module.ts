import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  ApiKey,
  Wallet,
  Payout,
  OfframpTransaction,
  KycVerification,
  LedgerEntry,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      Wallet,
      Payout,
      OfframpTransaction,
      KycVerification,
      LedgerEntry,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
