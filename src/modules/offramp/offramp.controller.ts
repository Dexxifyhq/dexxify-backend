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
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
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

  @ApiOperation({
    summary: 'Create off-ramp transaction',
    description:
      'Initiate a crypto off-ramp (sell crypto for fiat) transaction',
  })
  @ApiBody({ type: CreateOfframpDto })
  @Post('offramp')
  async create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateOfframpDto,
  ) {
    return this.offrampService.create(businessId, mode, dto);
  }

  @ApiOperation({
    summary: 'Get off-ramp transaction',
    description:
      'Retrieve the status of an off-ramp, keyed by the id returned from POST /offramp. ' +
      'Tracks the full lifecycle — before the swap settles, only swap status is available;',
  })
  @ApiParam({
    name: 'tx_id',
    description: 'The id returned by POST /offramp (a SwapRecord id)',
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
