import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { MiscService } from './misc.service';
import { GetRateQueryDto, AddBankDto, VerifyBankAccountDto } from './dto';
import { GetDeveloper, Public } from '../../common/decorators';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Misc - Banks & Assets')
@Controller('misc')
export class MiscController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({
    summary: 'Get supported banks',
    description:
      'Returns list of supported Nigerian banks (bank code + name). Cached for 24 hours.',
  })
  @ApiBearerAuth('api-key')
  @Get('banks')
  async getBanks() {
    return this.miscService.getBanks();
  }

  @ApiOperation({
    summary: 'Add bank account',
    description: 'Add a validated NGN or GHS bank account to your integration',
  })
  @ApiBearerAuth('api-key')
  @Post('banks')
  async addBank(
    @GetDeveloper('id') developerId: string,
    @Body() dto: AddBankDto,
  ) {
    return this.miscService.addBank(developerId, dto);
  }

  @ApiOperation({
    summary: 'Get saved banks',
    description:
      'Retrieve all saved bank accounts for the authenticated developer from local database',
  })
  @ApiBearerAuth('api-key')
  @Get('banks/saved')
  async getSavedBanks(@GetDeveloper('id') developerId: string) {
    return this.miscService.getSavedBanks(developerId);
  }

  @ApiOperation({
    summary: 'Get saved bank by account number',
    description: 'Retrieve a specific saved bank account by account number',
  })
  @ApiParam({
    name: 'accountNumber',
    description: 'Bank account number',
    example: '3154021148',
  })
  @ApiBearerAuth('api-key')
  @Get('banks/saved/:accountNumber')
  async getSavedBankById(
    @GetDeveloper('id') developerId: string,
    @Param('accountNumber', ParseIntPipe) accountNumber: number,
  ) {
    return this.miscService.getSavedBanksById(
      developerId,
      accountNumber.toString(),
    );
  }

  @ApiOperation({
    summary: 'Get Breet bank integration',
    description: 'Fetch all banks on your integration from Breet API',
  })
  @ApiBearerAuth('api-key')
  @Get('banks/breet')
  async getBreetBankIntegration() {
    return this.miscService.getBreetBankIntegration();
  }

  @ApiOperation({
    summary: 'Get Breet bank by ID',
    description: 'Fetch a specific bank from Breet API by its ID',
  })
  @ApiParam({
    name: 'bankId',
    description: 'Breet bank unique identifier',
    example: '69737920df8b52679a8b198e',
  })
  @ApiBearerAuth('api-key')
  @Get('banks/:bankId')
  async getBreetBankById(@Param('bankId') bankId: string) {
    return this.miscService.getBreetBankById(bankId);
  }

  @ApiOperation({
    summary: 'Delete bank account',
    description:
      'Remove a saved bank account from your integration by ID. Also detaches from all associated wallets.',
  })
  @ApiParam({
    name: 'bankId',
    description: 'Breet bank unique identifier',
    example: '69737920df8b52679a8b198e',
  })
  @ApiBearerAuth('api-key')
  @Delete('banks/:bankId')
  async deleteBank(@Param('bankId') bankId: string) {
    return this.miscService.deleteBank(bankId);
  }

  @ApiOperation({
    summary: 'Verify bank account',
    description:
      'Verify bank account details before adding. Returns account name if valid.',
  })
  @ApiBearerAuth('api-key')
  @Post('banks/verify')
  async verifyBankAccount(@Body() dto: VerifyBankAccountDto) {
    return this.miscService.verifyBankAccount(dto);
  }

  @ApiOperation({
    summary: 'Get deposit assets',
    description:
      'Returns supported crypto assets for deposit (test and mainnet)',
  })
  @ApiBearerAuth('api-key')
  @Get('deposit-assets')
  async getSupportedDepositAssets() {
    return this.miscService.getSupportedDepositAssets();
  }

  @ApiOperation({
    summary: 'Get withdrawal assets',
    description:
      'Returns supported crypto assets for withdrawal to external addresses',
  })
  @ApiBearerAuth('api-key')
  @Get('withdrawal-assets')
  async getSupportedWithdrawalAssets() {
    return this.miscService.getSupportedWithdrawalAssets();
  }

  @ApiOperation({
    summary: 'Get crypto prices',
    description: 'Get global market prices for crypto-fiat pairs from Breet',
  })
  @ApiBearerAuth('api-key')
  @Post('crypto-prices')
  async getCryptoPrices(@Body() query: GetRateQueryDto) {
    return this.miscService.getCryptoPrices(query);
  }

  @ApiOperation({
    summary: 'Rate calculator',
    description:
      "Calculate crypto amount and get NGN/GHS rate using Breet's actual conversion rates",
  })
  @ApiBearerAuth('api-key')
  @Post('rate-calculator')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        assetId: { type: 'string', example: '69b3e33d5aef202395e800e1' },
        amountInUSD: { type: 'number', example: 100 },
        currency: { type: 'string', example: 'ngn' },
      },
      required: ['assetId', 'amountInUSD', 'currency'],
    },
  })
  async getRateCalculator(
    @Body() body: { assetId: string; amountInUSD: number; currency: string },
  ) {
    return this.miscService.getRateCalculator(
      body.assetId,
      body.amountInUSD,
      body.currency,
    );
  }

  @ApiOperation({
    summary: 'Convert USD to fiat',
    description:
      'Convert USD balance to local fiat (NGN/GHS) and optionally credit to saved bank account',
  })
  @ApiBearerAuth('api-key')
  @Post('convert/usd-to-fiat')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 10 },
        pin: { type: 'string', example: '1234' },
        bankId: { type: 'string', example: '69e941d9eda0df83cc847d8a' },
      },
      required: ['amount', 'bankId', 'pin'],
    },
  })
  async convertUsdToFiat(
    @Body() body: { amount: number; pin: string; bankId: string },
  ) {
    return this.miscService.convertUsdToFiat(
      body.amount,
      body.pin,
      body.bankId,
    );
  }

  @ApiOperation({
    summary: 'Convert fiat to USD',
    description:
      'Convert local fiat (NGN/GHS) to USD and optionally withdraw to crypto address',
  })
  @ApiBearerAuth('api-key')
  @Post('convert/fiat-to-usd')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        localAmount: { type: 'number', example: 20000 },
        pin: { type: 'string', example: '1234' },
        withdrawalAddressId: { type: 'string', example: 'address_123' },
      },
      required: ['localAmount', 'pin', 'withdrawalAddressId'],
    },
  })
  async convertFiatToUsd(
    @Body()
    body: {
      localAmount: number;
      pin: string;
      withdrawalAddressId: string;
    },
  ) {
    return this.miscService.convertFiatToUsd(
      body.localAmount,
      body.pin,
      body.withdrawalAddressId,
    );
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly miscService: MiscService) {}

  @ApiOperation({
    summary: 'Health check',
    description: 'Public health check endpoint to verify API availability',
  })
  @Public()
  @Get()
  getHealth() {
    return this.miscService.getHealth();
  }
}
