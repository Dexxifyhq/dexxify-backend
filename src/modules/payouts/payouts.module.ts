import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { Payout, LedgerEntry } from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payout, LedgerEntry]), CoincircuitModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
