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
  Developer,
} from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DepositAccount,
      WithdrawalWallet,
      LedgerEntry,
      Payout,
      Customer,
      Developer,
    ]),
    CoincircuitModule,
    CustomersModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
