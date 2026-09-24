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
import { Bank } from '../../database/entities';

const BANK_EXAMPLE = {
  id: '9f2b6b2a-df9c-4c2a-9a0a-9e6a2a2b6a99',
  provider_recipient_id: 'rcp_8f3c1a2b4d5e',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  account_name: 'John Doe',
  account_number: '8065924354',
  bank_code: '305',
  bank_name: 'OPay',
  currency: 'NGN',
  label: 'My OpayBank',
  is_trusted: false,
  type: 'individual',
  primary: false,
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const BANK_LIST_EXAMPLE = {
  banks: [
    { code: '305', name: 'OPay' },
    { code: '044', name: 'Access Bank' },
  ],
  cached: true,
};

const ADD_BANK_RESULT_EXAMPLE = {
  id: 'rcp_8f3c1a2b4d5e',
  label: 'My OpayBank',
  details: {
    accountNumber: '8065924354',
    bankCode: '305',
    accountName: 'John Doe',
    bankName: 'OPay',
    currency: 'NGN',
    accountType: 'individual',
  },
  isDefault: false,
  isTrusted: false,
  local_id: '9f2b6b2a-df9c-4c2a-9a0a-9e6a2a2b6a99',
};

const BANK_VERIFICATION_EXAMPLE = {
  data: {
    accountNumber: '2249098732',
    bankCode: '033',
    accountName: 'ADAEZE CHIOMA NWOSU',
  },
};

const SUPPORTED_ASSETS_EXAMPLE = {
  data: {
    bitcoin: ['BTC'],
    ethereum: ['ETH', 'USDT', 'USDC'],
    bsc: ['BNB', 'USDT'],
    tron: ['USDT', 'TRX'],
    solana: ['SOL', 'USDC'],
    base: ['USDC'],
  },
};

const CRYPTO_PRICE_EXAMPLE = {
  data: {
    from: 'USDT',
    to: 'NGN',
    rate: 1550.25,
  },
};

const RATE_CALCULATOR_EXAMPLE = {
  data: {
    asset: 'USDT',
    amount: '100',
    currency: 'NGN',
    estimatedAmount: '64.5',
    fee: '0.32',
  },
};

@ApiTags('Misc - Banks & Assets')
@DualAuth()
@Controller('misc')
export class MiscController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({ summary: 'Get supported banks' })
  @ApiOkResponse({
    description: 'Supported banks retrieved successfully.',
    schema: { example: BANK_LIST_EXAMPLE },
  })
  @ApiErrorResponses(401)
  @Get('banks')
  async getBanks(@GetMode() mode: 'live' | 'test') {
    return this.miscService.getBanks(mode);
  }

  @ApiOperation({ summary: 'Add bank account' })
  @ApiCreatedResponse({
    description: 'Bank account added successfully.',
    schema: { example: ADD_BANK_RESULT_EXAMPLE },
  })
  @ApiErrorResponses(401, {
    status: 409,
    message: 'Bank account already added',
  })
  @Post('banks')
  async addBank(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: AddBankDto,
  ) {
    return this.miscService.addBank(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'Get saved banks' })
  @ApiOkResponse({
    description: 'Saved banks retrieved successfully.',
    type: Bank,
    isArray: true,
    example: [BANK_EXAMPLE],
  })
  @ApiErrorResponses(401)
  @Get('banks/saved')
  async getSavedBanks(@GetBusinessId() businessId: string) {
    return this.miscService.getSavedBanks(businessId);
  }

  @ApiOperation({ summary: 'Get saved bank by account number' })
  @ApiParam({ name: 'accountNumber', example: '3154021148' })
  @ApiOkResponse({
    description: 'Saved bank retrieved successfully.',
    type: Bank,
    example: BANK_EXAMPLE,
  })
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
  @ApiOkResponse({
    description: 'Bank account deleted successfully.',
    schema: { example: { message: 'Bank account deleted.' } },
  })
  @ApiErrorResponses(401, { status: 404, message: 'Bank not found' })
  @Delete('banks/:bankId')
  async deleteBank(@Param('bankId') bankId: string) {
    return this.miscService.deleteBank(bankId);
  }

  @ApiOperation({ summary: 'Verify bank account' })
  @ApiCreatedResponse({
    description: 'Bank account verified successfully.',
    schema: { example: BANK_VERIFICATION_EXAMPLE },
  })
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
  @ApiOkResponse({
    description: 'Supported assets retrieved successfully.',
    schema: { example: SUPPORTED_ASSETS_EXAMPLE },
  })
  @Get('assets')
  async getSupportedDepositAssets(@GetMode() mode: 'live' | 'test') {
    return this.miscService.getSupportedAssets(mode);
  }

  @ApiOperation({ summary: 'Get crypto conversion rate' })
  @ApiCreatedResponse({
    description: 'Crypto conversion rate retrieved successfully.',
    schema: { example: CRYPTO_PRICE_EXAMPLE },
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
    schema: { example: RATE_CALCULATOR_EXAMPLE },
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
