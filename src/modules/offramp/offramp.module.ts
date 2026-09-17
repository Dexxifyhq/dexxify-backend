import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfframpController } from './offramp.controller';
import { OfframpService } from './offramp.service';
import { CryptoTransaction, SwapRecord } from '../../database/entities';
import { DepositAccountsModule } from '../deposit-accounts/deposit-accounts.module';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CryptoTransaction, SwapRecord]),
    DepositAccountsModule,
    CoincircuitModule,
  ],
  controllers: [OfframpController],
  providers: [OfframpService],
  exports: [OfframpService],
})
export class OfframpModule {}
