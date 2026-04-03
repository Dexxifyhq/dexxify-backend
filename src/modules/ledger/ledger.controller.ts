import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dto';
import { GetDeveloper } from '../../common/decorators';

@Controller('v1')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('transactions')
  async findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.ledgerService.findAll(developerId, query);
  }

  @Get('transactions/:tx_id')
  async findOne(
    @GetDeveloper('id') developerId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.ledgerService.findOne(developerId, txId);
  }

  @Get('balance')
  async getBalance(@GetDeveloper('id') developerId: string) {
    return this.ledgerService.getBalance(developerId);
  }

  @Get('reports/settlement')
  async getSettlementReport(
    @GetDeveloper('id') developerId: string,
    @Query() query: { date?: string },
  ) {
    return this.ledgerService.getSettlementReport(developerId, query);
  }
}
