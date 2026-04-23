import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { Wallet, LedgerEntry, WithdrawalWallet } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, WithdrawalWallet, LedgerEntry])],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
