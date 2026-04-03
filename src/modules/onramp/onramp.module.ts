import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnrampController } from './onramp.controller';
import { OnrampService } from './onramp.service';
import { OnrampTransaction, LedgerEntry } from '../../database/entities';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnrampTransaction, LedgerEntry]),
    WalletsModule,
  ],
  controllers: [OnrampController],
  providers: [OnrampService],
  exports: [OnrampService],
})
export class OnrampModule {}
