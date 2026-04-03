import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OnrampService } from './onramp.service';
import { CreateOnrampDto } from './dto';
import { GetDeveloper } from '../../common/decorators';

@Controller('v1/onramp')
export class OnrampController {
  constructor(private readonly onrampService: OnrampService) {}

  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateOnrampDto,
  ) {
    return this.onrampService.create(developerId, dto);
  }

  @Get(':tx_id')
  async findOne(
    @GetDeveloper('id') developerId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.onrampService.findOne(developerId, txId);
  }
}
