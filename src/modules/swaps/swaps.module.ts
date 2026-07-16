import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapsController } from './swaps.controller';
import { SwapsService } from './swaps.service';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';
import { SwapRecord } from '../../database/entities';

@Module({
  imports: [CoincircuitModule, TypeOrmModule.forFeature([SwapRecord])],
  controllers: [SwapsController],
  providers: [SwapsService],
})
export class SwapsModule {}
