import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { MiscService } from './misc.service';
import { GetRateQueryDto, AddBankDto, VerifyBankAccountDto } from './dto';
import { GetBusinessId, Public, DualAuth } from '../../common/decorators';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Misc - Banks & Assets')
@DualAuth()
@Controller('misc')
export class MiscController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({ summary: 'Get supported banks' })
  @Get('banks')
  async getBanks() {
    return this.miscService.getBanks();
  }

  @ApiOperation({ summary: 'Add bank account' })
  @Post('banks')
  async addBank(
    @GetBusinessId() businessId: string,
    @Body() dto: AddBankDto,
  ) {
    return this.miscService.addBank(businessId, dto);
  }

  @ApiOperation({ summary: 'Get saved banks' })
  @Get('banks/saved')
  async getSavedBanks(@GetBusinessId() businessId: string) {
    return this.miscService.getSavedBanks(businessId);
  }

  @ApiOperation({ summary: 'Get saved bank by account number' })
  @ApiParam({ name: 'accountNumber', example: '3154021148' })
  @Get('banks/saved/:accountNumber')
  async getSavedBankById(
    @GetBusinessId() businessId: string,
    @Param('accountNumber') accountNumber: string,
  ) {
    return this.miscService.getSavedBanksById(businessId, accountNumber);
  }

  @ApiOperation({ summary: 'Delete bank account' })
  @ApiParam({ name: 'bankId', description: 'Local bank record ID' })
  @Delete('banks/:bankId')
  async deleteBank(@Param('bankId') bankId: string) {
    return this.miscService.deleteBank(bankId);
  }

  @ApiOperation({ summary: 'Verify bank account' })
  @Post('banks/verify')
  async verifyBankAccount(@Body() dto: VerifyBankAccountDto) {
    return this.miscService.verifyBankAccount(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Get supported blockchain and assets' })
  @Get('assets')
  async getSupportedDepositAssets() {
    return this.miscService.getSupportedAssets();
  }

  // @ApiOperation({ summary: 'Get supported withdrawal assets' })
  // @Get('withdrawal-assets')
  // async getSupportedWithdrawalAssets() {
  //   return this.miscService.getSupportedWithdrawalAssets();
  // }

  @ApiOperation({ summary: 'Get crypto conversion rate' })
  @Post('crypto-prices')
  async getCryptoPrices(@Body() query: GetRateQueryDto) {
    return this.miscService.getCryptoPrices(query);
  }

  @ApiOperation({ summary: 'Estimate payment amount in crypto' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        asset: { type: 'string', example: 'USDT' },
        amount: { type: 'number', example: 100 },
        currency: { type: 'string', example: 'NGN' },
      },
      required: ['asset', 'amount', 'currency'],
    },
  })
  @Post('rate-calculator')
  async getRateCalculator(
    @Body() body: { asset: string; amount: number; currency: string },
  ) {
    return this.miscService.getRateCalculator(
      body.asset,
      body.amount,
      body.currency,
    );
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({ summary: 'Health check' })
  @Public()
  @Get()
  getHealth() {
    return this.miscService.getHealth();
  }
}
