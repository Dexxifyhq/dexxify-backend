import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { CreatePayoutDto, BatchPayoutDto, ResolveAccountDto } from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Payouts')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @ApiOperation({
    summary: 'Create payout',
    description: 'Create a new fiat payout to a bank account',
  })
  @ApiBody({ type: CreatePayoutDto })
  @Post()
  async create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreatePayoutDto,
  ) {
    return this.payoutsService.create(businessId, mode, dto);
  }

  @ApiOperation({
    summary: 'Create batch payouts',
    description: 'Create multiple payouts in a single batch request',
  })
  @ApiBody({ type: BatchPayoutDto })
  @Post('batch')
  async createBatch(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: BatchPayoutDto,
  ) {
    return this.payoutsService.createBatch(businessId, mode, dto);
  }

  @ApiOperation({
    summary: 'Resolve bank account',
    description: 'Verify and resolve bank account details to get account name',
  })
  @ApiBody({ type: ResolveAccountDto })
  @Post('resolve')
  async resolveAccount(
    @GetMode() mode: 'live' | 'test',
    @Body() dto: ResolveAccountDto,
  ) {
    return this.payoutsService.resolveAccount(mode, dto);
  }

  @ApiOperation({
    summary: 'Get payout by ID',
    description: 'Retrieve details of a specific payout by its ID',
  })
  @ApiParam({
    name: 'payout_id',
    description: 'Payout unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Get(':payout_id')
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('payout_id', ParseUUIDPipe) payoutId: string,
  ) {
    return this.payoutsService.findOne(businessId, mode, payoutId);
  }
}
