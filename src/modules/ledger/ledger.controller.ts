import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Ledger')
@ApiBearerAuth('api-key')
@DualAuth()
@ApiExcludeController()
@Controller()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @ApiOperation({
    summary: 'Get all transactions',
    description:
      'Retrieve all ledger transactions with filtering and pagination',
  })
  @ApiOkResponse({ description: 'Transactions retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('transactions')
  async findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: LedgerQueryDto,
  ) {
    return this.ledgerService.findAll(businessId, mode, query);
  }

  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieve details of a specific ledger transaction',
  })
  @ApiParam({
    name: 'tx_id',
    description: 'Transaction unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ description: 'Transaction retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get('transactions/:tx_id')
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.ledgerService.findOne(businessId, mode, txId);
  }

  @ApiOperation({
    summary: 'Get balance',
    description: 'Get current balance across all wallets and currencies',
  })
  @ApiOkResponse({ description: 'Balance retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('balance')
  async getBalance(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.ledgerService.getBalance(businessId, mode);
  }

  @ApiOperation({
    summary: 'Get settlement report',
    description: 'Generate settlement report for a specific date',
  })
  @ApiQuery({
    name: 'date',
    description: 'Report date (YYYY-MM-DD)',
    example: '2024-01-15',
    required: false,
  })
  @ApiOkResponse({ description: 'Settlement report retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('reports/settlement')
  async getSettlementReport(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: { date?: string },
  ) {
    return this.ledgerService.getSettlementReport(businessId, mode, query);
  }
}
