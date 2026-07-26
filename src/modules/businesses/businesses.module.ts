import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { Business, BusinessUser, User } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Business, BusinessUser, User])],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
