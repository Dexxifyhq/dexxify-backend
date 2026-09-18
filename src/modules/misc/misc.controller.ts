import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { MiscService } from './misc.service';
import { GetRateQueryDto, AddBankDto, VerifyBankAccountDto } from './dto';
import {
  GetBusinessId,
  GetMode,
  Public,
  DualAuth,
} from '../../common/decorators';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Misc - Banks & Assets')
@DualAuth()
@Controller('misc')
export class MiscController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({ summary: 'Get supported banks' })
  @ApiOkResponse({ description: 'Supported banks retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('banks')
  async getBanks(@GetMode() mode: 'live' | 'test') {
    return this.miscService.getBanks(mode);
  }

  @ApiOperation({ summary: 'Add bank account' })
  @ApiCreatedResponse({ description: 'Bank account added successfully.' })
  @ApiErrorResponses(401, 409)
  @Post('banks')
  async addBank(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: AddBankDto,
  ) {
    return this.miscService.addBank(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'Get saved banks' })
  @ApiOkResponse({ description: 'Saved banks retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('banks/saved')
  async getSavedBanks(@GetBusinessId() businessId: string) {
    return this.miscService.getSavedBanks(businessId);
  }

  @ApiOperation({ summary: 'Get saved bank by account number' })
  @ApiParam({ name: 'accountNumber', example: '3154021148' })
  @ApiOkResponse({ description: 'Saved bank retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('banks/saved/:accountNumber')
  async getSavedBankById(
    @GetBusinessId() businessId: string,
    @Param('accountNumber') accountNumber: string,
  ) {
    return this.miscService.getSavedBanksById(businessId, accountNumber);
  }

  @ApiOperation({ summary: 'Delete bank account' })
  @ApiParam({ name: 'bankId', description: 'Local bank record ID' })
  @ApiOkResponse({ description: 'Bank account deleted successfully.' })
  @ApiErrorResponses(401, 404)
  @Delete('banks/:bankId')
  async deleteBank(@Param('bankId') bankId: string) {
    return this.miscService.deleteBank(bankId);
  }

  @ApiOperation({ summary: 'Verify bank account' })
  @ApiCreatedResponse({ description: 'Bank account verified successfully.' })
  @ApiErrorResponses(401)
  @Post('banks/verify')
  async verifyBankAccount(
    @GetMode() mode: 'live' | 'test',
    @Body() dto: VerifyBankAccountDto,
  ) {
    return this.miscService.verifyBankAccount(mode, dto);
  }

  @Public()
  @ApiOperation({ summary: 'Get supported blockchain and assets' })
  @ApiOkResponse({ description: 'Supported assets retrieved successfully.' })
  @Get('assets')
  async getSupportedDepositAssets(@GetMode() mode: 'live' | 'test') {
    return this.miscService.getSupportedAssets(mode);
  }

  @ApiOperation({ summary: 'Get crypto conversion rate' })
  @ApiCreatedResponse({
    description: 'Crypto conversion rate retrieved successfully.',
  })
  @ApiErrorResponses(401)
  @Post('crypto-prices')
  async getCryptoPrices(
    @GetMode() mode: 'live' | 'test',
    @Body() query: GetRateQueryDto,
  ) {
    return this.miscService.getCryptoPrices(mode, query);
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
  @ApiCreatedResponse({
    description: 'Estimated payment amount calculated successfully.',
  })
  @ApiErrorResponses(401)
  @Post('rate-calculator')
  async getRateCalculator(
    @GetMode() mode: 'live' | 'test',
    @Body() body: { asset: string; amount: number; currency: string },
  ) {
    return this.miscService.getRateCalculator(
      mode,
      body.asset,
      body.amount,
      body.currency,
    );
  }
}

@ApiTags('Health')
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({ summary: 'Health check' })
  @Public()
  @ApiOkResponse({ description: 'Service is healthy.' })
  @Get()
  getHealth() {
    return this.miscService.getHealth();
  }
}
