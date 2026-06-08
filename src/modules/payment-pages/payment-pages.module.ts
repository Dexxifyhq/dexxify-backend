import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentPagesController } from './payment-pages.controller';
import { PublicPaymentController } from './public-payment.controller';
import { PaymentPagesService } from './payment-pages.service';
import {
  Bank,
  Customer,
  PaymentPage,
  PaymentSession,
} from '../../database/entities';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentPage, PaymentSession, Customer, Bank]),
    CustomersModule,
  ],
  controllers: [PaymentPagesController, PublicPaymentController],
  providers: [PaymentPagesService],
  exports: [PaymentPagesService],
})
export class PaymentPagesModule {}
