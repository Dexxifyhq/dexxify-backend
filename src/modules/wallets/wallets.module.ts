import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import {
  DepositAccount,
  LedgerEntry,
  WithdrawalWallet,
  Payout,
  Customer,
  User,
  Business,
} from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';
import { CustomersModule } from '../customers/customers.module';
import { KycModule } from '../kyc/kyc.module';
import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DepositAccount,
      WithdrawalWallet,
      LedgerEntry,
      Payout,
      Customer,
      User,
      Business,
    ]),
    CoincircuitModule,
    CustomersModule,
    KycModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService, KycVerifiedGuard],
  exports: [WalletsService],
})
export class WalletsModule {}
