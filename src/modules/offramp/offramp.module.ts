import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfframpController } from './offramp.controller';
import { OfframpService } from './offramp.service';
import { CryptoTransaction, SwapRecord } from '../../database/entities';
import { WalletsModule } from '../wallets/wallets.module';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CryptoTransaction, SwapRecord]),
    WalletsModule,
    CoincircuitModule,
  ],
  controllers: [OfframpController],
  providers: [OfframpService],
  exports: [OfframpService],
})
export class OfframpModule {}
