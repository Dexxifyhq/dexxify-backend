import { Module } from '@nestjs/common';
import { MiscController, HealthController } from './misc.controller';
import { MiscService } from './misc.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank } from '../../database/entities/bank.entity';

@Module({
  controllers: [MiscController, HealthController],
  providers: [MiscService],
  exports: [MiscService],
  imports: [TypeOrmModule.forFeature([Bank])],
})
export class MiscModule {}
