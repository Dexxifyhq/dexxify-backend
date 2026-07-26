import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dto';
import { DualAuth,  GetBusinessId } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Ledger')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @ApiOperation({
    summary: 'Get all transactions',
    description:
      'Retrieve all ledger transactions with filtering and pagination',
  })
  @ApiQuery({ type: LedgerQueryDto })
  @Get('transactions')
  async findAll(
    @GetBusinessId() businessId: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.ledgerService.findAll(businessId, query);
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
  @Get('transactions/:tx_id')
  async findOne(
    @GetBusinessId() businessId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.ledgerService.findOne(businessId, txId);
  }

  @ApiOperation({
    summary: 'Get balance',
    description: 'Get current balance across all wallets and currencies',
  })
  @Get('balance')
  async getBalance(@GetBusinessId() businessId: string) {
    return this.ledgerService.getBalance(businessId);
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
  @Get('reports/settlement')
  async getSettlementReport(
    @GetBusinessId() businessId: string,
    @Query() query: { date?: string },
  ) {
    return this.ledgerService.getSettlementReport(businessId, query);
  }
}
