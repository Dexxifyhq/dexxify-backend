import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import {
  Wallet,
  LedgerEntry,
  WithdrawalWallet,
  Payout,
} from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WithdrawalWallet, LedgerEntry, Payout]),
    CoincircuitModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
