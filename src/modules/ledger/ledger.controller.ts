import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dto';
import { DualAuth, GetDeveloper } from '../../common/decorators';
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
    @GetDeveloper('id') developerId: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.ledgerService.findAll(developerId, query);
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
    @GetDeveloper('id') developerId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.ledgerService.findOne(developerId, txId);
  }

  @ApiOperation({
    summary: 'Get balance',
    description: 'Get current balance across all wallets and currencies',
  })
  @Get('balance')
  async getBalance(@GetDeveloper('id') developerId: string) {
    return this.ledgerService.getBalance(developerId);
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
    @GetDeveloper('id') developerId: string,
    @Query() query: { date?: string },
  ) {
    return this.ledgerService.getSettlementReport(developerId, query);
  }
}
