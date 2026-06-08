import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerWalletsService } from './customer-wallets.service';
import { Customer, CustomerWallet } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerWallet])],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerWalletsService],
  exports: [CustomersService, CustomerWalletsService],
})
export class CustomersModule {}
