import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfframpController } from './offramp.controller';
import { OfframpService } from './offramp.service';
import {
  OfframpTransaction,
  Wallet,
  LedgerEntry,
} from '../../database/entities';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OfframpTransaction, Wallet, LedgerEntry]),
    WalletsModule,
  ],
  controllers: [OfframpController],
  providers: [OfframpService],
  exports: [OfframpService],
})
export class OfframpModule {}
