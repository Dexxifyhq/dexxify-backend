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
import { DualAuth, GetDeveloper } from '../../common/decorators';
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
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreatePayoutDto,
  ) {
    return this.payoutsService.create(developerId, dto);
  }

  @ApiOperation({
    summary: 'Create batch payouts',
    description: 'Create multiple payouts in a single batch request',
  })
  @ApiBody({ type: BatchPayoutDto })
  @Post('batch')
  async createBatch(
    @GetDeveloper('id') developerId: string,
    @Body() dto: BatchPayoutDto,
  ) {
    return this.payoutsService.createBatch(developerId, dto);
  }

  @ApiOperation({
    summary: 'Resolve bank account',
    description: 'Verify and resolve bank account details to get account name',
  })
  @ApiBody({ type: ResolveAccountDto })
  @Post('resolve')
  async resolveAccount(@Body() dto: ResolveAccountDto) {
    return this.payoutsService.resolveAccount(dto);
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
    @GetDeveloper('id') developerId: string,
    @Param('payout_id', ParseUUIDPipe) payoutId: string,
  ) {
    return this.payoutsService.findOne(developerId, payoutId);
  }
}
