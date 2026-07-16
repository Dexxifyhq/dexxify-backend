import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { Invoice, Customer, PaymentSession } from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Customer, PaymentSession]), CoincircuitModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
