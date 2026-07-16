import { Module } from '@nestjs/common';
import { MiscController, HealthController } from './misc.controller';
import { MiscService } from './misc.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank } from '../../database/entities/bank.entity';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bank]), CoincircuitModule],
  controllers: [MiscController, HealthController],
  providers: [MiscService],
  exports: [MiscService],
})
export class MiscModule {}
