import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentSessionsController } from './payment-sessions.controller';
import { PaymentSessionsService } from './payment-sessions.service';
import { PaymentSession, Customer } from '../../database/entities';
import { CoincircuitModule } from '../../providers/coincircuit/coincircuit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentSession, Customer]),
    CoincircuitModule,
  ],
  controllers: [PaymentSessionsController],
  providers: [PaymentSessionsService],
  exports: [PaymentSessionsService],
})
export class PaymentSessionsModule {}
