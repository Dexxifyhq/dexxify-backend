import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OfframpService } from './offramp.service';
import { CreateOfframpDto } from './dto';
import { GetDeveloper } from '../../common/decorators';

@Controller()
export class OfframpController {
  constructor(private readonly offrampService: OfframpService) {}

  @Get('rates/:pair')
  async getRate(@Param('pair') pair: string) {
    return this.offrampService.getRate(pair);
  }

  @Post('offramp')
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateOfframpDto,
  ) {
    return this.offrampService.create(developerId, dto);
  }

  @Get('offramp/:tx_id')
  async findOne(
    @GetDeveloper('id') developerId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.offrampService.findOne(developerId, txId);
  }
}
