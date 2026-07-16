import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { LedgerEntry, Payout } from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerEntry, Payout]),
    CoincircuitModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
