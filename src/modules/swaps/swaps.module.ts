import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapsController } from './swaps.controller';
import { SwapsService } from './swaps.service';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';
import { SwapRecord } from '../../database/entities';
import { KycModule } from '../kyc/kyc.module';
import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';

@Module({
  imports: [
    CoincircuitModule,
    TypeOrmModule.forFeature([SwapRecord]),
    KycModule,
  ],
  controllers: [SwapsController],
  providers: [SwapsService, KycVerifiedGuard],
})
export class SwapsModule {}
