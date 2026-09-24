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
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { SwapRecord } from '../../database/entities';

const SWAP_RECORD_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  cc_swap_id: 'swap_7f3a1b2c3d4e',
  from_currency: 'USDT',
  to_currency: 'NGN',
  source_amount: 10,
  target_amount: 15234.56,
  status: 'pending',
  type: 'offramp',
  metadata: {
    recipientId: 'rec_6a0ce75269321c4cb5eafe7d',
    quotationId: 'quote_9f2a1b3c4d5e',
  },
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const CRYPTO_TRANSACTION_EXAMPLE = {
  id: '2b6a2a2b-6a11-4c2a-9a0a-9e6a2a2b6a99',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  direction: 'outbound',
  crypto_asset: 'USDT',
  net_amount: 10,
  network: 'Tron',
  deposit_type: null,
  from_address: null,
  to_address: 'TXkPqR7YbAaHqZ5t5fRZ9Zk3f2NcQvJ9f2A',
  tx_hash: null,
  amount: 15234.56,
  currency: 'NGN',
  fee: 50,
  status: 'completed',
  provider_reference: 'cc_tx_8f2a1b3c',
  cc_transaction_id: 'cc_tx_8f2a1b3c',
  description: 'Offramp payout',
  metadata: { swapRecordId: '550e8400-e29b-41d4-a716-446655440000' },
  completed_at: '2026-09-01T10:20:00.000Z',
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:20:00.000Z',
};

const OFFRAMP_STATUS_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  status: 'completed',
  swap: { ...SWAP_RECORD_EXAMPLE, status: 'completed' },
  transaction: CRYPTO_TRANSACTION_EXAMPLE,
};

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
  @ApiCreatedResponse({
    description: 'Off-ramp transaction created successfully.',
    type: SwapRecord,
    example: SWAP_RECORD_EXAMPLE,
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Failed to initiate offramp.',
    },
    401,
  )
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
  @ApiOkResponse({
    description: 'Off-ramp transaction retrieved successfully.',
    schema: { example: OFFRAMP_STATUS_EXAMPLE },
  })
  @ApiErrorResponses(401, {
    status: 404,
    message: 'Offramp transaction not found.',
  })
  @Get('offramp/:tx_id')
  async findOne(
    @GetBusinessId() businessId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.offrampService.findOne(businessId, txId);
  }
}
