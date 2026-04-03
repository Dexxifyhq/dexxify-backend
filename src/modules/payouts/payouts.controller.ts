import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { CreatePayoutDto, BatchPayoutDto, ResolveAccountDto } from './dto';
import { GetDeveloper } from '../../common/decorators';

@Controller('v1/payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreatePayoutDto,
  ) {
    return this.payoutsService.create(developerId, dto);
  }

  @Post('batch')
  async createBatch(
    @GetDeveloper('id') developerId: string,
    @Body() dto: BatchPayoutDto,
  ) {
    return this.payoutsService.createBatch(developerId, dto);
  }

  @Post('resolve')
  async resolveAccount(@Body() dto: ResolveAccountDto) {
    return this.payoutsService.resolveAccount(dto);
  }

  @Get(':payout_id')
  async findOne(
    @GetDeveloper('id') developerId: string,
    @Param('payout_id', ParseUUIDPipe) payoutId: string,
  ) {
    return this.payoutsService.findOne(developerId, payoutId);
  }
}
