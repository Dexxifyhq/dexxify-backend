import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentSessionsController } from './payment-sessions.controller';
import { PaymentSessionsService } from './payment-sessions.service';
import { PaymentSession } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentSession])],
  controllers: [PaymentSessionsController],
  providers: [PaymentSessionsService],
  exports: [PaymentSessionsService],
})
export class PaymentSessionsModule {}
