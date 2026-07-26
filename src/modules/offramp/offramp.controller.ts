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
import { DualAuth, GetBusinessId } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Off-Ramp')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller()
export class OfframpController {
  constructor(private readonly offrampService: OfframpService) {}

  // @ApiOperation({
  //   summary: 'Get off-ramp rate',
  //   description:
  //     'Get current exchange rate for crypto to fiat conversion (e.g., USDT_NGN)',
  // })
  // @ApiParam({
  //   name: 'pair',
  //   description: 'Currency pair (e.g., USDT_NGN, BTC_GHS)',
  //   example: 'USDT_NGN',
  // })
  // @Get('rates/:pair')
  // async getRate(@Param('pair') pair: string) {
  //   return this.offrampService.getRate(pair);
  // }

  @ApiOperation({
    summary: 'Create off-ramp transaction',
    description:
      'Initiate a crypto off-ramp (sell crypto for fiat) transaction',
  })
  @ApiBody({ type: CreateOfframpDto })
  @Post('offramp')
  async create(
    @GetBusinessId() businessId: string,
    @Body() dto: CreateOfframpDto,
  ) {
    return this.offrampService.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'Get off-ramp transaction',
    description: 'Retrieve details of a specific off-ramp transaction by ID',
  })
  @ApiParam({
    name: 'tx_id',
    description: 'Transaction unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Get('offramp/:tx_id')
  async findOne(
    @GetBusinessId() businessId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.offrampService.findOne(businessId, txId);
  }
}
